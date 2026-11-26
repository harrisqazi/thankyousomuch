import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutPrice, checkoutSessionParams, PAYMENT_LINKS, paymentLinkUrl } from "./stripe-checkout";
import { bookingConfirmedText } from "../telnyx/sms-booking";

test("checkout prices default to the menu and can be overridden by env", () => {
  assert.deepEqual(checkoutPrice("ai-receptionist"), {
    serviceId: "ai-receptionist",
    name: "24/7 AI Receptionist",
    monthlyCents: 44900,
    setupCents: 49900,
  });
  process.env.STRIPE_MISSED_CALL_RESCUE_MONTHLY_USD = "149.50";
  process.env.STRIPE_MISSED_CALL_RESCUE_SETUP_USD = "nope";
  try {
    const price = checkoutPrice("missed-call-rescue")!;
    assert.equal(price.monthlyCents, 14950);
    assert.equal(price.setupCents, 19900);
  } finally {
    delete process.env.STRIPE_MISSED_CALL_RESCUE_MONTHLY_USD;
    delete process.env.STRIPE_MISSED_CALL_RESCUE_SETUP_USD;
  }
  assert.equal(checkoutPrice("custom-ai-integration"), undefined);
});

test("one subscription session bills setup once and carries the lead", () => {
  const params = checkoutSessionParams({
    leadId: "lead-1",
    serviceId: "quote-follow-up",
    customerName: "Pat",
    businessName: "Pat's Plumbing",
    email: "pat@example.com",
    phone: "(555) 555-0100",
    message: "x".repeat(900),
  }, checkoutPrice("quote-follow-up")!, "https://example.test");
  assert.equal(params.get("mode"), "subscription");
  assert.equal(params.get("customer_email"), "pat@example.com");
  assert.equal(params.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(params.get("line_items[0][price_data][unit_amount]"), "29900");
  assert.equal(params.get("line_items[1][price_data][unit_amount]"), "29900");
  assert.equal(params.get("line_items[1][price_data][recurring][interval]"), null);
  assert.equal(params.get("metadata[business_name]"), "Pat's Plumbing");
  assert.equal(params.get("subscription_data[metadata][lead_id]"), "lead-1");
  assert.equal(params.get("metadata[message]")!.length, 500);
  assert.equal(params.get("success_url"), "https://example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}");
});

test("booking confirmation SMS links to checkout and keeps STOP/HELP", () => {
  const text = bookingConfirmedText({ id: "1", label: "Mon, Nov 30, 10:00 AM EST", at: "2026-11-30T15:00:00.000Z" });
  assert.match(text, /https:\/\/www\.thankyousomuch\.ai\/start/);
  assert.match(text, /Reply STOP to opt out, HELP for help\./);
});

test("payment link fallback prefills email and carries the lead id", () => {
  const url = new URL(paymentLinkUrl("ai-receptionist", "pat+qa@example.com", "4d7764c3-34d4-4c19-84c0-9ce5cf536d8b"));
  assert.equal(url.origin, "https://buy.stripe.com");
  assert.equal(url.searchParams.get("prefilled_email"), "pat+qa@example.com");
  assert.equal(url.searchParams.get("client_reference_id"), "4d7764c3-34d4-4c19-84c0-9ce5cf536d8b");
  assert.equal(Object.keys(PAYMENT_LINKS).length, 4);
});
