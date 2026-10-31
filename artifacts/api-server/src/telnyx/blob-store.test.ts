import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlobStore, StateConflict, type BlobBackend, type Snapshot } from "./blob-store";
import { businesses } from "./config";
import { incomingCall, recordSelection, recordMessage } from "./service";
import { processJobs } from "./worker";

function fakeBackend() {
  const data = new Map<string, Snapshot>();
  let counter = 0;
  const io: BlobBackend = {
    async read(path) { return data.has(path) ? structuredClone(data.get(path)!) : null; },
    async write(path, state, etag) {
      const current = data.get(path);
      if (current?.etag !== etag) throw new StateConflict();
      data.set(path, { state: structuredClone(state), etag: String(++counter) });
    },
    async health() { return true; },
  };
  return { io, data };
}
test("private Blob conditional writes serialize concurrent initial creation and updates", async () => {
  const { io } = fakeBackend(), store = createBlobStore(io);
  await Promise.all(Array.from({ length: 8 }, (_, i) => store.transaction("demo", state => {
    state.events[String(i)] = "saved";
  })));
  assert.equal(await store.transaction("demo", state => Object.keys(state.events).length), 8);
});
test("Blob-backed consent/retry/STOP flow retains one introduction and suppresses sending", async () => {
  const { io } = fakeBackend(), store = createBlobStore(io), business = businesses({})[0];
  const call = { From: "+12025550123", To: business.number, CallSid: "synthetic-blob-call" };
  await incomingCall(store, business, call);
  await Promise.all(Array.from({ length: 6 }, () => recordSelection(store, business, { ...call, Digits: "1" })));
  assert.equal(await store.transaction(business.id, s => Object.keys(s.jobs).length), 1);
  await recordMessage(store, business, { data: {
    id: "stop-event", event_type: "message.received", occurred_at: new Date().toISOString(),
    payload: { id: "stop-message", direction: "inbound", messaging_profile_id: business.profileId,
      from: { phone_number: call.From }, to: [{ phone_number: business.number }], text: "STOP" },
  } });
  await processJobs(store, business, {
    env: {}, sendSms: async () => { assert.fail("STOP forbids SMS"); },
    notify: async () => {},
  });
  assert.equal(await store.transaction(business.id, s => Object.values(s.jobs).find(j => j.kind === "sms")?.status), "suppressed");
});
test("Blob storage isolates tenants and rejects unsafe IDs", async () => {
  const { io } = fakeBackend(), store = createBlobStore(io);
  await store.transaction("first", s => { s.events.a = "saved"; });
  assert.equal(await store.transaction("second", s => Object.keys(s.events).length), 0);
  await assert.rejects(store.transaction("../escape", () => undefined), /Invalid business/);
});
test("preview and production cannot read each other's demo records", async () => {
  const { io } = fakeBackend(), store = createBlobStore(io), previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    await store.transaction("demo", s => { s.events.saved = "production-only"; });
    process.env.VERCEL_ENV = "preview";
    assert.equal(await store.transaction("demo", s => Object.keys(s.events).length), 0);
    process.env.VERCEL_ENV = "production";
    assert.equal(await store.transaction("demo", s => s.events.saved), "production-only");
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous;
  }
});
test("ambiguous Blob write errors are not replayed automatically", async () => {
  const { io } = fakeBackend(); let mutations = 0;
  io.write = async () => { throw new Error("uncertain network response"); };
  await assert.rejects(createBlobStore(io).transaction("demo", () => { mutations++; }), /uncertain/);
  assert.equal(mutations, 1);
});
test("exhausted write conflicts fail closed instead of overwriting another request", async () => {
  const { io } = fakeBackend();
  io.write = async () => { throw new StateConflict(); };
  await assert.rejects(createBlobStore(io).transaction("demo", () => undefined), /busy/);
});
