/*
 * The visitor's IP address for per-visitor limits. Express (with `trust proxy` on, as the
 * Functions Framework sets it) would take the leftmost X-Forwarded-For entry, which the caller
 * controls. Each trusted proxy in front of the function appends the address it saw, so the
 * visitor's address is the entry `trustedHops` places from the right of the full chain
 * (X-Forwarded-For entries, then the connection's own peer). Anything a caller adds lands to
 * the left of it and is ignored.
 */
import { isIP } from "node:net";

/** Returns the visitor's address, or null when the chain is too short or the entry isn't an IP. */
export function clientAddress(forwardedFor: string | string[] | undefined, peer: string | undefined, trustedHops: number): string | null {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor ?? "";
  const chain = [...header.split(","), peer ?? ""].map(entry => entry.trim()).filter(Boolean);
  const index = chain.length - 1 - trustedHops;
  if (!Number.isInteger(trustedHops) || trustedHops < 0 || index < 0) {
    return null;
  }
  const address = chain[index].replace(/^::ffff:/, "");
  return isIP(address) ? address : null;
}
