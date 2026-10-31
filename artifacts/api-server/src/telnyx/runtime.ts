import { waitUntil } from "@vercel/functions";
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

export function startJobs(business: Business) {
  const work = processJobs(storage(), business, { sendSms, notify }).catch(() => {
    // No raw payload, telephone number, message, SQL, or credential in logs.
    logger.error({ event: "telnyx_outbox_needs_review", businessId: business.id });
  });
  // Keep serverless execution alive after the fast webhook acknowledgment.
  if (process.env.VERCEL) waitUntil(work);
  else void work;
}
