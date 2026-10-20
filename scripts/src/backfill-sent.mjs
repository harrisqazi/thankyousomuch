// This command uses IMAP APPEND only. It never submits email to SMTP.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeMail, createSentArchive } from "../../artifacts/api-server/src/lib/sent-mail.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const argument = process.argv[2];
if (!argument) throw new Error("Provide the private outreach delivery JSONL path");
const source = path.resolve(root, argument);
const events = fs.readFileSync(source, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
const latest = new Map(events.map(event => [event.recipient, event]));
const accepted = [...latest.values()].filter(event => event.state === "accepted");
if (!accepted.length) throw new Error("No SMTP-accepted messages to backfill");
const archive = createSentArchive();
const auditPath = path.join(root, ".local/outreach/sent-copy-backfill.jsonl");
fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
let saved = 0;
let alreadyPresent = 0;

try {
  for (const acceptedEvent of accepted) {
    const original = events.find(event => event.recipient === acceptedEvent.recipient && event.state === "submitting");
    if (!original?.subject || !original.text || !acceptedEvent.messageId
      || !Number.isFinite(Date.parse(acceptedEvent.at))) {
      throw new Error("An accepted message is missing its original content or Message-ID");
    }
    const date = new Date(acceptedEvent.at);
    const composed = await composeMail({
      from: { name: "TYSM", address: "admin@thankyousomuch.ai" },
      to: acceptedEvent.recipient,
      replyTo: "admin@thankyousomuch.ai",
      subject: original.subject,
      text: original.text,
      date,
      messageId: acceptedEvent.messageId,
      headers: { "X-TYSM-Archive": "Backfilled copy of SMTP-accepted message; not a new send" },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const result = await archive.append({ ...composed, date });
    if (result.status === "saved") saved++;
    if (result.status === "already_present") alreadyPresent++;
    fs.appendFileSync(auditPath, JSON.stringify({
      at: new Date().toISOString(),
      recipient: acceptedEvent.recipient,
      messageId: acceptedEvent.messageId,
      ...result,
    }) + "\n", { mode: 0o600 });
  }
  console.log(JSON.stringify({ requested: accepted.length, saved, alreadyPresent, smtpSubmissions: 0 }));
} finally {
  await archive.close();
}
