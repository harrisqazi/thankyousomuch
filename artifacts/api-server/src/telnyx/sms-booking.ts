import type { LeadDetails } from "./state";

export const SMS_DISCLOSURE =
  "Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

export const inboundGreetingText =
  "Looking to recuperate your lost leads? Tell us your name and number and we'll book a call as soon as possible. "
  + SMS_DISCLOSURE;

export type OfferedSlot = { id: "1" | "2" | "3"; label: string; at: string };

function easternParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
  };
}

function atEastern(year: number, month: number, day: number, hour: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 5, 0, 0));
  const shown = easternParts(guess);
  const deltaHours = shown.hour - hour + (shown.day !== day ? (shown.day > day ? 24 : -24) : 0);
  return new Date(guess.getTime() - deltaHours * 3_600_000);
}

function addDays(year: number, month: number, day: number, extra: number) {
  const utc = new Date(Date.UTC(year, month - 1, day + extra));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate(), weekday: utc.getUTCDay() };
}

export function offerSlots(now = new Date()): OfferedSlot[] {
  const start = easternParts(now);
  const hours = [10, 14, 10];
  const slots: OfferedSlot[] = [];
  let offset = start.hour >= 16 ? 1 : 0;
  while (slots.length < 3) {
    const date = addDays(start.year, start.month, start.day, offset);
    if (date.weekday !== 0 && date.weekday !== 6) {
      const hour = hours[slots.length];
      const at = atEastern(date.year, date.month, date.day, hour);
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(at);
      slots.push({ id: String(slots.length + 1) as OfferedSlot["id"], label, at: at.toISOString() });
    }
    offset += 1;
  }
  return slots;
}

export function slotPrompt(slots: OfferedSlot[]): string {
  const lines = slots.map(slot => `${slot.id}) ${slot.label}`);
  return "Thank you, please select one of the following times:\n"
    + lines.join("\n")
    + "\nReply 1, 2, or 3. "
    + SMS_DISCLOSURE;
}

export function bookingConfirmedText(slot: OfferedSlot): string {
  return `You're booked for ${slot.label}. Our team will follow up at that time. ${SMS_DISCLOSURE}`;
}

export function isGreeting(text: string): boolean {
  return /^(hi|hello|hey)([\s!.?,]|$)(.*)?$/i.test(text.trim())
    && /^(hi|hello|hey)\b/i.test(text.trim());
}

export function isGreetingOnly(text: string): boolean {
  return /^(hi|hello|hey)[\s!.?,]*$/i.test(text.trim());
}

export function parseNameAndNumber(text: string, previous: LeadDetails): LeadDetails {
  const lead = { ...previous };
  const labeled = /(?:^|[;\n,])\s*(name|business|callback|preferred call\s?back number)\s*:\s*([^;\n,]+)/gi;
  for (const match of text.matchAll(labeled)) {
    const value = match[2].trim().slice(0, 200);
    if (!value) continue;
    const label = match[1].toLowerCase();
    if (label === "name") lead.customerName = value;
    else if (label === "business") lead.businessName = value;
    else if (/^[+\d().\s-]+$/.test(value) && value.replace(/\D/g, "").length >= 7) {
      lead.preferredCallbackNumber = value;
    }
  }
  const phone = text.match(/(?:\+?1[-.\s]*)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/);
  if (phone && !lead.preferredCallbackNumber) lead.preferredCallbackNumber = phone[0].trim();
  if (!lead.customerName) {
    const withoutPhone = text.replace(phone?.[0] || "", " ").replace(/name\s*:/i, " ");
    const name = withoutPhone.replace(/[^A-Za-z' -]+/g, " ").replace(/\s+/g, " ").trim();
    if (name && !/^(hi|hello|hey)$/i.test(name) && name.length >= 2 && name.length <= 80) {
      lead.customerName = name;
    }
  }
  return lead;
}

export function matchSlot(text: string, slots: OfferedSlot[]): OfferedSlot | undefined {
  const trimmed = text.trim();
  const digit = trimmed.match(/^\s*([123])(?:[).:]|\s|$)/);
  if (digit) return slots.find(slot => slot.id === digit[1]);
  const upper = trimmed.toUpperCase();
  return slots.find(slot => upper.includes(slot.label.toUpperCase()));
}

export function appointmentEmail(lead: LeadDetails, slot: OfferedSlot): string {
  return `SMS appointment booked\n`
    + `Name: ${lead.customerName || "Not provided yet"}\n`
    + `Callback number: ${lead.preferredCallbackNumber || lead.originatingNumber}\n`
    + `Originating phone: ${lead.originatingNumber}\n`
    + `Slot: ${slot.label}\n`
    + `Starts: ${slot.at}\n`;
}
