/*
 * Cloud Functions for the CV Assistant's hosted AI answers (see AI_ASSISTANT_LLM_FIREBASE_PLAN.md
 * and docs/cv-assistant-design.md):
 *
 *   askAssistant   callable, App Check required and consumed; answers one question with
 *                  Claude Haiku 5.5 on Vertex AI, from the CV data bundled at deploy time
 *   onBudgetAlert  Pub/Sub; turns the kill switch off when the project budget is exceeded
 */
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineInt, defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { ask, InvalidRequestError } from "./core/ask";
import { buildHostedKnowledge, HostedKnowledge } from "./core/knowledge";
import { clientKey } from "./core/limits";
import { VertexAnswerModel } from "./core/model";
import { CONFIG_DOC, FirestoreLimitStore } from "./firestore-store";

const REGION = "europe-west4";
const ALLOWED_ORIGINS = ["https://guilhermeborgesbastos.com", "https://www.guilhermeborgesbastos.com", /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];

const VERTEX_REGION = defineString("VERTEX_REGION", { default: "eu", description: "Vertex AI endpoint for Claude: eu multi-region" });
const ASSISTANT_MODEL = defineString("ASSISTANT_MODEL", { default: "claude-haiku-5-5" });
const DAILY_CALL_LIMIT = defineInt("DAILY_CALL_LIMIT", { default: 150 });
const PER_CLIENT_PER_MINUTE = defineInt("PER_CLIENT_PER_MINUTE", { default: 3 });
const PER_CLIENT_PER_DAY = defineInt("PER_CLIENT_PER_DAY", { default: 20 });
const MONTHLY_BUDGET_MICROS = defineInt("MONTHLY_BUDGET_MICROS", { default: 5_000_000 });
const BUDGET_TOPIC = defineString("BUDGET_TOPIC", { default: "assistant-budget" });
const ASSISTANT_SERVICE_ACCOUNT = defineString("ASSISTANT_SERVICE_ACCOUNT", {
  default: "default",
  description: "Runtime service account e-mail or name@ (Vertex AI User + Cloud Datastore User); 'default' is the default compute account"
});
const RATE_LIMIT_SALT = defineSecret("RATE_LIMIT_SALT");

initializeApp();

let knowledge: HostedKnowledge | undefined;
function loadKnowledge(): HostedKnowledge {
  const read = (name: string) => readFileSync(new URL(`./data/${name}`, import.meta.url), "utf8");
  knowledge ??= buildHostedKnowledge({
    about: JSON.parse(read("about.json")),
    experiences: JSON.parse(read("experiences.json")),
    posts: JSON.parse(read("posts.json"))
  }, read("assistant-context.txt"));
  return knowledge;
}

let store: FirestoreLimitStore | undefined;
let model: VertexAnswerModel | undefined;

export const askAssistant = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    cors: ALLOWED_ORIGINS,
    secrets: [RATE_LIMIT_SALT],
    serviceAccount: ASSISTANT_SERVICE_ACCOUNT,
    maxInstances: 2,
    concurrency: 10,
    timeoutSeconds: 20,
    memory: "256MiB"
  },
  async request => {
    store ??= new FirestoreLimitStore(getFirestore(), {
      dailyCalls: DAILY_CALL_LIMIT.value(),
      perClientPerMinute: PER_CLIENT_PER_MINUTE.value(),
      perClientPerDay: PER_CLIENT_PER_DAY.value(),
      monthlyBudgetMicros: MONTHLY_BUDGET_MICROS.value()
    });
    model ??= new VertexAnswerModel(process.env.GCLOUD_PROJECT!, VERTEX_REGION.value(), ASSISTANT_MODEL.value());
    const now = new Date();
    try {
      return await ask(request.data, {
        knowledge: loadKnowledge(),
        store,
        model,
        // The address Google's front end saw; client-supplied forwarding headers are never read.
        clientKey: clientKey(RATE_LIMIT_SALT.value(), request.rawRequest.ip ?? "unknown", now),
        now: () => new Date(),
        log: event => logger.info("askAssistant", event)
      });
    } catch (error) {
      if (error instanceof InvalidRequestError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      logger.error("askAssistant failed", { error: error instanceof Error ? error.message : String(error) });
      throw new HttpsError("internal", "The assistant could not answer.");
    }
  }
);

/**
 * Cloud Billing budget notifications (JSON with costAmount and budgetAmount). Billing data
 * arrives hours late, so this is the backstop; the per-call limits keep spend bounded.
 */
export const onBudgetAlert = onMessagePublished({ topic: BUDGET_TOPIC, region: REGION }, async event => {
  const data = event.data.message.json as { costAmount?: number; budgetAmount?: number } | undefined;
  if (typeof data?.costAmount === "number" && typeof data.budgetAmount === "number" && data.costAmount >= data.budgetAmount) {
    await getFirestore().doc(CONFIG_DOC).set({ enabled: false, disabledReason: "budget", updatedAt: new Date() }, { merge: true });
    logger.warn("Hosted answers turned off: budget exceeded", { costAmount: data.costAmount, budgetAmount: data.budgetAmount });
  }
});
