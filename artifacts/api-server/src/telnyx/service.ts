import type { Business } from "./config";
import { enqueue, key, type StateStore } from "./state";
import { getVoiceFlow, spokenPrompt, fillText, introductoryText, consentVersion, consentDisclosure } from "../phone-system/flows";
import type { VoiceFlow } from "../phone-system/text-to-speech";

export const DISCLOSURE_VERSION = consentVersion;
export const disclosure = (business: Business) =>
  spokenPrompt(business, getVoiceFlow(business.flowId));

export class DemoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type VoiceInput = { From: string; To: string; CallSid: string; Digits?: string };
export function voiceInput(value: Record<string, unknown>): VoiceInput {
  if (typeof value.From !== "string" || !/^\+[1-9]\d{7,14}$/.test(value.From)
    || typeof value.To !== "string" || !/^\+[1-9]\d{7,14}$/.test(value.To)
    || typeof value.CallSid !== "string" || !value.CallSid || value.CallSid.length > 256
    || (value.Digits !== undefined && (typeof value.Digits !== "string" || value.Digits.length > 10))) {
    throw new DemoError(400, "Invalid voice payload");
  }
  return value as VoiceInput;
}
export const xmlEscape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const say = (text: string, flow: VoiceFlow) =>
  `<Say voice="${xmlEscape(flow.voice)}" language="${xmlEscape(flow.language)}" voiceSpeed="${flow.voiceSpeed}">${xmlEscape(text)}</Say>`;
