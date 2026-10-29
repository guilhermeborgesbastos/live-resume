/*
 * One hosted question, cheapest checks first: kill switch, request validation, knowledge
 * version, limits and cost reservation (one atomic step), one model call, grounding checks,
 * settlement. Logs carry outcomes, counts and timings only: never the question, the answer or the IP.
 * A question that reaches the model is kept with its answer in Firestore for review (QuestionRecord).
 */
import { CONTEXT_FILE } from "../../../src/app/assistant/knowledge/assistant-context";
import { sourcesFor } from "../../../src/app/assistant/knowledge/evidence-map";
import type { Locale } from "../../../src/app/assistant/models/assistant.models";
import {
  AskAssistantResult, HostedNote, HostedResultKind, parseAskRequest, UnavailableReason
} from "../../../src/app/assistant/models/hosted-answer.models";
import { CheckStatus, Failure, LogEvent, ModelReplyKind, NoAnswerReason, Outcome } from "./constants";
import type { HostedKnowledge } from "./knowledge";
import { LimitStore, QuestionRecord, Settlement } from "./limits";
import { AnswerModel, MAX_OUTPUT_TOKENS, ModelError } from "./model";
import type { CostPolicy } from "./pricing";
import { PROMPT_VERSION, userTurn } from "./prompt";
import { checkAnswer } from "./validate-answer";

export interface AskDeps {
  readonly knowledge: HostedKnowledge;
  readonly store: LimitStore;
  readonly model: AnswerModel;
  readonly costs: CostPolicy;
  readonly clientKey: string;
  readonly now: () => Date;
  readonly log: (event: Record<string, unknown>) => void;
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

const unavailable = (reason: UnavailableReason, retryable: boolean): AskAssistantResult =>
  ({ kind: HostedResultKind.Unavailable, reason, retryable });

/** The longest rejected reply kept with a question. */
const MAX_REJECTED_LENGTH = 4000;

type KeptReply = Pick<QuestionRecord, "answer" | "partial" | "check" | "rejected" | "stop">;

export async function ask(body: unknown, deps: AskDeps): Promise<AskAssistantResult> {
  const started = deps.now();
  let asked: { readonly question: string; readonly locale: Locale } | undefined;
  const finish = async (result: AskAssistantResult, outcome?: Outcome, extra: Record<string, unknown> = {}, settlement?: Settlement,
                        kept: KeptReply = {}) => {
    const writes: Promise<void>[] = [];
    if (outcome) {
      writes.push(deps.store.record(deps.now(), outcome, settlement).catch(() => deps.log({ event: LogEvent.RecordFailed })));
    }
    // A settlement exists exactly when the model was called, so only those questions are kept.
    if (outcome && settlement && asked) {
      writes.push(deps.store.saveQuestion(deps.now(), {
        ...asked,
        outcome,
        ...kept,
        model: deps.model.modelId,
        promptVersion: PROMPT_VERSION,
        knowledgeVersion: deps.knowledge.version,
        contextVersion: deps.knowledge.contextVersion,
        costMicros: settlement.usage ? deps.costs.cost(settlement.usage) : undefined
      }).catch(() => deps.log({ event: LogEvent.QuestionSaveFailed })));
    }
    await Promise.all(writes);
    deps.log({
      event: LogEvent.Ask,
      result: result.kind,
      outcome,
      ms: deps.now().getTime() - started.getTime(),
      ...extra,
      ...(settlement?.usage ? { usage: settlement.usage } : {})
    });
    return result;
  };

  if (!(await deps.store.enabled().catch(() => false))) {
    return finish(unavailable(UnavailableReason.Disabled, false));
  }

  const request = parseAskRequest(body, deps.knowledge.experienceIds);
  if ("error" in request) {
    deps.log({ event: LogEvent.InvalidRequest, reason: request.error });
    throw new InvalidRequestError(request.error);
  }
  if (request.knowledgeVersion !== deps.knowledge.version) {
    return finish({ kind: HostedResultKind.VersionMismatch });
  }
  asked = { question: request.question, locale: request.locale };

  const locale = deps.knowledge.locales[request.locale];
  let reservation;
  try {
    reservation = await deps.store.reserve(deps.clientKey, started, deps.costs.ceiling(locale.maxInputTokens, MAX_OUTPUT_TOKENS));
  } catch {
    // Fail closed: without the counters, no model call.
    return finish(unavailable(UnavailableReason.Error, true), undefined, { failure: Failure.LimitStore });
  }
  if (!reservation.allowed) {
    return finish(unavailable(UnavailableReason.Limited, false), Outcome.Limited, { limit: reservation.limit });
  }
  const reservedMicros = reservation.reservedMicros;

  let reply;
  try {
    reply = await deps.model.answer({ system: locale.system, user: userTurn(request), schema: locale.schema });
  } catch (error) {
    // Usage is unknown, so the reservation stays on the month.
    const retryable = error instanceof ModelError && error.retryable;
    return finish(unavailable(UnavailableReason.Error, retryable), Outcome.Error,
      { failure: Failure.Model, detail: error instanceof Error ? error.message : undefined }, { reservedMicros });
  }
  const settlement: Settlement = { reservedMicros, usage: reply.usage };
  if (reply.kind === ModelReplyKind.NoAnswer) {
    return reply.reason === NoAnswerReason.Refusal
      ? finish({ kind: HostedResultKind.Fallback }, Outcome.Unsupported, { stop: reply.reason }, settlement, { stop: reply.reason })
      : finish(unavailable(UnavailableReason.Invalid, false), Outcome.Invalid, { stop: reply.reason }, settlement, { stop: reply.reason });
  }

  const checked = checkAnswer(reply.json, locale, request.locale);
  if (checked.status === CheckStatus.Invalid) {
    return finish(unavailable(UnavailableReason.Invalid, false), Outcome.Invalid, { check: checked.check }, settlement,
      { check: checked.check, rejected: JSON.stringify(reply.json).slice(0, MAX_REJECTED_LENGTH) });
  }
  if (checked.status === CheckStatus.Unsupported) {
    return finish({ kind: HostedResultKind.Fallback }, Outcome.Unsupported, {}, settlement);
  }

  const cited = checked.paragraphs.flatMap(p => p.evidence);
  const notes: HostedNote[] = sourcesFor(locale.map, cited)
    .map(source => deps.knowledge.notes.find(n => n.id === source.recordKey && source.file === CONTEXT_FILE))
    .filter(note => note !== undefined)
    .map(note => ({ id: note.id, title: note.locales[request.locale].title, updated: note.updated, related: note.related }));
  return finish({
    kind: HostedResultKind.Generated,
    knowledgeVersion: deps.knowledge.version,
    paragraphs: checked.paragraphs,
    partial: checked.partial,
    ...(checked.subjectExperienceId !== undefined ? { subject: { experienceId: checked.subjectExperienceId } } : {}),
    notes
  }, Outcome.Answered, { paragraphs: checked.paragraphs.length, evidence: cited.length, partial: checked.partial }, settlement,
  { answer: checked.paragraphs, partial: checked.partial });
}
