import { createTransport } from "nodemailer";
import { inquiryRecipient } from "./inquiry-backup";
import { createSentArchive, sendMailAndArchive } from "./sent-mail.mjs";
import { logger } from "./logger";

export type InquiryEmail = {
  productName: string;
  monthlyPrice: string;
  setupPrice: string;
  customerName: string;
  businessName: string;
  email: string;
  phone: string;
  message: string;
};

export class InquiryEmailError extends Error {
  constructor(
    public readonly reason: "configuration" | "delivery" | "rejected",
    public readonly smtpCode?: string,
    public readonly configurationField?: string,
  ) {
    super(reason);
    this.name = "InquiryEmailError";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendInquiryEmail(inquiry: InquiryEmail): Promise<void> {
  const host = process.env.SMTP_HOST?.trim() || "mail.privateemail.com";
  const portValue = process.env.SMTP_PORT?.trim() || "465";
  const tysmPassword = process.env.TYSM_SMTP_PASSWORD;
  const user = tysmPassword
    ? "admin@thankyousomuch.ai"
    : process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const rawPass =
    tysmPassword || process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
  // Only Gmail App Passwords use display spaces. Other providers' passwords
  // must be passed through unchanged.
  const pass = host.toLowerCase() === "smtp.gmail.com"
    ? rawPass.replace(/\s+/g, "")
    : rawPass;
  const from = tysmPassword
    ? "TYSM <admin@thankyousomuch.ai>"
    : process.env.SMTP_FROM?.trim() || user;
  const to = inquiryRecipient();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const port = Number(portValue);

  const subjectBusiness = inquiry.businessName.replace(/[\r\n]+/g, " ").trim();
  const subject = `NEW LEAD — ${inquiry.productName} — ${subjectBusiness}`;
  const timestamp = new Date().toISOString();
  const rows: Array<[string, string]> = [
    ["Product selected", inquiry.productName],
    ["Monthly price", inquiry.monthlyPrice],
    ["Setup price", inquiry.setupPrice],
    ["Customer name", inquiry.customerName],
    ["Business", inquiry.businessName],
    ["Email", inquiry.email],
    ["Phone", inquiry.phone || "Not provided"],
    ["Customer message", inquiry.message || "Not provided"],
    ["Submitted", timestamp],
  ];
  const text = [
    subject,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top" style="padding:10px 16px 10px 0;color:#8a3a36;font-weight:600;border-bottom:1px dotted #d8b9a7">${escapeHtml(label)}</th><td style="padding:10px 0;border-bottom:1px dotted #d8b9a7;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#fff7ec;color:#161616;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto"><p style="margin:0 0 8px;color:#cd1725;font-size:12px;font-weight:bold;letter-spacing:2px">THANK YOU SO MUCH. · NEW INQUIRY</p><h1 style="margin:0 0 24px;color:#cd1725;font-size:28px">${escapeHtml(subject)}</h1><table style="width:100%;border-collapse:collapse;font-size:15px">${htmlRows}</table></main></body></html>`;

  let smtpFailure: InquiryEmailError | undefined;

  if (user && pass) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      smtpFailure = new InquiryEmailError(
        "configuration",
        undefined,
        "SMTP_PORT (must be a number from 1 to 65535)",
      );
    } else {
      const transporter = createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user, pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: { minVersion: "TLSv1.2" },
      });
      const archive = createSentArchive({ user, password: pass });

      try {
        const result = await sendMailAndArchive(transporter, {
          from,
          to,
          replyTo: inquiry.email,
          subject,
          text,
          html,
        }, {
          archive,
          onArchiveError: () => logger.warn(
            { event: "inquiry_sent_copy_failed" },
            "SMTP accepted inquiry notification, but its Sent copy could not be saved; do not resend",
          ),
        });
        const accepted = (result.accepted || []).some(
          (recipient: string) => recipient.toLowerCase() === to.toLowerCase(),
        );
        if (accepted) return;
        smtpFailure = new InquiryEmailError("rejected");
      } catch (error) {
        const smtpCode =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : undefined;
        smtpFailure = new InquiryEmailError("delivery", smtpCode);
      } finally {
        transporter.close();
        await archive.close();
      }
    }
  }

  // Match Frame of Reference's second delivery path: only use Resend when it
  // has been explicitly configured for this Vercel project.
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM?.trim() ||
            "Thank You So Much <onboarding@resend.dev>",
          to: [to],
          reply_to: inquiry.email,
          subject,
          text,
          html,
        }),
      });
      if (response.ok) return;
      smtpFailure = new InquiryEmailError(
        "delivery",
        `RESEND_HTTP_${response.status}`,
      );
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        typeof error.cause === "object" &&
        error.cause !== null &&
        "code" in error.cause &&
        typeof error.cause.code === "string"
          ? error.cause.code
          : "RESEND_NETWORK_ERROR";
      smtpFailure = new InquiryEmailError("delivery", code);
    }
  }

  if (smtpFailure) throw smtpFailure;
  if (!user) {
    throw new InquiryEmailError(
      "configuration",
      undefined,
      "SMTP_USER or GMAIL_USER",
    );
  }
  if (!pass) {
    throw new InquiryEmailError(
      "configuration",
      undefined,
      "SMTP_PASS or GMAIL_APP_PASSWORD",
    );
  }
  throw new InquiryEmailError(
    "configuration",
    undefined,
    "RESEND_API_KEY (fallback) or valid Gmail SMTP settings",
  );
}
