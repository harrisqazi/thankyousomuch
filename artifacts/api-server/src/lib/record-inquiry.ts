import type { Request } from "express";
import { CUSTOM_PRODUCT, formatUsd, getProduct, type ProductId } from "@workspace/api-zod";
import { InquiryEmailError, sendInquiryEmail } from "./inquiry-email";
import { createInquiryBackup, saveInquiryBackup, type InquiryBackup } from "./inquiry-backup";

export type InquiryInput = {
  serviceId: ProductId;
  customerName: string;
  businessName: string;
  email: string;
  phone: string;
  message: string;
};

export class InquirySaveError extends Error {}

export function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Durably saves the lead, then emails the team. Throws InquirySaveError only if nothing was saved. */
export async function recordInquiry(req: Request, input: InquiryInput): Promise<InquiryBackup> {
  const product = getProduct(input.serviceId);
  if (!product) throw new Error("Unknown product");

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
    customerName: input.customerName,
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    message: input.message,
  }, product.id);

  try {
    await saveInquiryBackup(inquiry);
  } catch {
    req.log.error({ inquiryId: inquiry.id }, "Inquiry JSON backup failed");
    throw new InquirySaveError();
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
  return inquiry;
}
