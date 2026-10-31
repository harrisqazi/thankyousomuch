import type { LeadDetails } from "./state";

/** Only explicit labels are extracted; keep the original message separately. */
export function updateLead(previous: LeadDetails, text: string): LeadDetails {
  const lead = { ...previous };
  const labels = /(?:^|[;\n,])\s*(name|business|callback|preferred call\s?back number)\s*:\s*([^;\n,]+)/gi;
  for (const match of text.matchAll(labels)) {
    const value = match[2].trim().slice(0, 200);
    if (!value) continue;
    const label = match[1].toLowerCase();
    if (label === "name") lead.customerName = value;
    else if (label === "business") lead.businessName = value;
    else {
      const digits = value.replace(/\D/g, "");
      // Preserve the supplied formatting; never mistake arbitrary prose for a phone.
      if (/^[+\d().\s-]+$/.test(value) && digits.length >= 7 && digits.length <= 15) {
        lead.preferredCallbackNumber = value;
      }
    }
  }
  return lead;
}

export function leadSummary(lead: LeadDetails): string {
  return [
    `Originating phone number: ${lead.originatingNumber}`,
    `Name: ${lead.customerName || "Not provided yet"}`,
    `Business name: ${lead.businessName || "Not provided yet"}`,
    `Preferred callback number: ${lead.preferredCallbackNumber || "Not provided yet"}`,
  ].join("\n");
}
