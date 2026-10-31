# Phone System Editing Guide

## Which file do I edit?

```text
phone-system/
  phone-numbers.ts     Numbers, businesses, recipients, and flow assignments
  text-to-speech.ts    What callers hear; voice, key choices, and intro SMS
  flows.ts            Validation, placeholders, mandatory SMS disclosures
  check.ts            Configuration checker
```

The existing `../telnyx/` folder handles signatures, webhooks, private records,
consent enforcement, delivery and retries. You should not need to edit those
files to add a standard business.

The number entry's `recipient` controls phone-lead notifications. The optional
server-side `TELNYX_NOTIFY_TO` overrides TYSM's recipient only; unrelated website
form settings such as `LEAD_TO_EMAIL` do not override phone businesses.

## Add a business in 10 steps

1. **Get its dedicated number in Telnyx.** Enable the necessary voice and SMS
   capabilities. Adding a number to code does not purchase, port, forward, or
   connect it. Obtain the business's authorization and required registration
   information before setting up its messaging.
2. **Create its separate messaging profile.** Record that profile's ID. Use a
   different profile for each business so one business's STOP list does not
   affect another. Complete required carrier/campaign registration; an enabled
   profile alone is not messaging approval.
3. **Open [`phone-numbers.ts`](phone-numbers.ts) in GitHub.** Click the pencil.
   Copy an entry inside the `phoneNumbers` array and change the fields below.
   The numbers/emails in this example are placeholders, not an active business:

   ```ts
   {
     id: "example-plumbing",
     name: "Example Plumbing",
     number: "+12025550199",             // replace with the real Telnyx number
     profileId: "REPLACE_WITH_PROFILE_ID",
     recipient: "owner@example.com",     // who receives lead notifications
     helpContact: "help@example.com",    // real support email
     providerManagedHelp: true,
     flowId: "business-inquiry",
     outboundSmsApproved: false,         // leave false until step 9
   },
   ```

   Keep the comma between entries. Business IDs, numbers, and profile IDs must
   each be unique. **Never rename an existing business ID:** saved records belong
   to that ID. Initially this setup supports one dedicated number per business.
   Do not use another ID for the same business merely to bypass limits or STOP.
4. **Choose what callers hear.** `business-inquiry` already says the business name
   automatically and uses press 1. For a custom greeting, open
   [`text-to-speech.ts`](text-to-speech.ts), copy the complete `business-inquiry`
   flow under a new unique name such as `"plumbing-inquiry"`, edit its text, and
   set the number entry's `flowId` to `"plumbing-inquiry"`. Increment the flow's
   `version` whenever you change a greeting or its options.
5. **Check your edits.** In the Replit terminal run:

   ```sh
   pnpm --filter @workspace/scripts phone:check
   pnpm --filter @workspace/scripts telnyx:test
   pnpm --filter @workspace/api-server typecheck
   ```

   The checker rejects duplicate mappings, missing flows, unsupported voices,
   invalid keys/actions and unknown placeholders. It does not validate Telnyx
   account permissions or prove delivery. The full test suite uses the existing
   development database for one isolated synthetic test, never the production
   lead store.
6. **Commit and publish through the existing Vercel project.** Review the changed
   files and commit them in GitHub, then confirm the connected Vercel deployment
   finishes successfully. Keep repository root as the Vercel Root Directory.
   Publishing in Replit does not update Vercel. If the host has
   `TELNYX_BUSINESSES_JSON`, it overrides this entire number file: update/remove
   that override deliberately or your GitHub number edits will not take effect.
7. **Connect Telnyx to the published API.** For this site's current intended
   host, the settings are:

   | Setting | Value |
   | --- | --- |
   | TeXML application's Voice URL | `https://www.thankyousomuch.ai/voice/incoming` |
   | Voice method | `POST` |
   | Messaging profile's v2 webhook URL | `https://www.thankyousomuch.ai/webhooks/telnyx/messaging` |
   | Readiness check | `https://www.thankyousomuch.ai/health` |

   These are intended addresses, not a claim that the new build is live.
   Verify health returns JSON with `storageReady: true` and unsigned webhook
   requests are rejected before assigning the number. Assign the real number to
   the correct TeXML application and its own messaging profile. Shared endpoints
   identify the business using the called/receiving number; do not add new routes.
