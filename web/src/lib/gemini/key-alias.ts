import { createHash } from "node:crypto";

/** Non-reversible alias for logs (never store full API keys). */
export function geminiKeyAlias(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}
