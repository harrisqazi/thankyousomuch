import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import express from "express";
import { businesses, liveSending } from "./config";
import { verifyTelnyx } from "./auth";
import { emptyState, key, type DemoState, type StateStore } from "./state";
import { incomingCall, recordSelection, recordMessage, messagingInput, type MessagingEvent } from "./service";
import { processJobs, SmsRejected } from "./worker";
import { voiceFlows } from "../phone-system/text-to-speech";
import { getVoiceFlow } from "../phone-system/flows";
import { phoneNumbers } from "../phone-system/phone-numbers";

const business = { ...businesses({} as NodeJS.ProcessEnv)[0], outboundSmsApproved: true };
const input = { From: "+12025550123", To: business.number, CallSid: "demo-call-a" };
const now = new Date("2026-10-29T12:00:00Z");
const live: NodeJS.ProcessEnv = {
  TELNYX_SMS_ENABLED: "true", TELNYX_DRY_RUN: "false", TELNYX_MESSAGING_APPROVED: "true",
  TELNYX_KEYWORDS_CONFIRMED: "true", TELNYX_API_KEY: "synthetic", TELNYX_PUBLIC_KEY: "synthetic",
};
function memoryStore(): StateStore & { states: Record<string, DemoState> } {
  const states: Record<string, DemoState> = {};
  let queue = Promise.resolve();
  return {
    states,
    health: async () => true,
    transaction<T>(id: string, change: (state: DemoState) => T): Promise<T> {
      const work = queue.then(() => {
        const state = structuredClone(states[id] || emptyState());
        const value = change(state); states[id] = state; return value;
      });
      queue = work.then(() => undefined, () => undefined);
      return work;
    },
  };
}
const stateOf = (store: ReturnType<typeof memoryStore>) => store.states[business.id];
async function consent(store: StateStore, callId = input.CallSid) {
  const call = { ...input, CallSid: callId };
  await incomingCall(store, business, call, now);
  await recordSelection(store, business, { ...call, Digits: "1" }, now);
}
function received(text = "Can you help?", id = "message-1", at = now.toISOString()): MessagingEvent {
  return { data: {
    id: `event-${id}`, event_type: "message.received", occurred_at: at,
    payload: { id, messaging_profile_id: business.profileId, direction: "inbound",
      from: { phone_number: input.From }, to: [{ phone_number: business.number }], text },
  } };
}

test("Ed25519 verifies exact JSON/form bytes; rejects tampering, absent headers, stale/future timestamps", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = (publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64");
  const timestamp = String(Math.floor(now.getTime() / 1000));
  for (const text of ['{ "a": 1 }', "From=%2B12025550123&Digits=5"]) {
    const raw = Buffer.from(text);
    const sig = sign(null, Buffer.concat([Buffer.from(`${timestamp}|`), raw]), privateKey).toString("base64");
    assert.equal(verifyTelnyx(raw, sig, timestamp, pub, now.getTime()), true);
    assert.equal(verifyTelnyx(Buffer.concat([raw, Buffer.from(" ")]), sig, timestamp, pub, now.getTime()), false);
    assert.equal(verifyTelnyx(raw, sig, timestamp, pub, now.getTime() + 301_000), false);
    assert.equal(verifyTelnyx(raw, sig, timestamp, pub, now.getTime() - 301_000), false);
    assert.equal(verifyTelnyx(raw, undefined, timestamp, pub, now.getTime()), false);
  }
});

test("TeXML identifies the business, discloses SMS terms and routes exactly one digit", async () => {
  const store = memoryStore(), xml = await incomingCall(store, business, input, now);
  assert.match(xml, /^<\?xml.*<Response>/);
  assert.match(xml, /numDigits="1"/);
  assert.match(xml, /action="\/voice\/selection"/);
  assert.match(xml, /Press 1/);
  assert.match(xml, /voice="woman" language="en-US" voiceSpeed="1"/);
  assert.ok(xml.indexOf("you agree to receive text messages") < xml.indexOf("<Gather"));
  for (const text of [business.name, "STOP", "HELP", "data rates", "not a condition"]) assert.ok(xml.includes(text));
});

