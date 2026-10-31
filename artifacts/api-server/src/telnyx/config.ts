import { phoneNumbers, type PhoneNumber } from "../phone-system/phone-numbers";
import { getVoiceFlow } from "../phone-system/flows";

export type Business = PhoneNumber;

export function businesses(env = process.env): Business[] {
  // Future businesses must be explicitly configured; there is no fallback tenant.
  const raw: unknown = env.TELNYX_BUSINESSES_JSON
    ? JSON.parse(env.TELNYX_BUSINESSES_JSON) : phoneNumbers;
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Phone number configuration must be a nonempty array");
  const configured: Business[] = raw.map(entry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid phone number entry");
    // Preserve legacy environment-configured entries, but never auto-approve SMS.
    const business = {
      ...entry,
      flowId: entry.flowId ?? (entry.id === "tysm-demo" ? "tysm-get-started" : "business-inquiry"),
      outboundSmsApproved: entry.outboundSmsApproved ?? false,
    };
    if (!env.TELNYX_BUSINESSES_JSON && business.id === "tysm-demo") {
      // Only the phone-specific override applies here. Unrelated form-email
      // settings must not silently redirect phone leads away from this entry.
      business.recipient = env.TELNYX_NOTIFY_TO || business.recipient;
    }
    return business;
  });
  const ids = new Set<string>(), numbers = new Set<string>(), profiles = new Set<string>();
  for (const business of configured) {
    if (typeof business.id !== "string" || !/^[a-z0-9-]{1,60}$/.test(business.id)
      || typeof business.number !== "string" || !/^\+[1-9]\d{7,14}$/.test(business.number)
      || typeof business.name !== "string" || !business.name.trim() || business.name.length > 100
      || typeof business.profileId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(business.profileId)
      || typeof business.recipient !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.recipient)
      || typeof business.helpContact !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.helpContact)
      || typeof business.providerManagedHelp !== "boolean" || typeof business.outboundSmsApproved !== "boolean"
      || typeof business.flowId !== "string"
      || ids.has(business.id) || numbers.has(business.number) || profiles.has(business.profileId)) {
      throw new Error("Invalid or overlapping Telnyx business configuration");
    }
    getVoiceFlow(business.flowId);
    ids.add(business.id); numbers.add(business.number); profiles.add(business.profileId);
  }
  return configured;
}

export function liveSending(env = process.env) {
  return env.TELNYX_SMS_ENABLED === "true" && env.TELNYX_DRY_RUN === "false"
    && env.TELNYX_MESSAGING_APPROVED === "true" && env.TELNYX_KEYWORDS_CONFIRMED === "true"
    && Boolean(env.TELNYX_API_KEY && env.TELNYX_PUBLIC_KEY);
}

export function limit(value: string | undefined, fallback: number, maximum: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= maximum ? n : fallback;
}