export const sayAndHangup = (text: string, flow: VoiceFlow) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${say(text, flow)}<Hangup/></Response>`;

export async function incomingCall(store: StateStore, business: Business, input: VoiceInput, now = new Date()) {
  const call = await store.transaction(business.id, state => {
    const id = key(input.CallSid);
    const existing = state.calls[id];
    if (existing && (existing.caller !== input.From || existing.called !== input.To)) {
      throw new DemoError(409, "Call identity mismatch");
    }
    if (!existing) {
      const flow = getVoiceFlow(business.flowId);
      state.calls[id] = {
        caller: input.From, called: input.To, callId: input.CallSid,
        at: now.toISOString(), disclosure: spokenPrompt(business, flow),
        consentPreamble: consentDisclosure(business, flow),
        greeting: fillText(flow.greeting, business, flow),
        flowId: business.flowId, flow,
        disclosureVersion: `${DISCLOSURE_VERSION}:${business.flowId}:${flow.version}`,
      };
    }
    const saved = state.calls[id];
    if (!saved.flow || !saved.consentPreamble || !saved.greeting) {
      throw new DemoError(409, "This call used an older prompt. Please call again.");
    }
    return structuredClone(saved);
  });
  const flow = call.flow!;
  return `<?xml version="1.0" encoding="UTF-8"?><Response>`
    // Play the disclosure before accepting digits so an early press cannot
    // interrupt the caller's notice that pressing the key agrees to SMS.
    + say(call.consentPreamble!, flow)
    + `<Gather input="dtmf" numDigits="1" timeout="8" action="/voice/selection">`
    + `${say(call.greeting!, flow)}</Gather>`
    + `${say(fillText(flow.noInputMessage, business, flow), flow)}<Hangup/></Response>`;
}

export async function recordSelection(store: StateStore, business: Business, input: VoiceInput, now = new Date()) {
  const result = await store.transaction(business.id, state => {
    const call = state.calls[key(input.CallSid)];
    if (!call || call.caller !== input.From || call.called !== input.To
      || now.getTime() - Date.parse(call.at) > 30 * 60_000) {
      throw new DemoError(409, "No matching recent consent prompt");
    }
    if (!call.flow || !call.disclosureVersion || !call.flowId) {
      throw new DemoError(409, "This call used an older prompt. Please call again.");
    }
    const flow = call.flow;
    const digit = input.Digits || "";
    const option = Object.hasOwn(flow.options, digit) ? flow.options[digit] : undefined;
    if (!option || option.action === "say-and-hang-up") {
      const message = option?.action === "say-and-hang-up" ? option.message : flow.invalidOptionMessage;
      return { flow, message: fillText(message, business, flow) };
    }
    const consentId = key(`consent:${input.CallSid}`);
    if (!state.events[consentId]) {
      state.events[consentId] = now.toISOString();
      const callerKey = key(input.From);
      state.consents[callerKey] = {
        caller: input.From, called: input.To, callId: input.CallSid,
        consentedAt: now.toISOString(), disclosureVersion: call.disclosureVersion, disclosure: call.disclosure,
        flowId: call.flowId, key: digit, action: "consent-and-text",
      };
      // A new call does not silently override a carrier-level STOP.
      enqueue(state, "sms", input.From,
        introductoryText(business, flow),
        now.toISOString(), key(`intro:${input.CallSid}`));
    }
    return { flow, message: fillText(state.optOuts[key(input.From)]
      ? flow.optedOutMessage : flow.consentSavedMessage, business, flow) };
  });
  return sayAndHangup(result.message, result.flow);
}

type MessagePayload = {
  id: string; messaging_profile_id: string; direction: string;
  from: { phone_number: string }; to: Array<{ phone_number: string; status?: string }>;
  text?: string; errors?: Array<{ code?: string }>;
};
export type MessagingEvent = { data: {
  id: string; event_type: string; occurred_at: string; payload: MessagePayload;
} };
export function messagingInput(value: unknown): MessagingEvent {
  const v = value as MessagingEvent;
  const d = v?.data, p = d?.payload;
  if (!d || typeof d.id !== "string" || !d.id || d.id.length > 256
    || !["message.received", "message.sent", "message.finalized"].includes(d.event_type)
    || typeof d.occurred_at !== "string" || !Number.isFinite(Date.parse(d.occurred_at))
    || !p || typeof p.id !== "string" || !p.id || p.id.length > 256
    || typeof p.messaging_profile_id !== "string"
    || !/^\+[1-9]\d{7,14}$/.test(p.from?.phone_number)
    || !Array.isArray(p.to) || p.to.length !== 1 || !/^\+[1-9]\d{7,14}$/.test(p.to[0]?.phone_number)
    || (p.text !== undefined && (typeof p.text !== "string" || p.text.length > 10_000))
    || (d.event_type === "message.received" ? p.direction !== "inbound" : p.direction !== "outbound")) {
    throw new DemoError(400, "Invalid messaging payload");
  }
  return v;
}

export async function recordMessage(store: StateStore, business: Business, event: MessagingEvent) {
  const { data: d } = event, p = d.payload;
  const inbound = d.event_type === "message.received";
  const businessNumber = inbound ? p.to[0].phone_number : p.from.phone_number;
  if (business.number !== businessNumber || business.profileId !== p.messaging_profile_id) {
    throw new DemoError(400, "Business or messaging profile mismatch");
  }
  await store.transaction(business.id, state => {
    const eventId = key(d.id), messageId = key(p.id);
    if (state.events[eventId]) return;
    state.events[eventId] = d.occurred_at;
    const caller = inbound ? p.from.phone_number : p.to[0].phone_number;
    const callerKey = key(caller);
    if (inbound) {
      // A provider can redeliver the same message under another event ID.
      if (state.messages[messageId]) return;
      const text = p.text || "[MMS received; attachments are not downloaded by this demo]";
      const keyword = text.trim().toUpperCase().replace(/\s+/g, " ");
      if (["STOP", "STOPALL", "STOP ALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) {
        state.optOuts[callerKey] = d.occurred_at;
        if (state.consents[callerKey]) state.consents[callerKey].revokedAt = d.occurred_at;
        for (const job of Object.values(state.jobs)) {
          if (job.kind === "sms" && job.caller === caller && job.status === "pending") job.status = "suppressed";
        }
      } else if (["START", "UNSTOP"].includes(keyword)) {
        // A delayed START must not undo a newer STOP.
        if (!state.optOuts[callerKey] || Date.parse(d.occurred_at) > Date.parse(state.optOuts[callerKey])) {
          delete state.optOuts[callerKey];
          // Require the recorded voice consent as well as the provider's unblock.
          if (state.consents[callerKey]) delete state.consents[callerKey].revokedAt;
        }
      }
      const help = ["HELP", "INFO"].includes(keyword)
        ? `${business.name}: For help contact ${business.helpContact}. Reply STOP to opt out. Msg & data rates may apply.`
        : undefined;
      state.messages[messageId] = {
        direction: "inbound", caller, text, at: d.occurred_at, status: "received", helpResponse: help,
      };
      if (help && !business.providerManagedHelp) {
        enqueue(state, "sms", caller, help, d.occurred_at, key(`help:${p.id}`));
      }
      // STOP/HELP are also saved and emailed; never expose these in public logs.
      enqueue(state, "email", caller,
        `Incoming SMS to ${business.name}\nFrom: ${caller}\nTo: ${business.number}\n`
        + `Received: ${d.occurred_at}\nMessage ID: ${p.id}\n\n${text}`,
        d.occurred_at, key(`notification:${p.id}`));
    } else {
      const current = state.messages[messageId];
      const status = typeof p.to[0].status === "string" ? p.to[0].status.slice(0, 100) : "unknown";
      const finalized = d.event_type === "message.finalized";
      if (!current?.finalized || finalized) {
        state.messages[messageId] = {
          direction: "outbound", caller, text: current?.text || p.text || "",
          at: d.occurred_at, status, finalized,
          errors: (Array.isArray(p.errors) ? p.errors : []).map(e => String(e?.code || "unknown").slice(0, 100)).slice(0, 20),
        };
      }
      if (finalized && !["delivered"].includes(status)) {
        const id = key(`delivery-failure:${p.id}`);
        if (!state.jobs[id]) enqueue(state, "email", caller,
          `SMS delivery update for ${business.name}\nMessage ID: ${p.id}\nRecipient: ${caller}\nStatus: ${status}\n`
          + "This is not proof of delivery. Review the Telnyx message detail record.",
          d.occurred_at, id);
      }
    }
  });
}
