import { createPublicKey, verify } from "node:crypto";

export type VerifyReason =
  | "ok"
  | "missing_public_key"
  | "missing_signature"
  | "missing_timestamp"
  | "timestamp_format"
  | "timestamp_skew"
  | "public_key_length"
  | "signature_length"
  | "verify_failed";

function timestampSeconds(timestamp: string): number | undefined {
  if (!/^\d{10,13}$/.test(timestamp)) return undefined;
  const n = Number(timestamp);
  return n > 1e12 ? n / 1000 : n;
}

export function verifyTelnyxDiagnose(
  raw: Buffer, signature: string | undefined, timestamp: string | undefined,
  publicKey: string | undefined, now = Date.now(),
): { ok: boolean; reason: VerifyReason } {
  if (!publicKey) return { ok: false, reason: "missing_public_key" };
  if (!signature) return { ok: false, reason: "missing_signature" };
  if (!timestamp) return { ok: false, reason: "missing_timestamp" };
  const seconds = timestampSeconds(timestamp);
  if (seconds === undefined) return { ok: false, reason: "timestamp_format" };
  if (Math.abs(now / 1000 - seconds) > 300) return { ok: false, reason: "timestamp_skew" };
  try {
    const bytes = Buffer.from(publicKey.trim(), "base64");
    const sig = Buffer.from(signature, "base64");
    if (bytes.length !== 32) return { ok: false, reason: "public_key_length" };
    if (sig.length !== 64) return { ok: false, reason: "signature_length" };
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), bytes]),
      format: "der", type: "spki",
    });
    const ok = verify(null, Buffer.concat([Buffer.from(timestamp + "|"), raw]), key, sig);
    return { ok, reason: ok ? "ok" : "verify_failed" };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
}

/** Verify the original bytes for BOTH form-encoded TeXML and JSON messaging. */
export function verifyTelnyx(
  raw: Buffer, signature: string | undefined, timestamp: string | undefined,
  publicKey: string | undefined, now = Date.now(),
): boolean {
  return verifyTelnyxDiagnose(raw, signature, timestamp, publicKey, now).ok;
}
