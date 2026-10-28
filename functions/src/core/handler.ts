/*
 * The askAssistant callable's body, separate from the deployed function so it can be tested.
 * Firebase still invokes a callable whose limited-use App Check token was already consumed (it
 * only flags it), so a replayed token is rejected here before anything else runs.
 */
import { HttpsError } from "firebase-functions/v2/https";
import type { AskAssistantResult } from "../../../src/app/assistant/models/hosted-answer.models";
import { ask, AskDeps, InvalidRequestError } from "./ask";
import { clientAddress } from "./client-address";
import { LogEvent } from "./constants";
import { clientKey } from "./limits";

/** What the handler needs from a callable request. */
export interface AskCall {
  readonly data: unknown;
  readonly app?: { readonly alreadyConsumed?: boolean };
  readonly rawRequest: {
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly socket?: { readonly remoteAddress?: string };
  };
}

export interface AskServices extends Omit<AskDeps, "clientKey"> {
  readonly salt: string;
  /** Proxies between the visitor and the function that append to X-Forwarded-For (Google's front end: 1). */
  readonly trustedProxyHops: number;
}

export function createAskHandler(services: () => AskServices): (call: AskCall) => Promise<AskAssistantResult> {
  return async call => {
    if (call.app?.alreadyConsumed) {
      throw new HttpsError("unauthenticated", "This App Check token was already used.");
    }
    const s = services();
    const address = clientAddress(call.rawRequest.headers["x-forwarded-for"], call.rawRequest.socket?.remoteAddress, s.trustedProxyHops);
    if (!address) {
      s.log({ event: LogEvent.UnknownClient });
      throw new HttpsError("failed-precondition", "The request's origin could not be identified.");
    }
    try {
      return await ask(call.data, { ...s, clientKey: clientKey(s.salt, address, s.now()) });
    } catch (error) {
      if (error instanceof InvalidRequestError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      s.log({ event: LogEvent.Failed, error: error instanceof Error ? error.message : String(error) });
      throw new HttpsError("internal", "The assistant could not answer.");
    }
  };
}
