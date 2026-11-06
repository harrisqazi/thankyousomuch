import {
  CONTACT_NUMBER_DISPLAY,
  CONTACT_NUMBER_E164,
  PRIVACY_URL,
  SMS_CTA,
} from '../legal-copy';

export function SmsCta() {
  return (
    <div className="mt-6 max-w-xl space-y-3" data-testid="phone-contact">
      <p className="mono text-xs font-bold uppercase tracking-wide">Contact us</p>
      <a
        href={`tel:${CONTACT_NUMBER_E164}`}
        className="display inline-block py-2 text-2xl underline decoration-[#b9dce8] underline-offset-4 sm:text-3xl"
        data-testid="contact-phone"
      >
        {CONTACT_NUMBER_DISPLAY}
      </a>
      <p className="text-sm font-semibold leading-relaxed text-[#161616]" data-testid="sms-cta">
        {SMS_CTA}
      </p>
      <p className="text-xs leading-relaxed text-[#161616]/75">
        Full privacy policy:{' '}
        <a className="underline underline-offset-2" href="/privacy">{PRIVACY_URL}</a>
      </p>
    </div>
  );
}
