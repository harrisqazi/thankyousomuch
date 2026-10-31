import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import { postgresStore } from "./store";
import { businesses } from "./config";
import { processJobs } from "./worker";

test("real PostgreSQL + signed HTTP forms persist consent atomically and dry-run retries never text", async () => {
  const id = `test-${randomUUID()}`;
  const business = { ...businesses({})[0], id, number: "+12025550199" };
  const keys = ["TELNYX_PUBLIC_KEY", "TELNYX_BUSINESSES_JSON", "TELNYX_SMS_ENABLED"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  process.env.TELNYX_PUBLIC_KEY = (publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64");
  process.env.TELNYX_BUSINESSES_JSON = JSON.stringify([business]);
  process.env.TELNYX_SMS_ENABLED = "false";
  const { createTelnyxRouter } = await import("./routes");
  const app = express(); app.use(createTelnyxRouter(() => {}));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function post(path: string, fields: Record<string, string>, tamper = false) {
    const raw = new URLSearchParams(fields).toString(), ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(null, Buffer.from(`${ts}|${raw}`), privateKey).toString("base64");
    return fetch(base + path, { method: "POST", body: raw + (tamper ? "&extra=1" : ""), headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "telnyx-timestamp": ts, "telnyx-signature-ed25519": signature,
    } });
  }
  try {
    const fields = { From: "+12025550123", To: business.number, CallSid: "synthetic-db-test" };
    assert.equal((await post("/voice/incoming", fields, true)).status, 403);
    const response = await post("/voice/incoming", fields);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /xml/);
    assert.match(await response.text(), /Press 1/);
    const responses = await Promise.all(Array.from({ length: 4 }, () => post("/voice/selection", { ...fields, Digits: "1" })));
    for (const response of responses) assert.equal(response.status, 200);
    await processJobs(postgresStore, business, { env: {}, notify: async () => {},
      sendSms: async () => { assert.fail("dry run cannot send"); } });
    const counts = await postgresStore.transaction(id, state => ({
      calls: Object.keys(state.calls).length, consents: Object.keys(state.consents).length,
      statuses: Object.values(state.jobs).filter(j => j.kind === "sms").map(j => j.status),
    }));
    assert.deepEqual(counts, { calls: 1, consents: 1, statuses: ["dry_run"] });
    const health = await fetch(base + "/health");
    assert.equal(((await health.json()) as { storageReady: boolean }).storageReady, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    // Await any already-started background claims before removing this synthetic tenant.
    await postgresStore.transaction(id, () => undefined);
    await pool.query("DELETE FROM telnyx_demo_state WHERE business_id=$1", [id]);
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
    await pool.end();
  }
});
