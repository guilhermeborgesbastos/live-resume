import { readFileSync } from "node:fs";
import { buildHostedKnowledge, HostedKnowledge } from "../src/core/knowledge";
import { LimitConfig, MemoryLimitStore, Usage } from "../src/core/limits";
import { AnswerModel, ModelReply, ModelRequest } from "../src/core/model";
import type { RawKnowledge } from "../../src/app/assistant/knowledge/knowledge-adapter";

const data = (name: string) => readFileSync(new URL(`../../src/assets/data/${name}`, import.meta.url), "utf8");

export function rawCv(): RawKnowledge {
  return { about: JSON.parse(data("about.json")), experiences: JSON.parse(data("experiences.json")), posts: JSON.parse(data("posts.json")) };
}

export const NOTES = `# test notes
[java-experience]
updated: 2026-10
related: exp.3 exp.4 exp.5 exp.6
title.en: Java experience
title.pt: Experiência com Java
en: I have worked with Java since 2014.
pt: Trabalho com Java desde 2014.

[relocation]
updated: 2026-10
title.en: Relocation
title.pt: Mudança
en: I am not looking to relocate outside the Netherlands as of October 2026, and I hold an EU work permit.
pt: Não pretendo me mudar para fora da Holanda em outubro de 2026 e tenho permissão de trabalho na UE.
`;

export function knowledge(notes = NOTES): HostedKnowledge {
  return buildHostedKnowledge(rawCv(), notes);
}

export const USAGE: Usage = { inputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 6000, outputTokens: 200 };

export const CONFIG: LimitConfig = { dailyCalls: 5, perClientPerMinute: 3, perClientPerDay: 4, monthlyBudgetMicros: 1_000_000 };

/** A model that replays canned replies and records what it was asked. */
export class StubModel implements AnswerModel {
  readonly modelId = "stub";
  readonly requests: ModelRequest[] = [];

  constructor(private readonly reply: (request: ModelRequest) => ModelReply | Promise<ModelReply>) {}

  answer(request: ModelRequest): Promise<ModelReply> {
    this.requests.push(request);
    return Promise.resolve(this.reply(request));
  }
}

export const answered = (paragraphs: { text: string; evidence: string[] }[], extra: Record<string, unknown> = {}): ModelReply =>
  ({ kind: "ok", usage: USAGE, json: { status: "answered", partial: false, subjectExperienceId: null, paragraphs, ...extra } });

export function store(switchOn = true): MemoryLimitStore {
  return new MemoryLimitStore(CONFIG, switchOn);
}
