import express, { Router, type Request, type Response, type NextFunction } from "express";
import { verifyTelnyx } from "./auth";
import { businesses, liveSending } from "./config";
import { DemoError, incomingCall, recordSelection, recordMessage, messagingInput, voiceInput } from "./service";
import { storage } from "./storage";
import { startJobs as startRuntimeJobs } from "./runtime";
import { logger } from "../lib/logger";

// Tests inject a no-op dispatcher so signed synthetic requests cannot email or text.
export function createTelnyxRouter(startJobs: typeof startRuntimeJobs = startRuntimeJobs) {
const telnyxRouter = Router();

telnyxRouter.get("/health", async (_req, res): Promise<void> => {
  let storageReady = false;
  try { storageReady = await storage().health(); } catch { /* report unavailable without exposing credentials */ }
  const configured = businesses();
  const outboundSmsEnabled = liveSending() && configured.some(business => business.outboundSmsApproved);
  res.set("Cache-Control", "no-store").json({
    service: "tysm-telnyx-demo", storageReady,
    storageBackend: process.env.TELNYX_STORAGE_BACKEND || "postgres",
    webhookVerificationConfigured: Boolean(process.env.TELNYX_PUBLIC_KEY),
    outboundSmsEnabled,
    mode: outboundSmsEnabled ? "live" : "dry_run",
    configuredBusinessCount: configured.length,
    approvedBusinessCount: configured.filter(business => business.outboundSmsApproved).length,
    // This endpoint reports readiness, not proof of a successful live call.
  });
});
const raw = express.raw({ type: ["application/json", "application/x-www-form-urlencoded"], limit: "64kb" });
function authenticated(req: Request, res: Response, next: NextFunction) {
  if (!process.env.TELNYX_PUBLIC_KEY) {
    res.status(503).json({ error: "Webhook verification is not configured" }); return;
  }
  if (!Buffer.isBuffer(req.body) || !verifyTelnyx(req.body,
    req.get("telnyx-signature-ed25519"), req.get("telnyx-timestamp"), process.env.TELNYX_PUBLIC_KEY)) {
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
  const xml = await incomingCall(storage(), findBusiness(input.To), input);
  res.type("application/xml").send(xml);
});
telnyxRouter.post("/voice/selection", raw, authenticated, async (req, res): Promise<void> => {
  const input = form(req), business = findBusiness(input.To);
  const xml = await recordSelection(storage(), business, input);
  startJobs(business);
  res.type("application/xml").send(xml);
});
telnyxRouter.post("/webhooks/telnyx/messaging", raw, authenticated, async (req, res): Promise<void> => {
  if (!req.is("application/json")) throw new DemoError(415, "Expected JSON");
  let parsed: unknown;
  try { parsed = JSON.parse((req.body as Buffer).toString("utf8")); }
  catch { throw new DemoError(400, "Invalid JSON"); }
  const event = messagingInput(parsed), payload = event.data.payload;
  const number = event.data.event_type === "message.received"
    ? payload.to[0].phone_number : payload.from.phone_number;
  const business = findBusiness(number);
  // Persist consent/opt-out/message and its notification job BEFORE 2xx.
  await recordMessage(storage(), business, event);
  startJobs(business);
  res.sendStatus(200);
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
