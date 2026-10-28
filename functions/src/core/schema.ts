/*
 * The JSON schema the model's reply must follow (structured outputs). The evidence IDs and role
 * numbers are closed lists built from the CV, so the model can't cite something that doesn't
 * exist. Counts and lengths aren't expressible here; validate-answer.ts enforces them.
 */
import type { EvidenceMap } from "../../../src/app/assistant/knowledge/evidence-map";
import { ModelAnswerStatus } from "./constants";

export interface ModelAnswer {
  readonly status: ModelAnswerStatus;
  readonly partial: boolean;
  readonly subjectExperienceId: number | null;
  readonly paragraphs: readonly { readonly text: string; readonly evidence: readonly string[] }[];
}

export function answerSchema(map: EvidenceMap, experienceIds: readonly number[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["status", "partial", "subjectExperienceId", "paragraphs"] satisfies (keyof ModelAnswer)[],
    properties: {
      status: { type: "string", enum: Object.values(ModelAnswerStatus) },
      partial: { type: "boolean" },
      subjectExperienceId: { anyOf: [{ type: "integer", enum: [...experienceIds].sort((a, b) => b - a) }, { type: "null" }] },
      paragraphs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "evidence"],
          properties: {
            text: { type: "string" },
            evidence: { type: "array", items: { type: "string", enum: map.entries.map(e => e.id) } }
          }
        }
      }
    }
  };
}