test("only 1 creates consent; requires a matching recent prompt; concurrent retries create one intro", async () => {
  const store = memoryStore();
  await assert.rejects(recordSelection(store, business, { ...input, Digits: "1" }, now), /matching/);
  await incomingCall(store, business, input, now);
  await recordSelection(store, business, { ...input, Digits: "2" }, now);
  await recordSelection(store, business, { ...input, Digits: "5" }, now);
  await recordSelection(store, business, input, now);
  assert.equal(Object.keys(stateOf(store).consents).length, 0);
  assert.equal(Object.keys(stateOf(store).jobs).length, 0);
  await Promise.all(Array.from({ length: 5 }, () => recordSelection(store, business, { ...input, Digits: "1" }, now)));
  const state = stateOf(store), saved = state.consents[key(input.From)];
  assert.equal(saved.caller, input.From);
  assert.equal(saved.called, input.To);
  assert.equal(saved.callId, input.CallSid);
  assert.equal(saved.consentedAt, now.toISOString());
  assert.match(saved.disclosure, /Press 1/);
  assert.equal(saved.key, "1");
  assert.equal(saved.flowId, "tysm-get-started");
  assert.equal(saved.action, "consent-and-text");
  assert.equal(Object.values(state.jobs).length, 1);
  await assert.rejects(recordSelection(store, business, { ...input, Digits: "1" }, new Date(now.getTime() + 31 * 60_000)), /recent/);
});

