import { createPublicKey, verify } from "node:crypto";

/** Verify the original bytes for BOTH form-encoded TeXML and JSON messaging. */
export function verifyTelnyx(
  raw: Buffer, signature: string | undefined, timestamp: string | undefined,
  publicKey: string | undefined, now = Date.now(),
): boolean {
  if (!publicKey || !signature || !timestamp || !/^\d{10,12}$/.test(timestamp)
    || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const bytes = Buffer.from(publicKey.trim(), "base64");
    const sig = Buffer.from(signature, "base64");
    if (bytes.length !== 32 || sig.length !== 64) return false;
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), bytes]),
      format: "der", type: "spki",
    });
    return verify(null, Buffer.concat([Buffer.from(timestamp + "|"), raw]), key, sig);
  } catch { return false; }
}
