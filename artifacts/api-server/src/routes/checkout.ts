import { Router, type IRouter } from "express";
import { inquiryRateLimit } from "./inquiry";
import { InquirySaveError, recordInquiry, singleLine } from "../lib/record-inquiry";
import {
  checkoutPrice,
  checkoutPrices,
  createCheckoutSession,
  isCheckoutEnabled,
  paymentLinkUrl,
  StripeCheckoutError,
} from "../lib/stripe-checkout";

const router: IRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/checkout-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const sessions = isCheckoutEnabled();
  res.json({
    enabled: true,
    mode: sessions ? "session" : "payment_link",
    prices: checkoutPrices(sessions).map(({ serviceId, monthlyCents, setupCents }) => ({ serviceId, monthlyCents, setupCents })),
  });
});

function field(body: Record<string, unknown>, name: string, max: number): string {
  const value = body[name];
  return typeof value === "string" ? value.slice(0, max) : "";
}

router.post("/checkout", inquiryRateLimit, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (field(body, "website", 200).trim()) {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  const customerName = singleLine(field(body, "name", 100));
  const businessName = singleLine(field(body, "businessName", 120));
  const email = field(body, "email", 254).trim();
  const phone = singleLine(field(body, "phone", 50));
  const message = field(body, "message", 4000).replace(/\u0000/g, "").trim();
  if (!customerName || !businessName || !email || !phone || !message) {
    res.status(400).json({ error: "Please fill in every field." });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (phone.replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Please enter a phone number with area code." });
    return;
  }
  const price = checkoutPrice(field(body, "serviceId", 80));
  if (!price) {
    res.status(400).json({ error: "Please choose a service." });
    return;
  }

  let inquiry;
  try {
    inquiry = await recordInquiry(req, {
      serviceId: price.serviceId,
      customerName,
      businessName,
      email,
      phone,
      message: `[Ready to move forward — sent to checkout]\n${message}`,
    });
  } catch (error) {
    if (!(error instanceof InquirySaveError)) throw error;
    res.status(503).json({
      error: "We couldn't save your details. Nothing was submitted. Please try again.",
    });
    return;
  }

  const fallbackUrl = paymentLinkUrl(price.serviceId, email, inquiry.id);
  if (!isCheckoutEnabled()) {
    res.status(201).json({ accepted: true, referenceId: inquiry.id, checkoutUrl: fallbackUrl, mode: "payment_link" });
    return;
  }
  try {
    const session = await createCheckoutSession({
      leadId: inquiry.id,
      serviceId: price.serviceId,
      customerName,
      businessName,
      email,
      phone,
      message,
    }, price);
    req.log.info({ inquiryId: inquiry.id, checkoutSessionId: session.id }, "Stripe Checkout session created");
    res.status(201).json({ accepted: true, referenceId: inquiry.id, checkoutUrl: session.url, mode: "session" });
  } catch (error) {
    req.log.error(
      {
        inquiryId: inquiry.id,
        stripeStatus: error instanceof StripeCheckoutError ? error.status : undefined,
        stripeCode: error instanceof StripeCheckoutError ? error.stripeCode : undefined,
      },
      "Stripe Checkout session failed",
    );
    res.status(201).json({ accepted: true, referenceId: inquiry.id, checkoutUrl: fallbackUrl, mode: "payment_link" });
  }
});

export default router;