test("press 1 confirms only the known number and asks for missing business details", async () => {
  const store = memoryStore();
  await consent(store);
  const sms = Object.values(stateOf(store).jobs).find(job => job.kind === "sms");
  assert.ok(sms);
  assert.match(sms.text, /We've saved your number/);
  assert.match(sms.text, /will call during regular business hours/);
  assert.match(sms.text, /What's your name and business/);
  assert.match(sms.text, /helping your business grow/);
  assert.match(sms.text, /Reply STOP to opt out, HELP for help/);
  assert.ok(!sms.text.includes("{businessName}"));
  assert.ok(!sms.text.includes("appointment confirmed"));
  assert.equal(stateOf(store).consents[key(input.From)].disclosureVersion, "inquiry-sms-v2:tysm-get-started:2");
});

test("new businesses stay dry-run without individual approval even when global switches are live", async () => {
  const store = memoryStore(); await consent(store);
  await processJobs(store, { ...business, outboundSmsApproved: false }, {
    env: live, now: () => now,
    sendSms: async () => assert.fail("this business is not approved"),
    notify: async () => {},
  });
  assert.equal(Object.values(stateOf(store).jobs)[0].status, "dry_run");
  assert.equal(phoneNumbers[0].outboundSmsApproved, false);
});

test("changing a flow during a call does not rewrite its prompt, key, voice, version, or intro", async () => {
  const store = memoryStore();
  const original = structuredClone(voiceFlows[business.flowId]);
  const before = await incomingCall(store, business, input, now);
  try {
    voiceFlows[business.flowId] = {
      ...original, version: `${original.version}-changed`, voice: "man",
      greeting: "Changed prompt. Press {consentKey}.",
      introText: "Changed SMS", options: { "2": { action: "consent-and-text" } },
    };
    assert.equal(await incomingCall(store, business, input, now), before);
    await recordSelection(store, business, { ...input, Digits: "2" }, now);
    assert.equal(Object.keys(stateOf(store).jobs).length, 0);
    const response = await recordSelection(store, business, { ...input, Digits: "1" }, now);
    assert.match(response, /voice="woman"/);
    assert.equal(stateOf(store).consents[key(input.From)].disclosureVersion,
      `inquiry-sms-v2:${business.flowId}:${original.version}`);
    assert.doesNotMatch(Object.values(stateOf(store).jobs)[0].text, /Changed SMS/);
    const newXml = await incomingCall(store, business, { ...input, CallSid: "new-version" }, now);
    assert.match(newXml, /Changed prompt. Press 2/);
    assert.match(newXml, /voice="man"/);
  } finally { voiceFlows[business.flowId] = original; }
});

test("number mapping chooses the right voice flow, business words and notification recipient", async () => {
  const other = { ...business, id: "plumbing", name: 'Example & Sons <Plumbing>',
    number: "+12025550199", profileId: "plumbing-profile", recipient: "owner@example.org",
    flowId: "business-inquiry" };
  const configured = businesses({ TELNYX_BUSINESSES_JSON: JSON.stringify([business, other]) });
  const selected = configured.find(b => b.number === other.number)!;
  const store = memoryStore();
  const call = { ...input, To: other.number };
  const xml = await incomingCall(store, selected, call, now);
  assert.match(xml, /Example &amp; Sons &lt;Plumbing&gt;/);
  assert.doesNotMatch(xml, /turn missed calls/);
  await recordSelection(store, selected, { ...call, Digits: "1" }, now);
  assert.equal(store.states[business.id], undefined);
  assert.match(Object.values(store.states[other.id].jobs)[0].text, /Example & Sons <Plumbing>/);
  assert.equal(configured.find(b => b.number === "+12025550198"), undefined);
});

test("a configured say-and-hang-up option speaks but never grants SMS consent", async () => {
  const original = structuredClone(voiceFlows[business.flowId]);
  try {
    voiceFlows[business.flowId].options["2"] = {
      action: "say-and-hang-up", message: "For help email {helpContact}.",
    };
    const store = memoryStore(); await incomingCall(store, business, input, now);
    const response = await recordSelection(store, business, { ...input, Digits: "2" }, now);
    assert.match(response, /For help email admin@thankyousomuch.ai/);
    assert.equal(Object.keys(stateOf(store).consents).length, 0);
    assert.equal(Object.keys(stateOf(store).jobs).length, 0);
  } finally { voiceFlows[business.flowId] = original; }
});

test("configuration rejects duplicate identities/numbers/profiles and unknown flow IDs", () => {
  const other = { ...business, id: "other", number: "+12025550199", profileId: "another-profile" };
  for (const duplicate of [
    { ...other, id: business.id }, { ...other, number: business.number },
    { ...other, profileId: business.profileId },
  ]) assert.throws(() => businesses({ TELNYX_BUSINESSES_JSON: JSON.stringify([business, duplicate]) }), /overlapping/);
  for (const invalid of [null, {}, [], [null], [{ ...business, flowId: "missing" }],
    [{ ...business, outboundSmsApproved: "true" }], [{ ...business, recipient: "not-an-email" }]]) {
    assert.throws(() => businesses({ TELNYX_BUSINESSES_JSON: JSON.stringify(invalid) }));
  }
  assert.equal(businesses({ TELNYX_NOTIFY_TO: "alternate@example.org" })[0].recipient, "alternate@example.org");
  assert.equal(businesses({ LEAD_TO_EMAIL: "unrelated-form-setting" })[0].recipient, phoneNumbers[0].recipient);
  const { flowId, outboundSmsApproved, ...legacy } = business;
  const resolved = businesses({ TELNYX_BUSINESSES_JSON: JSON.stringify([legacy]) })[0];
  assert.equal(resolved.flowId, "tysm-get-started");
  assert.equal(resolved.outboundSmsApproved, false);
});

test("flow validation rejects unsupported voices, languages, actions, keys, and missing consent placeholders", () => {
  const original = structuredClone(voiceFlows[business.flowId]);
  try {
    for (const invalid of [
      { voice: 'woman" hacked="true' }, { language: "fr-FR" }, { voiceSpeed: 3 },
      { greeting: "Press 1" }, { introText: "Unknown {token}" },
      { options: { "11": { action: "consent-and-text" } } },
      { options: { "1": { action: "arbitrary-code" } } },
      { options: { "1": { action: "consent-and-text" }, "2": { action: "consent-and-text" } } },
      { options: { "1": { action: "consent-and-text" }, "2": { action: "say-and-hang-up", message: "" } } },
    ]) {
      voiceFlows[business.flowId] = { ...original, ...invalid } as typeof original;
      assert.throws(() => getVoiceFlow(business.flowId));
    }
  } finally { voiceFlows[business.flowId] = original; }
});

test("legacy stored calls must restart rather than accepting a new meaning for an old digit", async () => {
  const store = memoryStore();
  await store.transaction(business.id, state => {
    state.calls[key(input.CallSid)] = { caller: input.From, called: input.To, callId: input.CallSid,
      at: now.toISOString(), disclosure: "Old press 5 prompt" };
  });
  await assert.rejects(recordSelection(store, business, { ...input, Digits: "1" }, now), /older prompt/);
  assert.equal(Object.keys(stateOf(store).jobs).length, 0);
});

test("dry run NEVER calls Telnyx; all live gates are required", async () => {
  for (const flag of Object.keys(live)) assert.equal(liveSending({ ...live, [flag]: "" }), false);
  const store = memoryStore(); await consent(store);
  await processJobs(store, business, {
    env: {}, now: () => now,
    sendSms: async () => { throw new Error("MUST NOT CALL"); },
    notify: async () => {},
  });
  assert.equal(Object.values(stateOf(store).jobs)[0].status, "dry_run");
});

test("accepted is not delivered; concurrent workers send an intro only once", async () => {
  const store = memoryStore(); await consent(store); let sends = 0;
  const deps = { env: live, now: () => now,
    sendSms: async () => { sends++; return { id: "outbound-1" }; }, notify: async () => {} };
  await Promise.all([processJobs(store, business, deps), processJobs(store, business, deps)]);
  assert.equal(sends, 1);
  assert.equal(stateOf(store).messages[key("outbound-1")].status, "accepted");
});

test("STOP persists, suppresses pending SMS, survives repeated calls; delayed START cannot undo it", async () => {
  const store = memoryStore(); await consent(store);
  await recordMessage(store, business, received("STOP", "stop-1", "2026-10-29T12:01:00Z"));
  await consent(store, "another-call");
  await recordMessage(store, business, received("START", "start-old", "2026-10-29T12:00:30Z"));
  let sends = 0;
  await processJobs(store, business, { env: live, now: () => now,
    sendSms: async () => { sends++; return { id: "bad" }; }, notify: async () => {} });
  assert.equal(sends, 0);
  assert.ok(stateOf(store).optOuts[key(input.From)]);
  await recordMessage(store, business, received("START", "start-new", "2026-10-29T12:02:00Z"));
  assert.equal(stateOf(store).optOuts[key(input.From)], undefined);
});

test("inbound replies are saved and notified once, including duplicate events under new IDs; HELP uses profile autoresponse", async () => {
  const store = memoryStore(), event = received();
  await recordMessage(store, business, event);
  await recordMessage(store, business, event);
  await recordMessage(store, business, { data: { ...event.data, id: "different-event-same-message" } });
  let emails = 0;
  await processJobs(store, business, { env: {}, notify: async (b, job) => {
    emails++; assert.equal(b.recipient, business.recipient); assert.match(job.text, /Can you help/);
  }, sendSms: async () => { throw new Error("unexpected"); } });
  assert.equal(emails, 1);
  assert.equal(Object.keys(stateOf(store).messages).length, 1);
  await recordMessage(store, business, received("HELP", "help-1"));
  assert.match(stateOf(store).messages[key("help-1")].helpResponse!, /admin@thankyousomuch.ai/);
  assert.equal(Object.values(stateOf(store).jobs).filter(j => j.kind === "sms").length, 0);
});

test("tenants reject mismatched numbers/profiles and maintain separate data/notification recipients", async () => {
  const store = memoryStore();
  const other = { ...business, id: "other", number: "+12025550199", profileId: "other-profile", recipient: "owner@example.org" };
  await assert.rejects(recordMessage(store, other, received()), /mismatch/);
  const event = received();
  event.data.payload.to[0].phone_number = other.number;
  event.data.payload.messaging_profile_id = other.profileId;
  await recordMessage(store, other, event);
  assert.equal(store.states[business.id], undefined);
  assert.equal(Object.keys(store.states.other.messages).length, 1);
  assert.throws(() => businesses({ TELNYX_BUSINESSES_JSON: JSON.stringify([business, { ...other, profileId: business.profileId }]) }), /overlapping/);
});

test("per-contact and business send limits are atomically enforced", async () => {
  const store = memoryStore(); await consent(store); await consent(store, "call-2"); await consent(store, "call-3");
  let sends = 0;
  await processJobs(store, business, { env: { ...live, TELNYX_HOURLY_LIMIT: "1" }, now: () => now,
    sendSms: async () => ({ id: `send-${++sends}` }), notify: async () => {} });
  assert.equal(sends, 1);
  assert.equal(Object.values(stateOf(store).jobs).filter(j => j.error === "sending_limit").length, 2);
});

test("explicit SMS failures and uncertain network operations notify owner and are NOT retried", async () => {
  for (const error of [new SmsRejected("telnyx_http_403"), new Error("socket closed")]) {
    const store = memoryStore(); await consent(store); let sends = 0, emails = 0;
    const deps = { env: live, now: () => now, sendSms: async () => { sends++; throw error; },
      notify: async () => { emails++; } };
    await processJobs(store, business, deps); await processJobs(store, business, deps);
    assert.equal(sends, 1); assert.equal(emails, 1);
    const sms = Object.values(stateOf(store).jobs).find(j => j.kind === "sms")!;
    assert.equal(sms.status, error instanceof SmsRejected ? "failed" : "uncertain");
  }
});

test("per-contact daily limit applies independently of the business hourly limit", async () => {
  const store = memoryStore(); await consent(store); await consent(store, "call-2");
  let sends = 0;
  await processJobs(store, business, { env: { ...live, TELNYX_CONTACT_DAILY_LIMIT: "1", TELNYX_HOURLY_LIMIT: "10" },
    now: () => now, sendSms: async () => ({ id: `send-${++sends}` }), notify: async () => {} });
  assert.equal(sends, 1);
  assert.equal(Object.values(stateOf(store).jobs).filter(j => j.error === "sending_limit").length, 1);
});

test("final delivery status is not overwritten by a delayed message.sent event; failed delivery creates notification", async () => {
  const store = memoryStore();
  const event = received("intro", "outbound-a");
  event.data.event_type = "message.finalized"; event.data.payload.direction = "outbound";
  event.data.payload.from.phone_number = business.number;
  event.data.payload.to = [{ phone_number: input.From, status: "delivery_failed" }];
  await recordMessage(store, business, event);
  event.data.id = "later-sent"; event.data.event_type = "message.sent";
  event.data.payload.to[0].status = "sent";
  await recordMessage(store, business, event);
  assert.equal(stateOf(store).messages[key("outbound-a")].status, "delivery_failed");
  assert.equal(Object.values(stateOf(store).jobs).length, 1);
});

test("malformed provider payloads are rejected", () => {
  for (const input of [{}, { data: {} }, { data: { payload: {} } }]) assert.throws(() => messagingInput(input));
  const bad = received(); bad.data.payload.direction = "outbound";
  assert.throws(() => messagingInput(bad));
});

test("HTTP endpoint rejects unsigned requests without changing the existing site parsers", async () => {
  const { telnyxRouter } = await import("./routes");
  const app = express(); app.use(telnyxRouter); app.use(express.json());
  app.post("/unrelated", (req, res) => res.json(req.body));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of ["/voice/incoming", "/voice/selection", "/webhooks/telnyx/messaging"]) {
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.ok([403, 503].includes(response.status));
    }
    const response = await fetch(base + "/unrelated", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"ok":true}' });
    assert.deepEqual(await response.json(), { ok: true });
  } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
});
