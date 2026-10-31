# Telnyx inquiry recovery demo

## Status

Implemented in the existing Express API; the website and its lead form are preserved.
No external Render service is required. This is a **direct-call, press-1 demo**,
not automatic detection of missed calls to another business number.

**Not live yet.** Vercel access and Telnyx API credentials have been verified.
Messaging approval, keyword configuration, publishing, and a real call/SMS test
must still be completed. Outbound application SMS remains disabled.
Do not assign a production number to unverified endpoints. Successful account
authentication is not proof of access to this Vercel project or its owning team;
verify project access before changing production configuration.

## What was reused

- Express, the Vercel bundled API handler, and the existing pnpm workspace.
- Existing private Vercel Blob storage for production, with atomic ETag-conditional writes.
  The PostgreSQL database/table remains available for local development.
- Existing inquiry email transport, sender configuration, and Sent-folder handling.
- Existing website inquiries and their private JSON backups are unchanged.

## Configuration

Start with the [number and voice editing guide](../artifacts/api-server/src/phone-system/README.md).
Numbers live in `phone-numbers.ts`; spoken greetings and keypad actions live in
`text-to-speech.ts`. Each number selects a named flow, and callers' original flow
configuration is saved for that call. Legacy calls must restart after this upgrade.

Enter credentials through **Replit Secrets**, never source code or chat:

| Secret | Purpose |
| --- | --- |
| `TELNYX_API_KEY` | Telnyx API v2 key authorized to send messages |
| `TELNYX_PUBLIC_KEY` | Base64 Ed25519 public key from Telnyx Keys & Credentials; used for BOTH TeXML and messaging |
| `BLOB_READ_WRITE_TOKEN` | Already configured in Vercel; private JSON persistence for production |
| `DATABASE_URL` | Existing runtime-managed PostgreSQL connection for local development; not required in Blob mode |
| `TYSM_SMTP_PASSWORD` | Existing password for `admin@thankyousomuch.ai`; retain the working SMTP setup |

Do not request or manually change Replit's runtime-managed DATABASE_URL.
Replit Secrets do not automatically configure a separate Vercel project.
Use a secure Vercel environment-variable flow to configure its production secrets.
Never copy credentials into a repository, deployment log, or this document.

Non-secret environment variables:

```text
TELNYX_SMS_ENABLED=false
TELNYX_DRY_RUN=true
TELNYX_MESSAGING_APPROVED=false
TELNYX_KEYWORDS_CONFIRMED=false
TELNYX_NOTIFY_TO=admin@thankyousomuch.ai
TELNYX_HOURLY_LIMIT=10
TELNYX_CONTACT_DAILY_LIMIT=2
```

Production additionally sets `TELNYX_STORAGE_BACKEND=blob`. Development defaults
to `postgres`. Storage choice is explicit; missing credentials or storage errors
fail closed rather than silently writing to a different database. No existing
website inquiries or development records are moved or replaced.

Only after Telnyx approves the US messaging campaign/number and keywords are
verified, set SMS_ENABLED=true, DRY_RUN=false, MESSAGING_APPROVED=true and
KEYWORDS_CONFIRMED=true. All four switches AND both credentials are required.
The individual business must also have `outboundSmsApproved: true` in
`phone-numbers.ts`; all configured businesses start unapproved.
A saved dry-run intro is never replayed automatically when live mode is enabled:
make a new call for the live test.

Current dedicated number: **+18597158052**.
Messaging profile: **4001a187-12aa-4fc5-88e5-54ec1d310c50**.

Only the TYSM demo is configured by default. Future businesses use the server-only
`TELNYX_BUSINESSES_JSON` array with `id`, `name`, `number`, `profileId`, `recipient`,
`helpContact`, `providerManagedHelp`, `flowId`, and `outboundSmsApproved`.
That legacy server-side variable overrides the entire editable number file.
Numbers, IDs, AND profiles must be unique.
Separate profiles are required because Telnyx opt-outs apply to an entire profile.
There is no default/fallback tenant for unknown numbers.

