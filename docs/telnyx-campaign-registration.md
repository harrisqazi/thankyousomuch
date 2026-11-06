# TYSM carrier campaign registration

This is an application draft, not an approved campaign. Do not enable SMS or
claim carrier approval based on this document.

## Business and purpose

- Operating brand: Thank You So Much (TYSM).
- Parent company: Frame of Reference, confirmed by the owner.
- Reuse the existing verified Frame of Reference brand, subject to Telnyx review.
- Purpose: low-volume, customer-initiated callback and business-service inquiries
  for TYSM itself. This does not register unrelated client businesses.
- Proposed category: `LOW_VOLUME`, sub-use case `CUSTOMER_CARE`.
- No purchased lists, cold SMS, third-party lead sharing, or unrelated promotions.
- The provider qualification API currently reports $1.50/month and $4.50/quarter
  for this brand/category. Telnyx additionally lists $15 per campaign review.
  Confirm current fees and owner approval before submission; repeated reviews
  can add fees. Do not silently resubmit a rejected or ambiguous request.

## Public supporting links

These must actually be deployed and publicly readable before they are included
in an application:

- Website: https://www.thankyousomuch.ai/
- Privacy: https://www.thankyousomuch.ai/privacy
- SMS terms: https://www.thankyousomuch.ai/sms-terms

## Proposed description

Thank You So Much (TYSM), operated by Frame of Reference, responds to people who
request a callback about TYSM's business automation services. A consenting
inquirer receives a number-confirmation text asking for their name, business,
and preferred callback number. Replies are privately retained and forwarded to
the TYSM team for human follow-up. The program does not book appointments,
automatically call customers, or send unsolicited SMS.

## Resubmit after TCR 806 (paste these URLs and CTA)

Campaign `4b3001a1-a4f0-f950-3e1d-07cba9b7024a` was rejected with TCR 806. After
https://www.thankyousomuch.ai/privacy and https://www.thankyousomuch.ai/sms-terms
are deployed, Harris resubmits in the Telnyx portal ($15 review fee). Do not
submit from the API.

Privacy policy URL:

    https://www.thankyousomuch.ai/privacy

Terms / SMS program URL:

    https://www.thankyousomuch.ai/sms-terms

Message Flow / Call To Action:

    To opt in to Thank You So Much (TYSM) inquiry texts on mobile, call (859) 715-8052, hear the text-message disclosure, and press 1, or text HI, HELLO, or HEY to +18597158052. Reply HELP for help (email admin@thankyousomuch.ai). Reply STOP to opt out. Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Privacy policy: https://www.thankyousomuch.ai/privacy

## Actual opt-in flow

Consumers find the dedicated contact number on the TYSM website. They either
call it, hear an SMS disclosure before the keypad prompt, and press 1; or
initiate a conversation by texting HI, HELLO, or HEY. The calling number,
consent choice and disclosure version are retained. Consent is not a condition
of purchase. Texting the business initiates only this inquiry conversation,
not unrelated marketing. A website form submission alone is not SMS consent.

Message frequency varies; message and data rates may apply. STOP suppresses
future texts. HELP provides the support address admin@thankyousomuch.ai. START
can restore opt-in after STOP. Verify provider keyword handling and ensure the
application and provider messages match before declaring those features ready.

## Sample introduction

The number below is a fictional example, not the owner's test recipient:

> Thank You So Much: We've saved your number as +12025550123 and will call
> during regular business hours. What's your name and business and preferred
> call back number? We look forward to helping your business grow. Reply with
> Name: ...; Business: ...; Callback: ... Msg frequency varies. Msg & data rates
> may apply. Reply STOP to opt out, HELP for help.

This is multipart SMS. Do not price it as a single SMS segment.

## Release checklist

1. Publish and verify the supporting website disclosures.
2. Obtain approval for the actual upfront and recurring charges and any
   provider terms requiring acceptance. No invented legal information.
3. Recheck for an existing campaign to avoid duplicate paid registration.
4. Submit once with a stable reference, truthful description, actual sample,
   embedded-phone declaration, and valid public privacy/terms links.
5. Distinguish registry acceptance from Telnyx/carrier approval. Assign the
   dedicated number only when eligible, and verify provisioning completion.
6. Verify STOP/HELP and account restrictions; enable live settings only after
   all approval gates are satisfied.
7. Release the fresh production credential and live settings through the
   owner-controlled Vercel deployment.
8. Run the authorized personal test and real call/press-one and inbound-HI
   journeys. Check delivery, private reply storage, and owner email separately.
   Never fake an inbound call or retry an ambiguous outbound send.

## References

- https://support.telnyx.com/en/articles/5634625-10dlc-fees-and-charges
- https://support.telnyx.com/en/articles/7127078-10dlc-campaign-approval-best-practices
- https://developers.telnyx.com/api-reference/campaign/qualify-by-usecase
- https://developers.telnyx.com/api-reference/campaign/submit-campaign
