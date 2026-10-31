import { voiceFlows, type VoiceFlow } from "./text-to-speech";
import type { PhoneNumber } from "./phone-numbers";

export const consentVersion = "inquiry-sms-v2";
const textFields = [
  "greeting", "introText", "noInputMessage", "invalidOptionMessage",
  "consentSavedMessage", "optedOutMessage",
] as const;
const safeText = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 3000
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);

export function getVoiceFlow(id: string): VoiceFlow {
  if (!Object.hasOwn(voiceFlows, id)) throw new Error("Unknown phone voice flow");
  const flow = voiceFlows[id];
  if (!flow || !safeText(flow.version) || !["man", "woman"].includes(flow.voice)
    || flow.language !== "en-US" || !Number.isFinite(flow.voiceSpeed)
    || flow.voiceSpeed < 0.1 || flow.voiceSpeed > 2
    || textFields.some(field => !safeText(flow[field]))
    || !flow.options || typeof flow.options !== "object" || Array.isArray(flow.options)) {
    throw new Error("Invalid voice flow settings");
  }
  if (textFields.some(field => field !== "introText" && flow[field].includes("{callerNumber}"))) {
    throw new Error("Caller number placeholder is only supported in introductory SMS");
  }
  const options = Object.entries(flow.options);
  if (options.length === 0 || options.length > 10) throw new Error("A voice flow needs keypad options");
  for (const [digit, option] of options) {
    if (!/^\d$/.test(digit) || !option || typeof option !== "object"
      || !["consent-and-text", "say-and-hang-up"].includes(option.action)
      || (option.action === "say-and-hang-up" && !safeText(option.message))) {
      throw new Error("Invalid keypad digit, action, or spoken message");
    }
  }
  const consentOptions = options.filter(([, option]) => option.action === "consent-and-text");
  if (consentOptions.length !== 1 || !flow.greeting.includes("{consentKey}")) {
    throw new Error("A voice flow needs exactly one consent key and a {consentKey} greeting placeholder");
  }
  for (const text of [...textFields.map(field => flow[field]),
    ...options.flatMap(([, option]) => option.action === "say-and-hang-up" ? [option.message] : [])]) {
    const withoutTokens = text.replace(/\{(businessName|helpContact|consentKey|callerNumber)\}/g, "");
    if (/[{}]/.test(withoutTokens)) throw new Error("Unknown voice flow text placeholder");
  }
  return structuredClone(flow);
}

export function consentKey(flow: VoiceFlow): string {
  return Object.entries(flow.options).find(([, option]) => option.action === "consent-and-text")![0];
}

export function fillText(text: string, business: PhoneNumber, flow: VoiceFlow, callerNumber = ""): string {
  const tokens: Record<string, string> = {
    businessName: business.name, helpContact: business.helpContact, consentKey: consentKey(flow), callerNumber,
  };
  return text.replace(/\{(businessName|helpContact|consentKey|callerNumber)\}/g, (_, token: string) => tokens[token]);
}

export function consentDisclosure(business: PhoneNumber, flow: VoiceFlow): string {
  return `By pressing ${consentKey(flow)}, you agree to receive text messages from ${business.name} about this inquiry. `
    + "Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. "
    + "Reply STOP to opt out or HELP for help. If you do not want text messages, simply hang up.";
}

export function spokenPrompt(business: PhoneNumber, flow: VoiceFlow): string {
  return consentDisclosure(business, flow) + " " + fillText(flow.greeting, business, flow);
}

export function introductoryText(business: PhoneNumber, flow: VoiceFlow, callerNumber = ""): string {
  if (flow.introText.includes("{callerNumber}") && !callerNumber) throw new Error("Caller number required for introductory text");
  return fillText(flow.introText, business, flow, callerNumber)
    + " Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";
}
