import { createRequire } from "node:module";
import { get, put } from "@vercel/blob";
import { processQueue, strongETag } from "./scheduler.mjs";
import { createSentArchive, sendMailAndArchive } from "../../artifacts/api-server/src/lib/sent-mail.mjs";

const require = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const nodemailer = require("nodemailer");
const pathname = process.env.OUTREACH_QUEUE_PATH;
if (!pathname?.startsWith("outreach/") || !process.env.BLOB_READ_WRITE_TOKEN
  || !process.env.TYSM_SMTP_PASSWORD) {
  throw new Error("Private campaign configuration is missing");
}
const stored = await get(pathname, { access: "private", useCache: false });
if (!stored || stored.statusCode !== 200) throw new Error("Private campaign queue unavailable");
let etag = strongETag(stored.blob.etag);
const queue = JSON.parse(await new Response(stored.stream).text());

const transport = nodemailer.createTransport({
  host: "mail.privateemail.com",
  port: 465,
  secure: true,
  auth: { user: "admin@thankyousomuch.ai", pass: process.env.TYSM_SMTP_PASSWORD },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  logger: false,
  debug: false,
});
const archive = createSentArchive();

async function disableFinishedWorkflow() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) return;
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/scheduled-outreach.yml/disable`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) throw new Error(`Could not disable finished scheduler: HTTP ${response.status}`);
  console.log("Scheduler disabled; no further automatic attempts.");
}

try {
  const result = await processQueue(queue, {
    save: async value => {
      value.updatedAt = new Date().toISOString();
      const saved = await put(pathname, JSON.stringify(value, null, 2), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        ifMatch: etag,
        cacheControlMaxAge: 60,
      });
      etag = strongETag(saved.etag);
    },
    send: recipient => sendMailAndArchive(transport, {
      from: { name: "TYSM", address: "admin@thankyousomuch.ai" },
      to: recipient.email,
      replyTo: "admin@thankyousomuch.ai",
      subject: recipient.subject,
      text: recipient.text,
      messageId: recipient.messageId,
      disableFileAccess: true,
      disableUrlAccess: true,
    }, {
      archive,
      onArchiveError: () => console.warn("SMTP accepted email; Sent copy failed. Recipient will not be resent."),
    }),
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  });
  // Public Actions logs contain counts/timing only, never recipient data.
  console.log(JSON.stringify(result));
  if (result.complete || result.needsReview) await disableFinishedWorkflow();
  if (result.needsReview) throw new Error("Campaign paused for review; no ambiguous delivery will be retried.");
} finally {
  transport.close();
  await archive.close();
}
