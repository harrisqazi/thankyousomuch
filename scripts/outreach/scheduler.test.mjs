import test from "node:test";
import assert from "node:assert/strict";
import { HOUR_GAP_MS, processQueue, strongETag } from "./scheduler.mjs";

const start = Date.parse("2026-10-19T16:07:00Z");
function fixture() {
  return {
    version: 1,
    previouslyAccepted: 16,
    firstBatchNotBefore: new Date(start).toISOString(),
    secondBatchNotBefore: null,
    retryNotBefore: null,
    recipients: [0, 0, 1].map((batch, i) => ({
      email: `person${i}@example.com`,
      subject: "Follow-up",
      text: "Approved message",
      messageId: `<example-${i}@example.com>`,
      batch,
      status: "pending",
    })),
  };
}
function setup(queue, options = {}) {
  let clock = start;
  const sends = [];
  const saves = [];
  return {
    sends,
    saves,
    setTime: time => { clock = time; },
    run: () => processQueue(queue, {
      save: async value => { saves.push(structuredClone(value)); },
      send: async recipient => {
        sends.push(recipient.email);
        return { accepted: [recipient.email], rejected: [] };
      },
      now: () => clock,
      sleep: async () => {},
      ...options,
    }),
  };
}

test("nothing sends early; first batch only sends once", async () => {
  const queue = fixture();
  const harness = setup(queue);
  harness.setTime(start - 1);
  await harness.run();
  assert.equal(harness.sends.length, 0);
  harness.setTime(start);
  await harness.run();
  assert.equal(harness.sends.length, 2);
  assert.equal(harness.saves[0].recipients[0].status, "sending");
  await harness.run();
  assert.equal(harness.sends.length, 2);
});

test("final recipient waits at least 61 minutes; completed runs do not resend", async () => {
  const queue = fixture();
  const harness = setup(queue);
  await harness.run();
  harness.setTime(start + HOUR_GAP_MS - 1);
  await harness.run();
  assert.equal(harness.sends.length, 2);
  harness.setTime(start + HOUR_GAP_MS);
  assert.equal((await harness.run()).complete, true);
  await harness.run();
  assert.equal(harness.sends.length, 3);
});

test("explicit quota rejection reschedules safely, without retrying accepted contacts", async () => {
  const queue = fixture();
  let attempts = 0;
  const harness = setup(queue, {
    send: async recipient => {
      attempts++;
      if (attempts === 2) throw Object.assign(new Error("quota"), {
        code: "EENVELOPE", responseCode: 554, response: "too many messages from sender in last 60 minutes",
      });
      return { accepted: [recipient.email] };
    },
  });
  await harness.run();
  assert.equal(queue.recipients[0].status, "accepted");
  assert.equal(queue.recipients[1].status, "pending");
  await harness.run();
  assert.equal(attempts, 2);
  harness.setTime(start + HOUR_GAP_MS);
  await harness.run();
  assert.equal(attempts, 3);
});

test("uncertain SMTP outcomes pause rather than risk duplicate emails", async () => {
  const queue = fixture();
  const harness = setup(queue, {
    send: async () => { throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }); },
  });
  assert.equal((await harness.run()).needsReview, true);
  const count = harness.saves.length;
  await harness.run();
  assert.equal(harness.saves.length, count);
});

test("interrupted sending records are never automatically retried", async () => {
  const queue = fixture();
  queue.recipients[0].status = "sending";
  const harness = setup(queue);
  assert.equal((await harness.run()).needsReview, true);
  assert.equal(harness.sends.length, 0);
});

test("a failed initial durable write prevents SMTP", async () => {
  const harness = setup(fixture(), {
    save: async () => { throw new Error("storage unavailable"); },
  });
  await assert.rejects(harness.run(), /storage unavailable/);
  assert.equal(harness.sends.length, 0);
});

test("a lost persistence update after acceptance leaves the durable attempt blocked", async () => {
  const queue = fixture();
  let durable;
  let writes = 0;
  const harness = setup(queue, {
    save: async value => {
      if (++writes === 2) throw new Error("lost write");
      durable = structuredClone(value);
    },
  });
  await assert.rejects(harness.run(), /lost write/);
  const recovered = setup(durable);
  assert.equal((await recovered.run()).needsReview, true);
  assert.equal(recovered.sends.length, 0);
});

test("duplicate recipients are rejected before any SMTP attempt", async () => {
  const queue = fixture();
  queue.recipients[1].email = queue.recipients[0].email;
  const harness = setup(queue);
  await assert.rejects(harness.run(), /duplicate/);
  assert.equal(harness.sends.length, 0);
});

test("private download ETags are normalized for conditional Blob writes", () => {
  assert.equal(strongETag('W/"ledger-version"'), '"ledger-version"');
  assert.equal(strongETag('"ledger-version"'), '"ledger-version"');
  assert.throws(() => strongETag(""), /no version/);
});
