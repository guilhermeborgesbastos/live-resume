/*
 * The model behind hosted answers, behind a small interface so tests use a stub and never call
 * a paid API. The Vertex AI implementation makes exactly one request per question: no SDK
 * retries, no second attempt to repair a bad reply.
 */
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { ModelReplyKind, NoAnswerReason } from "./constants";
import type { Usage } from "./pricing";

export interface ModelRequest {
  /** [instructions, CV facts]; the second block carries the cache breakpoint. */
  readonly system: readonly [string, string];
  readonly user: string;
  readonly schema: Record<string, unknown>;
}

export type ModelReply =
  | { readonly kind: ModelReplyKind.Ok; readonly json: unknown; readonly usage: Usage }
  /** A safety refusal, a reply cut off at max_tokens, or text that isn't JSON: it may not follow the schema. */
  | { readonly kind: ModelReplyKind.NoAnswer; readonly reason: NoAnswerReason; readonly usage: Usage };

export class ModelError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "ModelError";
  }
}

export interface AnswerModel {
  readonly modelId: string;
  /** Throws ModelError when the request itself fails. */
  answer(request: ModelRequest): Promise<ModelReply>;
}

export const MAX_OUTPUT_TOKENS = 1024;

export class VertexAnswerModel implements AnswerModel {
  private readonly client: AnthropicVertex;

  constructor(projectId: string, region: string, readonly modelId: string, timeoutMs = 12_000) {
    // Authenticates as the function's service account (Application Default Credentials).
    this.client = new AnthropicVertex({ projectId, region, maxRetries: 0, timeout: timeoutMs });
  }

  async answer(request: ModelRequest): Promise<ModelReply> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Classification-sized work: thinking off (allowed on Claude Haiku 5.5 at effort high or below), low effort.
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: { type: "json_schema", schema: request.schema } },
        system: [
          { type: "text", text: request.system[0] },
          { type: "text", text: request.system[1], cache_control: { type: "ephemeral" } }
        ],
        messages: [{ role: "user", content: request.user }]
      });
    } catch (error) {
      throw toModelError(error);
    }

    const usage: Usage = {
      inputTokens: response.usage.input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      outputTokens: response.usage.output_tokens
    };
    if (response.stop_reason === NoAnswerReason.Refusal || response.stop_reason === NoAnswerReason.MaxTokens) {
      return { kind: ModelReplyKind.NoAnswer, reason: response.stop_reason === NoAnswerReason.Refusal ? NoAnswerReason.Refusal : NoAnswerReason.MaxTokens, usage };
    }
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
    try {
      return { kind: ModelReplyKind.Ok, json: JSON.parse(text), usage };
    } catch {
      return { kind: ModelReplyKind.NoAnswer, reason: NoAnswerReason.Unparseable, usage };
    }
  }
}

function toModelError(error: unknown): ModelError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ModelError("model request timed out", true);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ModelError("could not reach the model", true);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ModelError("model quota or rate limit reached", true);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return new ModelError(`model service error ${error.status}`, true);
  }
  if (error instanceof Anthropic.APIError) {
    // 400: our request is wrong; 403/404: Model Garden enablement or IAM is missing.
    return new ModelError(`model request rejected with ${error.status}`, false);
  }
  return new ModelError("unexpected model error", false);
}
