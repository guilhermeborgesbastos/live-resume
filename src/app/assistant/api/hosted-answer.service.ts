import { inject, Injectable } from "@angular/core";
import { AppCheckService } from "../../core/app-check.service";
import { FIREBASE_APP } from "../../core/firebase";
import { environment } from "../../../environments/environment";
import { AskAssistantRequest, AskAssistantResult, HOSTED_FUNCTION_NAME } from "../models/hosted-answer.models";

/** Function error codes worth trying again later (the others mean the request or setup is wrong). */
const RETRYABLE_CODES = ["functions/deadline-exceeded", "functions/unavailable", "functions/internal", "functions/resource-exhausted"];

/**
 * Calls the askAssistant Cloud Function. Each call carries a fresh single-use App Check token,
 * which the function consumes, so a captured request can't be replayed. Never throws: failures
 * come back as an "unavailable" result. Nothing here logs or stores the question.
 */
@Injectable({ providedIn: "root" })
export class HostedAnswerService {
  private readonly app = inject(FIREBASE_APP);
  private readonly appCheck = inject(AppCheckService);

  /** Hosted answers are built in (environment flag) and App Check is configured. */
  readonly enabled = environment.assistantHosted.enabled && this.appCheck.configured;

  /** Starts App Check early (when the assistant opens), so reCAPTCHA has seen the visitor before the first call. */
  prepare(): void {
    if (this.enabled) {
      this.appCheck.start().catch(() => undefined);
    }
  }

  async ask(request: AskAssistantRequest): Promise<AskAssistantResult> {
    try {
      await this.appCheck.start();
      // The Functions SDK is only needed when a question is sent, so it is loaded on demand.
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const call = httpsCallable<AskAssistantRequest, AskAssistantResult>(
        getFunctions(this.app, environment.assistantHosted.functionsRegion),
        HOSTED_FUNCTION_NAME,
        { limitedUseAppCheckTokens: true, timeout: 20_000 }
      );
      const { data } = await call(request);
      return data;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? "";
      return { kind: "unavailable", reason: "error", retryable: RETRYABLE_CODES.includes(code) };
    }
  }
}
