# Scheduled outreach

## One-time activation

The private queue and encrypted repository secrets are already prepared. The
connected GitHub app can update regular source files and Actions secrets, but
refuses creation of workflow files. The owner must commit the workflow once.

1. [Create the prefilled scheduler file](https://github.com/harrisqazi/thankyousomuch/new/main?filename=.github%2Fworkflows%2Fscheduled-outreach.yml&value=name%3A%20Scheduled%20TYSM%20outreach%0A%0Aon%3A%0A%20%20schedule%3A%0A%20%20%20%20-%20cron%3A%20%227%2C17%2C27%2C37%2C47%2C57%20*%20*%20*%20*%22%0A%20%20workflow_dispatch%3A%0A%0Apermissions%3A%0A%20%20contents%3A%20read%0A%20%20actions%3A%20write%0A%0Aconcurrency%3A%0A%20%20group%3A%20tysm-scheduled-outreach%0A%20%20cancel-in-progress%3A%20false%0A%0Ajobs%3A%0A%20%20send-due-emails%3A%0A%20%20%20%20runs-on%3A%20ubuntu-latest%0A%20%20%20%20timeout-minutes%3A%208%0A%20%20%20%20steps%3A%0A%20%20%20%20%20%20-%20uses%3A%20actions%2Fcheckout%40v4%0A%20%20%20%20%20%20%20%20with%3A%0A%20%20%20%20%20%20%20%20%20%20persist-credentials%3A%20false%0A%20%20%20%20%20%20-%20uses%3A%20pnpm%2Faction-setup%40v4%0A%20%20%20%20%20%20%20%20with%3A%0A%20%20%20%20%20%20%20%20%20%20version%3A%2010.26.1%0A%20%20%20%20%20%20-%20uses%3A%20actions%2Fsetup-node%40v4%0A%20%20%20%20%20%20%20%20with%3A%0A%20%20%20%20%20%20%20%20%20%20node-version%3A%20%2222%22%0A%20%20%20%20%20%20%20%20%20%20cache%3A%20pnpm%0A%20%20%20%20%20%20-%20run%3A%20pnpm%20install%20--frozen-lockfile%0A%20%20%20%20%20%20-%20run%3A%20node%20--test%20scripts%2Foutreach%2Fscheduler.test.mjs%0A%20%20%20%20%20%20-%20name%3A%20Deliver%20due%20emails%20from%20the%20private%20queue%0A%20%20%20%20%20%20%20%20run%3A%20node%20scripts%2Foutreach%2Frun-scheduled.mjs%0A%20%20%20%20%20%20%20%20env%3A%0A%20%20%20%20%20%20%20%20%20%20BLOB_READ_WRITE_TOKEN%3A%20%24%7B%7B%20secrets.TYSM_OUTREACH_BLOB_TOKEN%20%7D%7D%0A%20%20%20%20%20%20%20%20%20%20TYSM_SMTP_PASSWORD%3A%20%24%7B%7B%20secrets.TYSM_OUTREACH_SMTP_PASSWORD%20%7D%7D%0A%20%20%20%20%20%20%20%20%20%20OUTREACH_QUEUE_PATH%3A%20outreach%2F80d3f7acd5bed3dc%2Fqueue.json%0A%20%20%20%20%20%20%20%20%20%20GITHUB_TOKEN%3A%20%24%7B%7B%20github.token%20%7D%7D%0A).
2. Select **Commit changes**, commit directly to **main**, and confirm.

No password or contact-list entry is needed. You do not need to return to the
chat after committing. The first batch becomes eligible October 19, 2026 at
12:07 p.m. America/New_York time; if activated later, it runs on a subsequent
scheduled check. The final contact waits at least 61 minutes after the first
batch finishes. The earlier 16 accepted contacts are not resent.

## Operation

The GitHub workflow runs independently of Replit and checks a private Vercel Blob
queue every ten minutes. GitHub may delay scheduled runs, so times are earliest
eligible times, not guaranteed delivery times.

- Approved contact details and message content exist only in private Blob storage.
- Mailbox and Blob credentials are encrypted GitHub Actions repository secrets.
- Public source and Actions logs contain no contact list or message bodies.
- Every attempt is saved before SMTP; every acceptance is saved afterward.
- Accepted contacts are never automatically resent.
- The final batch waits at least 61 minutes after the last first-batch acceptance.
- Explicit hourly-limit rejections wait another 61 minutes automatically.
- Ambiguous SMTP outcomes or interrupted attempts stop for human review.
- The workflow disables itself when complete or when manual review is required.
- "Accepted" means SMTP acceptance, not confirmed inbox delivery.

The one-time campaign has 14 never-attempted contacts in its first batch and one
previously rejected contact in its final batch. The 16 previously accepted
contacts are excluded. It reuses the owner's approved messages.

Run the no-send tests with:

```sh
node --test scripts/outreach/scheduler.test.mjs
```

Do not run the sender locally without the private queue and mailbox credentials.
To review progress, open the repository's **Actions → Scheduled TYSM outreach**.
After completion, remove the two `TYSM_OUTREACH_*` Actions secrets if no further
campaign is planned. Do not re-enable a paused workflow until its private queue
and SMTP results have been reviewed.
