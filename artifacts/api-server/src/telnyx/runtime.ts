import { sendInquiryEmail } from "../lib/inquiry-email";
import { logger } from "../lib/logger";
import type { Business } from "./config";
import { storage } from "./storage";
import { processJobs, sendSms } from "./worker";
import type { Job } from "./state";

export async function notify(business: Business, job: Job) {
  await sendInquiryEmail({
    productName: "PHONE / SMS DEMO",
    monthlyPrice: "Not applicable", setupPrice: "Not applicable",
    customerName: job.lead?.customerName || "Not provided yet",
    businessName: job.lead?.businessName || "Not provided yet",
    originatingNumber: job.lead?.originatingNumber || job.caller,
    preferredCallbackNumber: job.lead?.preferredCallbackNumber || "Not provided yet",
    email: business.recipient, phone: job.caller, message: job.text,
  }, business.recipient);
}

export async function startJobs(business: Business, store: ReturnType<typeof storage> = storage()) {
  const onFail = () => {
    // No raw payload, telephone number, message, SQL, or credential in logs.
    logger.error({ event: "telnyx_outbox_needs_review", businessId: business.id });
  };
  // Express-on-Vercel often drops waitUntil after 2xx. Send SMS before acknowledging
  // so HI/HELLO/HEY replies actually leave Telnyx. Email can finish in the background.
  const sms = await processJobs(store, business, { sendSms, notify, kinds: ["sms"] }).catch(() => {
    onFail();
    return { smsSends: [{ status: "uncertain" as const, error: "outbox_failed" }] };
  });
  await processJobs(store, business, { sendSms, notify, kinds: ["email"] }).catch(onFail);
  return sms;
}
