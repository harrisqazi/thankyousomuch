# Thank You So Much

The website and phone/SMS lead-capture system share this repository and the
existing Vercel project. No separate Render API is needed.

## Edit the phone system

| What you want to change | Open this file |
| --- | --- |
| Add a business, phone number, notification email, or select its voice flow | [phone-numbers.ts](artifacts/api-server/src/phone-system/phone-numbers.ts) |
| Change spoken words, basic voice, SMS introduction, or keypad actions | [text-to-speech.ts](artifacts/api-server/src/phone-system/text-to-speech.ts) |
| Add a new business, step by step | [Phone setup guide](artifacts/api-server/src/phone-system/README.md) |
| Configure Telnyx, hosting, consent, and live testing | [Deployment and demo guide](docs/telnyx-demo.md) |

**Start here:** [Add a business in 10 steps](artifacts/api-server/src/phone-system/README.md#add-a-business-in-10-steps).

The number file selects a named voice flow. The backend automatically uses that
mapping for incoming calls, keypad choices, SMS events, private storage, and owner
notifications. Routine edits do not require changing webhook routes.

The current TYSM flow uses **press 1** for explicit consent to inquiry-related
texts. This captures leads; it does not book a calendar slot or automatically
configure a customer's existing phone line.

```sh
pnpm --filter @workspace/scripts phone:check
pnpm --filter @workspace/scripts telnyx:test
pnpm --filter @workspace/api-server typecheck
```

These checks do not send real SMS or emails. Code configuration alone is not
carrier approval or proof of a working live call. New businesses default to
outgoing SMS disabled; private incoming lead capture and owner notifications are
separate from permission to send texts.

## Other useful files

- Website menu: [MenuSection.tsx](artifacts/good-work-menu/src/components/MenuSection.tsx)
- Website opening section: [HeroIntro.tsx](artifacts/good-work-menu/src/components/HeroIntro.tsx)
- API entry point: [app.ts](artifacts/api-server/src/app.ts)
- Serverless routing: [vercel.json](vercel.json)

Keep credentials in the host's secret settings, never in GitHub. Configuration
files in this public repository should contain business-facing information only.