## Deploy and assign the number

1. For local PostgreSQL development, apply the additive database migration:
   `pnpm --filter @workspace/scripts telnyx:migrate`.
   This creates `telnyx_demo_state`; it does not modify existing inquiry storage.
   Production uses the existing private Vercel Blob store and needs no SQL migration
   or new database service. If switching to a managed Replit production database,
   use Replit Publish's supported schema flow, not a custom production migration.
2. Publish this changed repository through the existing Vercel project. Keep
   repository root as its Root Directory; the existing build bundles API and
   website together. Set production secrets and `TELNYX_STORAGE_BACKEND=blob` first.
3. Verify `GET https://www.thankyousomuch.ai/health` returns JSON with
   `storageReady: true` and `mode: "dry_run"` before changing Telnyx settings.
   These are **exact intended URLs on the real existing domain, not verified live
   demo endpoints until the new deployment succeeds**:

   | HTTP method | URL | Telnyx setting |
   | --- | --- | --- |
   | POST | https://www.thankyousomuch.ai/voice/incoming | TeXML Application Voice URL |
   | POST | https://www.thankyousomuch.ai/voice/selection | Gather action, generated automatically |
   | POST | https://www.thankyousomuch.ai/webhooks/telnyx/messaging | Messaging Profile webhook URL |
   | GET | https://www.thankyousomuch.ai/health | Readiness report; not a Telnyx callback |

4. In Telnyx Mission Control → Voice → Programmable Voice → **TeXML Applications**,
   create/edit the TYSM demo application. Set Voice URL to the incoming URL above,
   and **Voice Method POST**. Do not use a Voice API/Call Control JSON application.
   The form-encoded TeXML requests and Gather callbacks must include Telnyx's
   `telnyx-signature-ed25519` and `telnyx-timestamp` headers; unsigned requests are
   rejected. If a legacy application does not sign its TeXML fetches, stop and
   resolve its supported signing configuration with Telnyx; never disable validation.
5. In that application's Numbers tab, assign **+18597158052**. Alternatively
   edit that number's voice application/connection assignment to this TeXML application.
   Do not assign other customer businesses' numbers.
6. In Messaging → Messaging Profiles, open the exact profile ID above. Assign the
   same number, set its Messaging API **v2** webhook to the messaging URL above.
   Attach the required approved 10DLC campaign for this US local number.
7. Configure profile keyword auto-responses (US):
   - STOP, STOPALL, STOP ALL, UNSUBSCRIBE, CANCEL, END, QUIT:
     `Thank You So Much: You are unsubscribed. No more messages will be sent. Reply START to opt back in.`
   - HELP, INFO:
     `Thank You So Much: For help email admin@thankyousomuch.ai. Reply STOP to opt out. Msg & data rates may apply.`
   - START, UNSTOP: the provider removes its profile-level block.
   The app saves all these inbound messages and opt-out state but does not send a
   second STOP/HELP confirmation when the profile handles it.
8. Verify provider approval and auto-responses before setting the live switches.
   Existing Vercel deployment protection must not block Telnyx webhooks. Request
   authentication is the Ed25519 signature, not a logged URL token or a public bypass.

## Live test checklist

For a direct-text lead test after the live messaging webhook is connected, text:
“Hi, I'm Alex. I'd like to request an appointment tomorrow afternoon. Please
contact me.” Check private storage and email to admin@thankyousomuch.ai. This
does not require a prior call and does not reserve an appointment.

1. In dry run, call the number from a mobile phone. Verify the business name,
   press-1 prompt, message frequency/rate disclosure, STOP/HELP, and voluntary consent.
2. Hang up without pressing 1; verify no consent or outbound job was created.
3. Call again and press 1. Verify caller, called number, call ID, timestamp,
   and disclosure were persisted; the SMS job is `dry_run`, not "sent."
