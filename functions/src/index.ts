/*
 * Cloud Functions for the CV Assistant's hosted AI answers (setup and operation: DEPLOYMENT.md,
 * "AI answers (Firebase)"):
 *
 *   askAssistant   callable, App Check required and consumed; answers one question with
 *                  Claude Haiku 5.5 on the Claude API, from the CV data bundled at deploy time
 *   onBudgetAlert  Pub/Sub; turns the kill switch off when the project budget is exceeded
 */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineInt, defineSecret, defineString } from "firebase-functions/params";
import { onInit } from "firebase-functions/v2/core";
import { onCall } from "firebase-functions/v2/https";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { environment } from "../../src/environments/environment.prod";
import { DisabledReason, FirestoreField, FirestorePath, LogEvent } from "./core/constants";
import { AskServices, createAskHandler } from "./core/handler";
import { buildHostedKnowledge } from "./core/knowledge";
import { AnswerModel, ClaudeApiAnswerModel } from "./core/model";
import { costPolicy, tariffFor } from "./core/pricing";
import { FirestoreLimitStore } from "./firestore-store";

const REGION = "europe-west4";
const DATA_FILES = { about: "about.json", experiences: "experiences.json", posts: "posts.json", notes: "assistant-context.txt" } as const;
const ALLOWED_ORIGINS = ["https://guilhermeborgesbastos.com", "https://www.guilhermeborgesbastos.com", /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];

const ASSISTANT_MODEL = defineString("ASSISTANT_MODEL", { default: "claude-haiku-5-5" });
// Sized so the month's worst case stays within MONTHLY_BUDGET_MICROS: 400 × 31 × $0.0016 (a cache miss with the
// ~10,000-token prompt of the current notes) ≈ $19.80.
const DAILY_CALL_LIMIT = defineInt("DAILY_CALL_LIMIT", { default: 400 });
const PER_CLIENT_PER_MINUTE = defineInt("PER_CLIENT_PER_MINUTE", { default: 3 });
const PER_CLIENT_PER_DAY = defineInt("PER_CLIENT_PER_DAY", { default: 80 });
const MONTHLY_BUDGET_MICROS = defineInt("MONTHLY_BUDGET_MICROS", { default: 20_000_000 });
const TRUSTED_PROXY_HOPS = defineInt("TRUSTED_PROXY_HOPS", {
  default: 1,
  description: "Proxies that append to X-Forwarded-For in front of the function (Google's front end: 1)"
});
const BUDGET_TOPIC = defineString("BUDGET_TOPIC", { default: "assistant-budget" });
const ASSISTANT_SERVICE_ACCOUNT = defineString("ASSISTANT_SERVICE_ACCOUNT", {
  default: "default",
  description: "Runtime service account for both functions: an e-mail, name@, or 'default' (the default compute account)"
});
const RATE_LIMIT_SALT = defineSecret("RATE_LIMIT_SALT");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

initializeApp();

let services: Omit<AskServices, "salt" | "model"> | undefined;
let model: AnswerModel | undefined;

// Runs once per instance; a model without a price throws here, so the instance never serves with a wrong cost.
onInit(() => {
  const costs = costPolicy(tariffFor(ASSISTANT_MODEL.value()));
  const read = (name: string) => readFileSync(new URL(`./data/${name}`, import.meta.url), "utf8");
  services = {
    knowledge: buildHostedKnowledge({
      about: JSON.parse(read(DATA_FILES.about)),
      experiences: JSON.parse(read(DATA_FILES.experiences)),
      posts: JSON.parse(read(DATA_FILES.posts))
    }, read(DATA_FILES.notes), environment.personal),
    store: new FirestoreLimitStore(getFirestore(), {
      dailyCalls: DAILY_CALL_LIMIT.value(),
      perClientPerMinute: PER_CLIENT_PER_MINUTE.value(),
      perClientPerDay: PER_CLIENT_PER_DAY.value(),
      monthlyBudgetMicros: MONTHLY_BUDGET_MICROS.value()
    }, costs),
    costs,
    trustedProxyHops: TRUSTED_PROXY_HOPS.value(),
    now: () => new Date(),
    log: event => logger.info("askAssistant", event)
  };
});

export const askAssistant = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    cors: ALLOWED_ORIGINS,
    secrets: [RATE_LIMIT_SALT, ANTHROPIC_API_KEY],
    serviceAccount: ASSISTANT_SERVICE_ACCOUNT,
    maxInstances: 2,
    concurrency: 10,
    timeoutSeconds: 20,
    memory: "256MiB"
  },
  // The API key is a secret of this function only, so the client is created on its first request rather than in onInit.
  createAskHandler(() => ({
    ...services!,
    model: model ??= new ClaudeApiAnswerModel(ANTHROPIC_API_KEY.value(), ASSISTANT_MODEL.value()),
    salt: RATE_LIMIT_SALT.value()
  }))
);

/**
 * Cloud Billing budget notifications (JSON with costAmount and budgetAmount). They cover Google
 * Cloud costs only; Claude API spend is capped by MONTHLY_BUDGET_MICROS and the Anthropic
 * workspace's spend limit. It writes to Firestore, so its service account needs Cloud Datastore User.
 */
export const onBudgetAlert = onMessagePublished({ topic: BUDGET_TOPIC, region: REGION, serviceAccount: ASSISTANT_SERVICE_ACCOUNT }, async event => {
  const data = event.data.message.json as { costAmount?: number; budgetAmount?: number } | undefined;
  if (typeof data?.costAmount === "number" && typeof data.budgetAmount === "number" && data.costAmount >= data.budgetAmount) {
    await getFirestore().doc(FirestorePath.RuntimeConfig)
      .set({ [FirestoreField.Enabled]: false, disabledReason: DisabledReason.Budget, updatedAt: new Date() }, { merge: true });
    logger.warn("onBudgetAlert", { event: LogEvent.BudgetExceeded, costAmount: data.costAmount, budgetAmount: data.budgetAmount });
  }
});
