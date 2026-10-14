import { createTransport } from "nodemailer";

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

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new InquiryEmailError("configuration", undefined, name);
  }
  return value;
}

export async function sendInquiryEmail(inquiry: InquiryEmail): Promise<void> {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const portValue = process.env.SMTP_PORT?.trim() || "465";
  const user = requiredSetting("SMTP_USER");
  const pass = requiredSetting("SMTP_PASS");
  const from = process.env.SMTP_FROM?.trim() || user;
  const to =
    process.env.LEAD_TO_EMAIL?.trim() || requiredSetting("NOTIFY_EMAIL");
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InquiryEmailError("configuration", undefined, "SMTP_PORT (must be a number from 1 to 65535)");
  }

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
  const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#fff7ec;color:#161616;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto"><p style="margin:0 0 8px;color:#cd1725;font-size:12px;font-weight:bold;letter-spacing:2px">GOOD WORK. · NEW INQUIRY</p><h1 style="margin:0 0 24px;color:#cd1725;font-size:28px">${escapeHtml(subject)}</h1><table style="width:100%;border-collapse:collapse;font-size:15px">${htmlRows}</table></main></body></html>`;

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

  try {
    const result = await transporter.sendMail({
      from,
      to,
      replyTo: inquiry.email,
      subject,
      text,
      html,
    });
    const accepted = result.accepted.some(
      (recipient) => recipient.toLowerCase() === to.toLowerCase(),
    );
    if (!accepted) {
      throw new InquiryEmailError("rejected");
    }
  } catch (error) {
    if (error instanceof InquiryEmailError) {
      throw error;
    }
    const smtpCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    throw new InquiryEmailError("delivery", smtpCode);
  } finally {
    transporter.close();
  }
}