4. After all approval/configuration checks, enable live sending and make a NEW call.
   Press 1; expect exactly one introduction asking how the business can help.
5. Reply with a short inquiry. Verify the private database message and notification
   at TELNYX_NOTIFY_TO. Check the configured mailbox's Sent folder separately.
6. Reply HELP; verify ONE provider support response and a stored/email notification.
7. Reply STOP; verify provider confirmation, persisted opt-out, and no further app
   SMS even after calling/pressing 1 again. START removes the provider block;
   the app still requires recorded voice consent.
8. Inspect delivery events. `accepted`/`queued`/`sent` do NOT mean delivered.
   A finalized `delivered` event is the confirmation; failed/unknown final statuses
   generate an owner notification.
9. Replay a signed webhook in Telnyx's debugger: no duplicate introduction or
   notification. Invalid signatures/stale timestamps must return 403.

## Reliability and private records

Storage retains consent, call records, inbound messages, delivery statuses, and
a durable notification/SMS outbox separately for each business. Production uses
private JSON at `telnyx-demo/v1/{environment}/{businessId}.json` in the existing
Vercel Blob store. Production, preview, and development namespaces are separate.
Every update uses an ETag conditional write; concurrent changes are re-read and
retried, never unconditionally overwritten. Reads bypass CDN caching. Ambiguous
writes fail rather than blindly replaying the mutation. Development uses PostgreSQL
row locks for the same StateStore interface. No message content is served by a
public export endpoint.

Webhooks persist before acknowledging and then process jobs using Vercel waitUntil.
The outbox is durable, but it is **not an independently scheduled queue service**:
if execution dies after acknowledgment, run the recovery command below. New
webhooks also drain pending work. Each invocation processes at most 25 jobs.
For unattended production operation, add a regularly scheduled recovery worker
before promising automatic retries during outages.

```sh
pnpm --filter @workspace/scripts telnyx:jobs
```

Run against the intended storage backend with the intended server environment. Output
contains business IDs and job status counts, not phone numbers or message content.
`processing` after a crash, or `uncertain` after a network/SMTP ambiguity, requires
checking Telnyx message records or SMTP delivery before any manual resend.
The system deliberately does not automatically resend those operations.
Telnyx submissions use a stable Idempotency-Key, but its replay window is limited
to 24 hours, so it is not a permanent substitute for durable claims.
SMS API rejection and failed delivery create owner notification jobs. If email
itself fails, its failed/uncertain job remains available for review; this does not
erase the inbound SMS. SMTP acceptance is not proof of inbox delivery.

Limit defaults: 10 attempted app SMS/business/hour and 2/contact/day. Provider
auto-responses have their own limits. Attempts reserve capacity before API calls.
An already-in-flight external send cannot be recalled by a subsequently arriving STOP.
The demo fails closed at 8 MB/business rather than deleting opt-outs or consent.
Before larger-scale use, add archival/retention and normalized indexed tables.

## Verification commands

```sh
pnpm --filter @workspace/scripts telnyx:test
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server build
```

Tests use synthetic credentials, reserved example phone numbers, fake transports,
and an isolated temporary development-database tenant; they send no SMS or email.

## Official references checked

- https://developers.telnyx.com/api-reference/callbacks/texml-gather
- https://developers.telnyx.com/api-reference/callbacks/texml-call-initiated
- https://developers.telnyx.com/docs/voice/programmable-voice/texml-setup
- https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/gather
- https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks
- https://developers.telnyx.com/docs/messaging/messages/advanced-opt-in-out
- https://developers.telnyx.com/api-reference/messages/send-a-message

TeXML uses form-encoded CallSid/From/To/Digits; messaging uses the v2 JSON data
envelope. Both are verified against the exact original bytes with Ed25519 and a
five-minute timestamp window, not a Twilio HMAC copied into a Telnyx integration.
