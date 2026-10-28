/*
 * One hosted question, cheapest checks first (plan §3.3): kill switch, request validation,
 * knowledge version, limits (one atomic reservation), one model call, grounding checks, usage
 * counters. App Check has already been verified and consumed by the time this runs.
 *
 * Logs carry outcomes, counts and timings only: never the question, the answer or the IP.
 */
import { sourcesFor } from "../../../src/app/assistant/knowledge/evidence-map";
import { AskAssistantResult, HostedNote, parseAskRequest } from "../../../src/app/assistant/models/hosted-answer.models";
import type { HostedKnowledge } from "./knowledge";
import { LimitStore, Outcome, Usage } from "./limits";
import { AnswerModel, ModelError } from "./model";
import { userTurn } from "./prompt";
import { checkAnswer } from "./validate-answer";

export interface AskDeps {
  readonly knowledge: HostedKnowledge;
  readonly store: LimitStore;
  readonly model: AnswerModel;
  /** clientKey() of the caller's IP for today. */
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

export async function ask(body: unknown, deps: AskDeps): Promise<AskAssistantResult> {
  const started = deps.now();
  const finish = async (result: AskAssistantResult, outcome?: Outcome, extra: Record<string, unknown> = {}, usage?: Usage) => {
    if (outcome) {
      await deps.store.record(deps.now(), outcome, usage).catch(() => deps.log({ event: "record-failed" }));
    }
    deps.log({ event: "ask", result: result.kind, outcome, ms: deps.now().getTime() - started.getTime(), ...extra, ...(usage ? { usage } : {}) });
    return result;
  };

  if (!(await deps.store.enabled().catch(() => false))) {
    return finish({ kind: "unavailable", reason: "disabled", retryable: false });
  }

  const request = parseAskRequest(body, deps.knowledge.experienceIds);
  if ("error" in request) {
    deps.log({ event: "ask", result: "invalid-request", reason: request.error });
    throw new InvalidRequestError(request.error);
  }
  if (request.knowledgeVersion !== deps.knowledge.version) {
    return finish({ kind: "version-mismatch" });
  }

  let reservation;
  try {
    reservation = await deps.store.reserve(deps.clientKey, started);
  } catch {
    // Fail closed: without the counters, no model call.
    return finish({ kind: "unavailable", reason: "error", retryable: true }, undefined, { failure: "limit-store" });
  }
  if (!reservation.allowed) {
    return finish({ kind: "unavailable", reason: "limited", retryable: false }, "limited", { limit: reservation.limit });
  }

  const locale = deps.knowledge.locales[request.locale];
  let reply;
  try {
    reply = await deps.model.answer({ system: locale.system, user: userTurn(request), schema: locale.schema });
  } catch (error) {
    const retryable = error instanceof ModelError && error.retryable;
    return finish({ kind: "unavailable", reason: "error", retryable }, "error", { failure: error instanceof Error ? error.message : "unknown" });
  }
  if (reply.kind === "no-answer") {
    return reply.reason === "refusal"
      ? finish({ kind: "fallback" }, "unsupported", { stop: reply.reason }, reply.usage)
      : finish({ kind: "unavailable", reason: "invalid", retryable: false }, "invalid", { stop: reply.reason }, reply.usage);
  }

  const checked = checkAnswer(reply.json, locale, request.locale);
  if (checked.status === "invalid") {
    return finish({ kind: "unavailable", reason: "invalid", retryable: false }, "invalid", { check: checked.check }, reply.usage);
  }
  if (checked.status === "unsupported") {
    return finish({ kind: "fallback" }, "unsupported", {}, reply.usage);
  }

  const cited = checked.paragraphs.flatMap(p => p.evidence);
  const notes: HostedNote[] = sourcesFor(locale.map, cited)
    .filter(source => source.target.section === "notes")
    .map(source => deps.knowledge.notes.find(n => n.id === source.recordKey)!)
    .map(note => ({ id: note.id, title: note.locales[request.locale].title, updated: note.updated, related: note.related }));
  return finish({
    kind: "generated",
    knowledgeVersion: deps.knowledge.version,
    paragraphs: checked.paragraphs,
    partial: checked.partial,
    ...(checked.subjectExperienceId !== undefined ? { subject: { experienceId: checked.subjectExperienceId } } : {}),
    notes
  }, "answered", { paragraphs: checked.paragraphs.length, evidence: cited.length, partial: checked.partial }, reply.usage);
}
