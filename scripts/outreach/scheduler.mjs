export const HOUR_GAP_MS = 61 * 60 * 1000;

// Private Blob downloads may supply a weak HTTP ETag. Conditional writes
// require the equivalent strong ETag (the same value without the W/ prefix).
export function strongETag(etag) {
  if (!etag) throw new Error("Delivery ledger has no version");
  return etag.replace(/^W\//, "");
}

export function summarize(queue) {
  const counts = { accepted: 0, pending: 0, sending: 0, rejected: 0, uncertain: 0 };
  for (const recipient of queue.recipients) counts[recipient.status]++;
  return {
    previouslyAccepted: queue.previouslyAccepted,
    ...counts,
    complete: counts.accepted === queue.recipients.length,
    needsReview: counts.sending + counts.rejected + counts.uncertain > 0,
    firstBatchNotBefore: queue.firstBatchNotBefore,
    secondBatchNotBefore: queue.secondBatchNotBefore,
    retryNotBefore: queue.retryNotBefore,
  };
}

export function validateQueue(queue) {
  if (queue.version !== 1 || !Number.isFinite(Date.parse(queue.firstBatchNotBefore))) {
    throw new Error("Invalid campaign configuration");
  }
  const emails = new Set();
  for (const recipient of queue.recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)
      || emails.has(recipient.email)
      || !["pending", "sending", "accepted", "rejected", "uncertain"].includes(recipient.status)
      || ![0, 1].includes(recipient.batch)
      || !recipient.subject || /[\r\n]/.test(recipient.subject)
      || !recipient.text || !recipient.messageId) {
      throw new Error("Invalid or duplicate campaign recipient");
    }
    emails.add(recipient.email);
  }
  for (const field of ["secondBatchNotBefore", "retryNotBefore"]) {
    if (queue[field] && !Number.isFinite(Date.parse(queue[field]))) {
      throw new Error("Invalid campaign timing");
    }
  }
}

// An attempt is durably marked "sending" BEFORE SMTP. An interrupted or
// ambiguous attempt must be reviewed, never automatically sent a second time.
export async function processQueue(queue, { save, send, now = Date.now, sleep }) {
  validateQueue(queue);
  if (summarize(queue).needsReview || summarize(queue).complete) return summarize(queue);
  if (now() < Date.parse(queue.firstBatchNotBefore)
    || (queue.retryNotBefore && now() < Date.parse(queue.retryNotBefore))) {
    return summarize(queue);
  }

  const firstBatchComplete = queue.recipients
    .filter(recipient => recipient.batch === 0)
    .every(recipient => recipient.status === "accepted");
  if (firstBatchComplete && !queue.secondBatchNotBefore) {
    queue.secondBatchNotBefore = new Date(now() + HOUR_GAP_MS).toISOString();
    await save(queue);
  }
  const batch = firstBatchComplete ? 1 : 0;
  if (batch === 1 && now() < Date.parse(queue.secondBatchNotBefore)) return summarize(queue);
  const pending = queue.recipients.filter(recipient => recipient.batch === batch && recipient.status === "pending");

  for (const [index, recipient] of pending.entries()) {
    recipient.status = "sending";
    recipient.attemptedAt = new Date(now()).toISOString();
    recipient.attempts = (recipient.attempts || 0) + 1;
    await save(queue);

    let response;
    try {
      response = await send(recipient);
    } catch (error) {
      // A definite provider rejection for the rolling-hour quota is safe to
      // retry. A timeout or lost SMTP response is not: delivery is ambiguous.
      const rateLimited = error.responseCode >= 400
        && /too many messages|sending limit|rate limit/i.test(error.response || "");
      recipient.status = rateLimited ? "pending" : error.responseCode ? "rejected" : "uncertain";
      recipient.lastError = {
        code: typeof error.code === "string" ? error.code : "SMTP_ERROR",
        responseCode: error.responseCode || null,
        kind: rateLimited ? "hourly_limit" : "review_required",
      };
      if (rateLimited) queue.retryNotBefore = new Date(now() + HOUR_GAP_MS).toISOString();
      await save(queue);
      return summarize(queue);
    }

    const accepted = (response.accepted || [])
      .some(email => String(email).toLowerCase() === recipient.email.toLowerCase());
    if (!accepted || response.rejected?.length) {
      recipient.status = "rejected";
      await save(queue);
      return summarize(queue);
    }
    recipient.status = "accepted";
    recipient.acceptedAt = new Date(now()).toISOString();
    if (response.sentCopy) recipient.sentCopy = response.sentCopy;
    delete recipient.lastError;
    queue.retryNotBefore = null;
    if (batch === 0 && queue.recipients
      .filter(item => item.batch === 0)
      .every(item => item.status === "accepted")) {
      queue.secondBatchNotBefore = new Date(now() + HOUR_GAP_MS).toISOString();
    }
    // A failure here leaves "sending" in storage, deliberately blocking a
    // duplicate if SMTP accepted the email but the persistence step failed.
    await save(queue);
    if (index < pending.length - 1) await sleep(3000);
  }
  return summarize(queue);
}
