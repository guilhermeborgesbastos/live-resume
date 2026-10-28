/* Names the function writes to logs, counters and Firestore, kept in one place. */

export enum LogEvent {
  Ask = "ask",
  InvalidRequest = "invalid-request",
  ReplayedToken = "replayed-token",
  UnknownClient = "unknown-client",
  RecordFailed = "record-failed",
  Failed = "ask-failed",
  BudgetExceeded = "budget-exceeded"
}

/** How a question ended, counted per day in Firestore. */
export enum Outcome {
  Answered = "answered",
  Unsupported = "unsupported",
  Invalid = "invalid",
  Error = "error",
  Limited = "limited"
}

export enum LimitName {
  Daily = "daily",
  Monthly = "monthly",
  ClientMinute = "client-minute",
  ClientDay = "client-day"
}

/** The grounding check that rejected a model reply (validate-answer.ts). */
export enum CheckName {
  Shape = "shape",
  UnsupportedWithText = "unsupported-with-text",
  ParagraphCount = "paragraph-count",
  ParagraphLength = "paragraph-length",
  EvidenceCount = "evidence-count",
  UnknownEvidence = "unknown-evidence",
  Number = "number",
  Name = "name",
  GuardedTopic = "guarded-topic",
  Markup = "markup",
  AnswerLength = "answer-length",
  Language = "language"
}

export enum Failure {
  LimitStore = "limit-store",
  Model = "model"
}

export enum FirestorePath {
  RuntimeConfig = "assistantConfig/runtime",
  Usage = "assistantUsage",
  Rate = "assistantRate"
}

/** Document fields the function reads back. */
export enum FirestoreField {
  Enabled = "enabled",
  Calls = "calls",
  CostMicros = "costMicros"
}

/** Why the kill switch was turned off automatically. */
export enum DisabledReason {
  Budget = "budget"
}

/** The status field of the model's JSON reply (schema.ts). */
export enum ModelAnswerStatus {
  Answered = "answered",
  Unsupported = "unsupported"
}

/** The verdict of the grounding checks on a model reply. */
export enum CheckStatus {
  Answered = "answered",
  Unsupported = "unsupported",
  Invalid = "invalid"
}

export enum ModelReplyKind {
  Ok = "ok",
  NoAnswer = "no-answer"
}

/** Why a model call produced no usable reply. */
export enum NoAnswerReason {
  Refusal = "refusal",
  MaxTokens = "max_tokens",
  Unparseable = "unparseable"
}
