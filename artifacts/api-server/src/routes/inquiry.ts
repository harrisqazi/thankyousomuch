import { Router, type IRouter, type RequestHandler } from "express";
import {
  CUSTOM_PRODUCT,
  formatUsd,
  getProduct,
  SendInquiryBody,
  SendInquiryResponse,
  type ProductId,
} from "@workspace/api-zod";
import {
  InquiryEmailError,
  sendInquiryEmail,
} from "../lib/inquiry-email";
import { createInquiryBackup, saveInquiryBackup } from "../lib/inquiry-backup";

const router: IRouter = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const requestBuckets = new Map<string, { startedAt: number; count: number }>();
let requestsSincePrune = 0;

const inquiryRateLimit: RequestHandler = (req, res, next) => {
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

function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

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

  const isCustom = product.id === CUSTOM_PRODUCT.id;
  const monthlyPrice =
    isCustom || !("monthlyPrice" in product)
      ? "Custom quote"
      : `${formatUsd(product.monthlyPrice)}/month`;
  const setupPrice =
    isCustom || !("setupPrice" in product)
      ? "Custom quote"
      : `${formatUsd(product.setupPrice)} one-time setup`;

  const inquiry = createInquiryBackup({
      productName: product.name,
      monthlyPrice,
      setupPrice,
      customerName,
      businessName,
      email,
      phone: singleLine(input.phone),
      message: input.message.replace(/\u0000/g, "").trim(),
    }, product.id);

  try {
    await saveInquiryBackup(inquiry);
  } catch {
    req.log.error({ inquiryId: inquiry.id }, "Inquiry JSON backup failed");
    res.status(503).json({
      error: "We couldn't save your message. It has not been submitted. Please try again.",
    });
    return;
  }

  try {
    await sendInquiryEmail(inquiry);
    inquiry.emailNotification.status = "accepted";
  } catch (error) {
    inquiry.emailNotification.status = "failed";
    if (error instanceof InquiryEmailError) {
      req.log.error(
        {
          deliveryReason: error.reason,
          smtpCode: error.smtpCode,
          configurationField: error.configurationField,
        },
        "Inquiry email delivery failed",
      );
    } else {
      req.log.error("Inquiry email delivery failed");
    }
  }
  inquiry.emailNotification.updatedAt = new Date().toISOString();
  try {
    await saveInquiryBackup(inquiry, true);
  } catch {
    // The initial immutable lead data is already durable. Never ask a visitor
    // to resubmit merely because the notification-status update failed.
    req.log.error({ inquiryId: inquiry.id }, "Inquiry notification status backup failed");
  }
  res.status(202).json(SendInquiryResponse.parse({
    accepted: true,
    referenceId: inquiry.id,
    emailStatus: inquiry.emailNotification.status,
  }));
});

export default router;
