import {
  CONTACT_SMS_HREF,
  CONTACT_SMS_LABEL,
  PRIVACY_URL,
  SMS_CTA,
} from '../legal-copy';

export function SmsCta() {
  return (
    <div className="mt-6 max-w-xl space-y-3" data-testid="phone-contact">
      <p className="mono text-xs font-bold uppercase tracking-wide">Contact us</p>
      <a
        href={CONTACT_SMS_HREF}
        className="display inline-block py-2 text-2xl text-[#6EB2FF] underline decoration-[#6EB2FF] underline-offset-4 visited:text-[#6EB2FF] hover:text-[#6EB2FF] active:text-[#6EB2FF] focus-visible:text-[#6EB2FF] sm:text-3xl"
        data-testid="contact-phone"
      >
        {CONTACT_SMS_LABEL}
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
