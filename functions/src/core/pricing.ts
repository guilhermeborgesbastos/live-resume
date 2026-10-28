/*
 * What a model call costs, for the monthly cap. Prices belong to a model and an endpoint region,
 * so they're chosen together with the model adapter and injected into the limit store; the
 * limiter itself knows nothing about providers. An unknown model/region pair is an error at
 * startup: the cap must never fall back to a guessed (and possibly lower) price.
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
  readonly region: string;
  readonly input: number;
  readonly cacheWrite: number;
  readonly cacheRead: number;
  readonly output: number;
}

const HAIKU_5_5 = { model: "claude-haiku-5-5", input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 } as const;
/** Vertex AI multi-region and regional endpoints cost 10% more than the global one. */
const REGIONAL_PREMIUM = 1.1;

const premium = (base: typeof HAIKU_5_5, region: string): Tariff => ({
  model: base.model,
  region,
  input: base.input * REGIONAL_PREMIUM,
  cacheWrite: base.cacheWrite * REGIONAL_PREMIUM,
  cacheRead: base.cacheRead * REGIONAL_PREMIUM,
  output: base.output * REGIONAL_PREMIUM
});

/** Claude list prices on Vertex AI (checked 28 October 2026). Recheck in the console before relying on them. */
export const TARIFFS: readonly Tariff[] = [
  { ...HAIKU_5_5, region: "global" },
  premium(HAIKU_5_5, "eu"),
  premium(HAIKU_5_5, "us")
];

export class UnknownTariffError extends Error {
  constructor(model: string, region: string) {
    super(`No price is configured for model "${model}" in region "${region}"; add it to TARIFFS in functions/src/core/pricing.ts`);
    this.name = "UnknownTariffError";
  }
}

export function tariffFor(model: string, region: string, tariffs: readonly Tariff[] = TARIFFS): Tariff {
  const tariff = tariffs.find(t => t.model === model && t.region === region);
  if (!tariff) {
    throw new UnknownTariffError(model, region);
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
