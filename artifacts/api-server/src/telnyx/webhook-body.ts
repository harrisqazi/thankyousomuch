import type { Request } from "express";

export type RawBodyResult = { body?: Buffer; reason?: "ok" | "body_not_buffer" | "body_already_parsed" };

/** Vercel may parse JSON before Express if bodyParser is left on. Signature needs original bytes. */
export function rawWebhookBody(req: Request): RawBodyResult {
  const extra = req as Request & { rawBody?: Buffer | string };
  if (Buffer.isBuffer(extra.rawBody)) return { body: extra.rawBody, reason: "ok" };
  if (typeof extra.rawBody === "string") return { body: Buffer.from(extra.rawBody, "utf8"), reason: "ok" };
  if (Buffer.isBuffer(req.body)) return { body: req.body, reason: "ok" };
  if (typeof req.body === "string") return { body: Buffer.from(req.body, "utf8"), reason: "ok" };
  if (req.body && typeof req.body === "object") return { reason: "body_already_parsed" };
  return { reason: "body_not_buffer" };
}
