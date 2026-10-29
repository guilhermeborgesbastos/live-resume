/*
 * What a model call costs, for the monthly cap. Prices belong to a model, so they're chosen
 * together with the model adapter and injected into the limit store; the limiter itself knows
 * nothing about providers. A model without a price is an error at startup: the cap must never
 * fall back to a guessed (and possibly lower) price.
 */

export interface Usage {
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
}

/** Millionths of a dollar per token. */
export interface Tariff {
  readonly model: string;
  readonly input: number;
  /** 5-minute prompt-cache writes. */
  readonly cacheWrite: number;
  readonly cacheRead: number;
  readonly output: number;
}

/** Claude API list prices (checked 28 October 2026). Recheck on Anthropic's pricing page before relying on them. */
export const TARIFFS: readonly Tariff[] = [
  { model: "claude-haiku-5-5", input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 }
];

export class UnknownTariffError extends Error {
  constructor(model: string) {
    super(`No price is configured for model "${model}"; add it to TARIFFS in functions/src/core/pricing.ts`);
    this.name = "UnknownTariffError";
  }
}

export function tariffFor(model: string, tariffs: readonly Tariff[] = TARIFFS): Tariff {
  const tariff = tariffs.find(t => t.model === model);
  if (!tariff) {
    throw new UnknownTariffError(model);
  }
  return tariff;
}

export interface CostPolicy {
  /** The cost of a finished call. */
  cost(usage: Usage): number;
  /** The most a call with this many input and output tokens can cost (every input token billed at the higher of input and cache-write). */
  ceiling(maxInputTokens: number, maxOutputTokens: number): number;
}

export function costPolicy(tariff: Tariff): CostPolicy {
  return {
    cost: usage => Math.ceil(usage.inputTokens * tariff.input + usage.cacheWriteTokens * tariff.cacheWrite
      + usage.cacheReadTokens * tariff.cacheRead + usage.outputTokens * tariff.output),
    ceiling: (maxInputTokens, maxOutputTokens) =>
      Math.ceil(maxInputTokens * Math.max(tariff.input, tariff.cacheWrite) + maxOutputTokens * tariff.output)
  };
}
