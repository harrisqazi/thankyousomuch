import { PRODUCTS } from "@workspace/api-zod";

type StandardProductId = (typeof PRODUCTS)[number]["id"];

export type CheckoutPrice = {
  serviceId: StandardProductId;
  name: string;
  monthlyCents: number;
  setupCents: number;
};

export type CheckoutLead = {
  leadId: string;
  serviceId: StandardProductId;
  customerName: string;
  businessName: string;
  email: string;
  phone: string;
  message: string;
};

export class StripeCheckoutError extends Error {
  constructor(public readonly status: number, public readonly stripeCode?: string) {
    super(`Stripe Checkout request failed (${status})`);
    this.name = "StripeCheckoutError";
  }
}

export function stripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY?.trim() || undefined;
}

export function isCheckoutEnabled(): boolean {
  return Boolean(stripeSecretKey());
}

function envName(serviceId: string, kind: "MONTHLY" | "SETUP") {
  return `STRIPE_${serviceId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${kind}_USD`;
}

function usdToCents(raw: string | undefined, fallbackUsd: number): number {
  const value = raw?.trim() ? Number(raw.trim()) : NaN;
  const usd = Number.isFinite(value) && value >= 0 ? value : fallbackUsd;
  return Math.round(usd * 100);
}

/** Catalog prices, overridable per product with e.g. STRIPE_MISSED_CALL_RESCUE_MONTHLY_USD=199. */
export function checkoutPrice(serviceId: string, useOverrides = true): CheckoutPrice | undefined {
  const product = PRODUCTS.find((item) => item.id === serviceId);
  if (!product) return undefined;
  return {
    serviceId: product.id,
    name: product.name,
    monthlyCents: usdToCents(useOverrides ? process.env[envName(product.id, "MONTHLY")] : undefined, product.monthlyPrice),
    setupCents: usdToCents(useOverrides ? process.env[envName(product.id, "SETUP")] : undefined, product.setupPrice),
  };
}

export function checkoutPrices(useOverrides = true): CheckoutPrice[] {
  return PRODUCTS.map((product) => checkoutPrice(product.id, useOverrides)!);
}

/**
 * Live Stripe Payment Links (public URLs, not secrets): menu monthly price plus the
 * one-time setup on the first invoice, redirecting to /checkout/success. Their
 * amounts are fixed in Stripe, so the *_USD overrides only affect Checkout Sessions.
 * Override a link with e.g. STRIPE_MISSED_CALL_RESCUE_PAYMENT_LINK.
 */
export const PAYMENT_LINKS: Record<StandardProductId, string> = {
  "missed-call-rescue": "https://buy.stripe.com/cNi14p0DKagObdYb4z77O02",
  "instant-lead-reply": "https://buy.stripe.com/4gMcN7dqwex44PAgoT77O03",
  "quote-follow-up": "https://buy.stripe.com/dRmfZj5Y43Sqdm68Wr77O04",
  "ai-receptionist": "https://buy.stripe.com/3cIbJ35Y44Wu6XIdcH77O05",
};

export function paymentLinkUrl(serviceId: StandardProductId, email: string, leadId: string): string {
  const envKey = `STRIPE_${serviceId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_PAYMENT_LINK`;
  const url = new URL(process.env[envKey]?.trim() || PAYMENT_LINKS[serviceId]);
  url.searchParams.set("prefilled_email", email);
  url.searchParams.set("client_reference_id", leadId);
  return url.toString();
}

export function siteUrl(): string {
  return (process.env.PUBLIC_SITE_URL?.trim() || "https://www.thankyousomuch.ai").replace(/\/+$/, "");
}

function clip(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function checkoutSessionParams(lead: CheckoutLead, price: CheckoutPrice, baseUrl = siteUrl()): URLSearchParams {
  const metadata: Record<string, string> = {
    lead_id: lead.leadId,
    service_id: lead.serviceId,
    customer_name: clip(lead.customerName),
    business_name: clip(lead.businessName),
    email: clip(lead.email),
    phone: clip(lead.phone),
    message: clip(lead.message),
  };
  const params = new URLSearchParams({
    mode: "subscription",
    customer_email: lead.email,
    client_reference_id: lead.leadId,
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout/cancel`,
    billing_address_collection: "auto",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(price.monthlyCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `${price.name} (monthly)`,
  });
  if (price.setupCents > 0) {
    // One-time prices in subscription mode are billed once, on the first invoice.
    params.set("line_items[1][quantity]", "1");
    params.set("line_items[1][price_data][currency]", "usd");
    params.set("line_items[1][price_data][unit_amount]", String(price.setupCents));
    params.set("line_items[1][price_data][product_data][name]", `${price.name} one-time setup`);
  }
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
    params.set(`subscription_data[metadata][${key}]`, value);
  }
  return params;
}

export async function createCheckoutSession(lead: CheckoutLead, price: CheckoutPrice): Promise<{ id: string; url: string }> {
  const key = stripeSecretKey();
  if (!key) throw new StripeCheckoutError(0, "not_configured");
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout-${lead.leadId}`,
    },
    body: checkoutSessionParams(lead, price),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    url?: string;
    error?: { code?: string; type?: string };
  };
  if (!response.ok || !body.id || !body.url) {
    throw new StripeCheckoutError(response.status, body.error?.code ?? body.error?.type);
  }
  return { id: body.id, url: body.url };
}
