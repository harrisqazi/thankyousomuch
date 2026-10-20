import test from "node:test";
import assert from "node:assert/strict";
import { composeMail, createSentArchive, sendMailAndArchive } from "./sent-mail.mjs";

const mail = {
  from: "TYSM <sender@example.com>",
  to: "recipient@example.com",
  subject: "Original subject",
  text: "Original body",
  messageId: "<stable-id@example.com>",
  date: new Date("2026-10-19T14:36:00Z"),
};

test("SMTP and Sent receive identical message bytes and stable Message-ID", async () => {
  let sent;
  let archived;
  const result = await sendMailAndArchive({
    sendMail: async value => { sent = value; return { accepted: [mail.to] }; },
  }, mail, {
    archive: { append: async copy => { archived = copy; return { status: "saved" }; } },
  });
  assert.equal(sent.raw, archived.raw);
  assert.equal(sent.messageId, mail.messageId);
  assert.equal(archived.messageId, mail.messageId);
  assert.match(archived.raw.toString(), /Message-ID: <stable-id@example.com>/i);
  assert.match(archived.raw.toString(), /Original body/);
  assert.equal(result.sentCopy.status, "saved");
});

test("a rejected SMTP send does not create a misleading Sent copy", async () => {
  let appended = false;
  await assert.rejects(sendMailAndArchive({
    sendMail: async () => { throw new Error("SMTP rejected"); },
  }, mail, {
    archive: { append: async () => { appended = true; } },
  }), /SMTP rejected/);
  assert.equal(appended, false);
});

test("IMAP failure never turns SMTP acceptance into a resend", async () => {
  let sends = 0;
  let warnings = 0;
  const result = await sendMailAndArchive({
    sendMail: async () => { sends++; return { accepted: [mail.to] }; },
  }, mail, {
    archive: { append: async () => { throw new Error("IMAP unavailable"); } },
    onArchiveError: () => { warnings++; },
  });
  assert.equal(sends, 1);
  assert.equal(warnings, 1);
  assert.equal(result.sentCopy.status, "failed");
  assert.deepEqual(result.accepted, [mail.to]);
});

function imapFixture(existing = []) {
  const appended = [];
  const queries = [];
  let releases = 0;
  const client = {
    on() {},
    async connect() {},
    async list() { return [{ path: "Inbox" }, { path: "Sent", specialUse: "\\Sent" }]; },
    async getMailboxLock(path) {
      assert.equal(path, "Sent");
      return { release() { releases++; } };
    },
    async search(query) { queries.push(query); return existing; },
    async append(...args) { appended.push(args); return { uid: 42 }; },
    usable: true,
    async logout() {},
    close() {},
  };
  return {
    archive: createSentArchive({ password: "mock-password", clientFactory: () => client }),
    appended,
    queries,
    get releases() { return releases; },
  };
}

test("backfill uses IMAP APPEND into the actual Sent folder with original date", async () => {
  const fixture = imapFixture();
  const composed = await composeMail(mail);
  const result = await fixture.archive.append({ ...composed, date: mail.date });
  assert.equal(result.status, "saved");
  assert.equal(fixture.appended[0][0], "Sent");
  assert.deepEqual(fixture.appended[0][2], ["\\Seen"]);
  assert.equal(fixture.appended[0][3], mail.date);
  assert.equal(fixture.releases, 1);
  await fixture.archive.close();
});

test("existing Message-ID skips APPEND, making repeated backfills safe", async () => {
  const fixture = imapFixture([42]);
  const result = await fixture.archive.append(await composeMail(mail));
  assert.equal(result.status, "already_present");
  assert.equal(fixture.appended.length, 0);
  assert.equal(fixture.queries[0].header["message-id"], mail.messageId);
  await fixture.archive.close();
});