8. **Configure keywords and test receiving a lead.** Configure profile-level
   STOP/START/HELP behavior and the business's help contact. Text a clearly marked
   demo appointment inquiry from your own phone. Verify its private saved record
   and email notification separately. Direct incoming SMS does not require a
   previous press-1 call, but depends on the provider allowing inbound delivery.
   It is an inquiry, not a booked appointment. SMTP acceptance is not proof of
   inbox delivery.
9. **Only enable sending after approval.** Verify this number's required
   carrier/campaign approval, its keyword behavior, and its consent wording, then
   change **that entry's** `outboundSmsApproved` to `true` and publish again.
   Server-side `TELNYX_SMS_ENABLED=true`, `TELNYX_DRY_RUN=false`,
   `TELNYX_MESSAGING_APPROVED=true`, and `TELNYX_KEYWORDS_CONFIRMED=true` plus valid
   Telnyx credentials are also required. Keep other unapproved businesses false;
   do not enable global flags to bypass registration. Required secrets belong in
   Vercel's settings, not this file.
10. **Make a fresh real test call.** Hear the correct business greeting, press 1,
    and check that exactly one intro text arrives. Reply with an inquiry, confirm
    private storage and owner notification, then test HELP and STOP. Also call
    without pressing anything and verify no intro text is sent. Dry-run jobs
    are not automatically resent when sending is enabled. Do not call a business
    live until these checks succeed.

## Change the voice or words

In `text-to-speech.ts`, edit the flow selected by that number:

- `voice: "woman"` or `voice: "man"` — basic Telnyx-generated speech; no recording
  or extra AI provider is needed.
- `language: "en-US"` — both basic voices support US English. Other languages or
  premium voices need a deliberate code/provider configuration change.
- `voiceSpeed: 1` — normal speed; supported range is `0.1`–`2`.
- `greeting` — what the caller hears.
- `introText` — what the introductory SMS says, after explicit consent and approval.
- `noInputMessage`, `invalidOptionMessage`, `consentSavedMessage`,
  `optedOutMessage` — spoken responses.

Available placeholders:

| Placeholder | Filled from |
| --- | --- |
| `{businessName}` | The number entry's `name` |
| `{helpContact}` | The number entry's `helpContact` |
| `{consentKey}` | The option whose action is `consent-and-text` |

**Keep `{consentKey}` in the greeting** rather than typing the number yourself.
Changing the consent option's key then changes the spoken number and accepted
input together. Mandatory consent/rate/STOP/HELP terms are added by the backend
and are not removed when you edit the marketing greeting.
The required notice plays before the keypad greeting, so a caller cannot skip
the notice by immediately pressing a key during the greeting.

Calls save their original greeting, voice, flow version and keypad map. Edits
apply to new calls, not silently to calls already in progress. Pre-upgrade calls
without that saved configuration must call again.

## Change what a keypad option does

Two actions are implemented:

```ts
options: {
  "1": { action: "consent-and-text" },
  "2": {
    action: "say-and-hang-up",
    message: "For help, email {helpContact}. Thank you for calling.",
  },
},
```

- **`consent-and-text`** records explicit consent and queues one introductory text.
  The worker still enforces approval, STOP, and sending limits.
- **`say-and-hang-up`** speaks the message and ends the call; it does not give SMS
  consent or send an intro.

Include any additional option in the spoken `greeting` so callers know it exists.
There must be exactly one consent option, and each key is one digit (`0`–`9`).
No input or an unconfigured key gives no consent.

A brand-new behavior, such as transferring a call or making a calendar booking,
requires implementation and tests in the backend. Typing a new action name does
not create that feature; unknown action names are rejected.

## Before and after

Previously `../telnyx/config.ts` held the number directly, while
`../telnyx/service.ts` mixed the greeting, hardcoded press 5 and delivery behavior.
Now `phone-numbers.ts` selects a flow, `text-to-speech.ts` defines its words and
options, and the existing backend performs those actions securely.

Official voice reference:
https://developers.telnyx.com/docs/voice/programmable-voice/texml-verbs/say
