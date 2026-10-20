import { createTransport } from "nodemailer";
import { ImapFlow } from "imapflow";

export async function composeMail(mail) {
  const composer = createTransport({ streamTransport: true, buffer: true, newline: "windows" });
  const result = await composer.sendMail(mail);
  if (!Buffer.isBuffer(result.message)) throw new Error("Could not compose Sent copy");
  return { raw: result.message, messageId: result.messageId };
}

export function createSentArchive({
  user = "admin@thankyousomuch.ai",
  password = process.env.TYSM_SMTP_PASSWORD,
  clientFactory = options => new ImapFlow(options),
} = {}) {
  let session;
  let client;
  async function connect() {
    if (!session) {
      session = (async () => {
        if (!user || !password) throw new Error("Sent archive credentials unavailable");
        client = clientFactory({
          host: "mail.privateemail.com",
          port: 993,
          secure: true,
          auth: { user, pass: password },
          logger: false,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          disableAutoIdle: true,
          tls: { minVersion: "TLSv1.2" },
        });
        client.on("error", () => {});
        await client.connect();
        const folders = await client.list();
        const sent = folders.find(folder => folder.specialUse === "\\Sent")
          || folders.find(folder => ["sent", "sent items", "sent messages", "inbox.sent"].includes(folder.path.toLowerCase()));
        if (!sent) throw new Error("Mailbox has no identifiable Sent folder");
        return { client, path: sent.path };
      })().catch(error => {
        client?.close();
        session = undefined;
        throw error;
      });
    }
    return session;
  }

  return {
    async append({ raw, messageId, date = new Date() }) {
      if (!messageId || /[\r\n]/.test(messageId) || !Buffer.isBuffer(raw)) {
        throw new Error("Invalid Sent copy");
      }
      const { client, path } = await connect();
      const lock = await client.getMailboxLock(path);
      try {
        const existing = await client.search({ header: { "message-id": messageId } }, { uid: true });
        if (existing?.length) return { status: "already_present", folder: path, uid: existing[0] };
        const appended = await client.append(path, raw, ["\\Seen"], date);
        if (!appended) throw new Error("Sent copy was not accepted by IMAP");
        return { status: "saved", folder: path, uid: appended.uid || null };
      } finally {
        lock.release();
      }
    },
    async close() {
      try {
        if (client?.usable) await client.logout();
      } catch {
        // An accepted SMTP email must never become a send failure because
        // closing the independent IMAP connection failed.
      } finally {
        client?.close();
        session = undefined;
      }
    },
  };
}

export async function sendMailAndArchive(transport, mail, { archive, onArchiveError = () => {} }) {
  const composed = await composeMail(mail);
  const result = await transport.sendMail({ ...mail, messageId: composed.messageId, raw: composed.raw });
  if (!result.accepted?.length) return result;
  try {
    const sentCopy = await archive.append({
      raw: composed.raw,
      messageId: composed.messageId,
      date: mail.date || new Date(),
    });
    return { ...result, sentCopy };
  } catch {
    // Never re-send an accepted email just because filing its Sent copy failed.
    try { onArchiveError(); } catch { /* Notification errors cannot change SMTP acceptance. */ }
    return { ...result, sentCopy: { status: "failed" } };
  }
}
