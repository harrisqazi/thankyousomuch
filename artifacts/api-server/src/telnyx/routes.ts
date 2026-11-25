import express, { Router, type Request, type Response, type NextFunction } from "express";
import { verifyTelnyxDiagnose } from "./auth";
import { businesses, liveSending } from "./config";
import { DemoError, incomingCall, recordSelection, recordMessage, messagingInput, voiceInput } from "./service";
import { storage } from "./storage";
import { startJobs as startRuntimeJobs } from "./runtime";
import { logger } from "../lib/logger";
import { rawWebhookBody } from "./webhook-body";
import { appendInboundAudit, listInboundAudit, maskPhone, textPrefix } from "./inbound-audit";

// Tests inject a no-op dispatcher so signed synthetic requests cannot email or text.
export function publicHandlerError(error: unknown): string {
  if (error instanceof DemoError) return error.message.slice(0, 120);
  if (!(error instanceof Error)) return "handler_failed";
  const msg = error.message.replace(/\+?\d{10,}/g, "***").slice(0, 120);
  if (/KEY01|sk_live|BEGIN [A-Z]+ PRIVATE/i.test(msg)) return `${error.name}: redacted`;
  return `${error.name}: ${msg}`.slice(0, 160);
}

export function createTelnyxRouter(
  startJobs: typeof startRuntimeJobs = startRuntimeJobs,
  getStore: typeof storage = storage,
) {
const telnyxRouter = Router();

telnyxRouter.get("/health", async (_req, res): Promise<void> => {
  let storageReady = false;
  try { storageReady = await storage().health(); } catch { /* report unavailable without exposing credentials */ }
  const configured = businesses();
  const outboundSmsEnabled = liveSending() && configured.some(business => business.outboundSmsApproved);
  let outboundKeyAccepted: boolean | "unknown" = false;
  if (process.env.TELNYX_API_KEY) {
    try {
      const probe = await fetch("https://api.telnyx.com/v2/messaging_profiles?page[size]=1", {
        headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
        signal: AbortSignal.timeout(4000),
      });
      outboundKeyAccepted = probe.status === 401 || probe.status === 403 ? false : probe.ok;
    } catch {
      outboundKeyAccepted = "unknown";
    }
  }
  res.set("Cache-Control", "no-store").json({
    service: "tysm-telnyx-demo", storageReady,
    storageBackend: process.env.TELNYX_STORAGE_BACKEND || "postgres",
    webhookVerificationConfigured: Boolean(process.env.TELNYX_PUBLIC_KEY),
    outboundSmsEnabled,
    outboundKeyAccepted,
    mode: outboundSmsEnabled ? "live" : "dry_run",
    configuredBusinessCount: configured.length,
    approvedBusinessCount: configured.filter(business => business.outboundSmsApproved).length,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    // This endpoint reports readiness, not proof of a successful live call.
  });
});
telnyxRouter.get("/health/inbound", async (_req, res): Promise<void> => {
  const inbound = await listInboundAudit().catch(() => []);
  res.set("Cache-Control", "no-store").json({
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    inbound,
    count: inbound.length,
  });
});
const raw = express.raw({ type: ["application/json", "application/x-www-form-urlencoded"], limit: "64kb" });
function peekMessaging(body: Buffer | undefined, parsedBody: unknown) {
  try {
    const parsed = body ? JSON.parse(body.toString("utf8")) : parsedBody;
    const payload = parsed?.data?.payload || parsed?.payload || {};
    const from = payload.from?.phone_number || payload.from;
    const to = Array.isArray(payload.to) ? (payload.to[0]?.phone_number || payload.to[0]) : payload.to;
    return {
      eventType: parsed?.data?.event_type || parsed?.event_type,
      from: maskPhone(from),
      to: maskPhone(to),
      textPrefix: textPrefix(payload.text || payload.body),
    };
  } catch {
    return {};
  }
}
async function persistAudit(entry: Record<string, unknown>) {
  await appendInboundAudit({
    at: new Date().toISOString(),
    bodyKind: String(entry.bodyKind || "unknown"),
    signatureOk: Boolean(entry.signatureOk),
    signatureReason: String(entry.signatureReason || "unknown"),
    eventType: entry.eventType as string | undefined,
    from: entry.from as string | undefined,
    to: entry.to as string | undefined,
    textPrefix: entry.textPrefix as string | undefined,
    greetingMatched: entry.greetingMatched as boolean | undefined,
    jobQueued: entry.jobQueued as boolean | undefined,
    sendStatus: entry.sendStatus as string | undefined,
    sendError: entry.sendError as string | undefined,
    httpStatus: entry.httpStatus as number | undefined,
  }).catch(() => undefined);
}

async function authenticated(req: Request, res: Response, next: NextFunction) {
  const extracted = rawWebhookBody(req);
  if (extracted.body) req.body = extracted.body;
  if (!process.env.TELNYX_PUBLIC_KEY) {
    res.status(503).json({ error: "Webhook verification is not configured" }); return;
  }
  if (!extracted.body) {
    const audit = {
      bodyKind: extracted.reason || "body_not_buffer",
      signatureOk: false,
      signatureReason: extracted.reason || "body_not_buffer",
      httpStatus: 403,
      ...peekMessaging(undefined, req.body),
    };
    res.locals.inboundAudit = audit;
    await persistAudit(audit);
    res.status(403).json({ error: "Invalid webhook signature or timestamp" }); return;
  }
  const diagnosed = verifyTelnyxDiagnose(
    extracted.body,
    req.get("telnyx-signature-ed25519"),
    req.get("telnyx-timestamp"),
    process.env.TELNYX_PUBLIC_KEY,
  );
  const audit = {
    bodyKind: extracted.reason || "ok",
    signatureOk: diagnosed.ok,
    signatureReason: diagnosed.reason,
    ...peekMessaging(extracted.body, undefined),
  };
  res.locals.inboundAudit = audit;
  if (!diagnosed.ok) {
    await persistAudit({ ...audit, httpStatus: 403 });
    res.status(403).json({ error: "Invalid webhook signature or timestamp" }); return;
  }
  next();
}
function form(req: Request) {
  if (!req.is("application/x-www-form-urlencoded")) throw new DemoError(415, "Expected form data");
  const params = new URLSearchParams((req.body as Buffer).toString("utf8"));
  const entries = [...params.entries()];
  if (new Set(entries.map(([k]) => k)).size !== entries.length) throw new DemoError(400, "Duplicate form fields");
  return voiceInput(Object.fromEntries(entries));
}
function findBusiness(number: string) {
  const business = businesses().find(b => b.number === number);
  if (!business) throw new DemoError(404, "No enabled business for this number");
  return business;
}
telnyxRouter.post("/voice/incoming", raw, authenticated, async (req, res): Promise<void> => {
  const input = form(req);
  const xml = await incomingCall(getStore(), findBusiness(input.To), input);
  res.type("application/xml").send(xml);
});
telnyxRouter.post("/voice/selection", raw, authenticated, async (req, res): Promise<void> => {
  const input = form(req), business = findBusiness(input.To);
  const xml = await recordSelection(getStore(), business, input);
  await startJobs(business);
  res.type("application/xml").send(xml);
});
telnyxRouter.post("/webhooks/telnyx/messaging", raw, authenticated, async (req, res): Promise<void> => {
  const audit = { ...(res.locals.inboundAudit || {}) };
  try {
    if (!Buffer.isBuffer(req.body)) throw new DemoError(415, "Expected JSON");
    let parsed: unknown;
    try { parsed = JSON.parse((req.body as Buffer).toString("utf8")); }
    catch { throw new DemoError(400, "Invalid JSON"); }
    const event = messagingInput(parsed), payload = event.data.payload;
    const inbound = event.data.event_type === "message.received";
    const configured = businesses();
    const number = inbound
      ? (payload.to.map(entry => entry.phone_number).find(n => configured.some(b => b.number === n))
        || payload.to[0].phone_number)
      : payload.from.phone_number;
    const business = findBusiness(number);
    await persistAudit({
      ...audit,
      eventType: event.data.event_type,
      httpStatus: 202,
    });
    const recorded = await recordMessage(getStore(), business, event);
    const sends = inbound ? await startJobs(business, getStore()) : undefined;
    const send = sends?.smsSends?.[0];
    await persistAudit({
      ...audit,
      eventType: event.data.event_type,
      greetingMatched: recorded.greetingMatched,
      jobQueued: recorded.jobQueued,
      sendStatus: send?.status,
      sendError: send?.error,
      httpStatus: 200,
    });
    res.sendStatus(200);
  } catch (error) {
    const status = error instanceof DemoError ? error.status : 503;
    await persistAudit({ ...audit, httpStatus: status, sendError: publicHandlerError(error) });
    throw error;
  }
});
telnyxRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof DemoError) {
    res.status(error.status).json({ error: error.message }); return;
  }
  logger.error({ event: "telnyx_request_failed" });
  res.status(503).json({ error: "Demo could not safely store this request; retry later" });
});
return telnyxRouter;
}
export const telnyxRouter = createTelnyxRouter();
