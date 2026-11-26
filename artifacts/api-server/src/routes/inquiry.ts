import { Router, type IRouter, type RequestHandler } from "express";
import {
  getProduct,
  SendInquiryBody,
  SendInquiryResponse,
  type ProductId,
} from "@workspace/api-zod";
import { InquirySaveError, recordInquiry, singleLine } from "../lib/record-inquiry";

const router: IRouter = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const requestBuckets = new Map<string, { startedAt: number; count: number }>();
let requestsSincePrune = 0;

export const inquiryRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const address = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const bucket = requestBuckets.get(address);

  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(address, { startedAt: now, count: 1 });
  } else if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.startedAt)) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Please wait a few minutes before sending another message.",
    });
    return;
  } else {
    bucket.count += 1;
  }

  requestsSincePrune += 1;
  if (requestsSincePrune >= 100) {
    requestsSincePrune = 0;
    for (const [key, entry] of requestBuckets) {
      if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) {
        requestBuckets.delete(key);
      }
    }
  }
  next();
};

router.post("/inquiry", inquiryRateLimit, async (req, res): Promise<void> => {
  const parsed = SendInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check the inquiry details and try again." });
    return;
  }

  const input = parsed.data;
  if (input.website.trim()) {
    res.status(400).json({ error: "Invalid inquiry." });
    return;
  }

  const customerName = singleLine(input.name);
  const businessName = singleLine(input.businessName);
  const email = input.email.trim();
  if (!customerName || !businessName || !email) {
    res.status(400).json({ error: "Name, business, and email are required." });
    return;
  }

  const product = getProduct(input.serviceId as ProductId);
  if (!product) {
    res.status(400).json({ error: "Please select a valid service." });
    return;
  }

  let inquiry;
  try {
    inquiry = await recordInquiry(req, {
      serviceId: product.id,
      customerName,
      businessName,
      email,
      phone: singleLine(input.phone),
      message: input.message.replace(/\u0000/g, "").trim(),
    });
  } catch (error) {
    if (!(error instanceof InquirySaveError)) throw error;
    res.status(503).json({
      error: "We couldn't save your message. It has not been submitted. Please try again.",
    });
    return;
  }
  res.status(202).json(SendInquiryResponse.parse({
    accepted: true,
    referenceId: inquiry.id,
    emailStatus: inquiry.emailNotification.status,
  }));
});

export default router;
