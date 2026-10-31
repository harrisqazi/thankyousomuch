import { randomUUID } from "node:crypto";
import { liveSending, limit, type Business } from "./config";
import { enqueue, key, type Job, type StateStore } from "./state";

type Dependencies = {
  sendSms: (business: Business, job: Job) => Promise<{ id: string }>;
  notify: (business: Business, job: Job) => Promise<void>;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
};

/** Durable claims: crashed/ambiguous external operations are NEVER auto-resent. */
export async function processJobs(store: StateStore, business: Business, deps: Dependencies) {
  const env = deps.env || process.env;
  const now = deps.now || (() => new Date());
  // Bound one serverless invocation; run the recovery command for larger queues.
  for (let i = 0; i < 25; i++) {
    const job = await store.transaction(business.id, state => {
      const pending = Object.values(state.jobs).find(j => j.status === "pending");
      if (!pending) return null;
      const at = now();
      if (pending.kind === "sms") {
        const consent = state.consents[key(pending.caller)];
        if (!consent || consent.revokedAt || state.optOuts[key(pending.caller)]) {
          pending.status = "suppressed"; pending.error = "no_active_consent"; return { skip: true } as const;
        }
        if (!liveSending(env) || business.outboundSmsApproved !== true) {
          pending.status = "dry_run"; pending.finishedAt = at.toISOString(); return { skip: true } as const;
        }
        const attempts = Object.values(state.jobs).filter(j => j.kind === "sms" && j.claimedAt);
        const hourly = attempts.filter(j => at.getTime() - Date.parse(j.claimedAt!) < 3_600_000).length;
        const daily = attempts.filter(j => j.caller === pending.caller
          && at.getTime() - Date.parse(j.claimedAt!) < 86_400_000).length;
        if (hourly >= limit(env.TELNYX_HOURLY_LIMIT, 10, 100)
          || daily >= limit(env.TELNYX_CONTACT_DAILY_LIMIT, 2, 10)) {
          pending.status = "suppressed"; pending.error = "sending_limit"; return { skip: true } as const;
        }
      }
      pending.status = "processing";
      pending.claimedAt = at.toISOString();
      return { job: structuredClone(pending) };
    });
    if (!job) break;
    if ("skip" in job) continue;
    let result: { id: string } | undefined;
    let failure: string | undefined;
    let status: Job["status"] = "accepted";
    try {
      if (job.job.kind === "sms") result = await deps.sendSms(business, job.job);
      else await deps.notify(business, job.job);
    } catch (error) {
      // A non-2xx provider response is explicit failure; network errors are ambiguous.
      failure = error instanceof SmsRejected ? error.code : "external_operation_uncertain";
      status = error instanceof SmsRejected ? "failed" : "uncertain";
    }
    await store.transaction(business.id, state => {
      const saved = state.jobs[job.job.id];
      saved.status = status;
      saved.finishedAt = now().toISOString();
      saved.error = failure;
      saved.providerId = result?.id;
      if (result) {
        const id = key(result.id);
        // A delivery webhook can arrive before the API response.
        state.messages[id] ||= {
          direction: "outbound", caller: saved.caller, text: saved.text,
          at: saved.finishedAt, status: "accepted",
        };
      }
      if (failure && saved.kind === "sms") {
        enqueue(state, "email", saved.caller,
          `SMS was not confirmed for ${business.name}.\nJob: ${saved.id}\nStatus: ${status}\nReason: ${failure}\n`
          + "Do not assume a text was sent or automatically resend an uncertain operation.",
          saved.finishedAt, randomUUID());
      }
    });
  }
}
export class SmsRejected extends Error {
  constructor(public code: string) { super(code); }
}
export async function sendSms(business: Business, job: Job): Promise<{ id: string }> {
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": job.id,
    },
    body: JSON.stringify({
      from: business.number, to: job.caller, messaging_profile_id: business.profileId,
      text: job.text, type: "SMS", use_profile_webhooks: true,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new SmsRejected(`telnyx_http_${response.status}`);
  const body = await response.json() as { data?: { id?: string; errors?: unknown[] } };
  if (!body.data?.id || body.data.errors?.length) throw new SmsRejected("telnyx_response_rejected");
  return { id: body.data.id };
}
