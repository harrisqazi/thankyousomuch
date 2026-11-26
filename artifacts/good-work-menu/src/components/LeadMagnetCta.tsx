import {
  CONTACT_SMS_HREF,
  CONTACT_SMS_LABEL,
  LEAD_MAGNET_DISCLOSURE,
  LEAD_MAGNET_LINE,
} from '../legal-copy';

const smsLinkClass =
  'text-[#6EB2FF] underline decoration-[#6EB2FF] underline-offset-4 visited:text-[#6EB2FF] hover:text-[#6EB2FF] active:text-[#6EB2FF] focus-visible:text-[#6EB2FF]';

export function HeaderLeadMagnet() {
  return (
    <div className="flex min-w-0 flex-col items-end text-right" data-testid="header-lead-magnet">
      <a
        href={CONTACT_SMS_HREF}
        className={`display text-[1.05rem] leading-none tracking-[-.04em] sm:text-xl ${smsLinkClass}`}
        data-testid="header-phone"
      >
        {CONTACT_SMS_LABEL}
      </a>
      <p className="mono mt-1 max-w-[18rem] text-[.58rem] font-medium uppercase leading-snug tracking-[.08em] text-[#161616]/80 sm:max-w-none sm:text-[.62rem]">
        Opens your messages app
      </p>
    </div>
  );
}

export function ProductLeadMagnet() {
  return (
    <div
      className="mb-5 border-2 border-white bg-white px-4 py-4 text-[#161616] sm:mb-7 sm:px-6 sm:py-5"
      data-testid="product-lead-magnet"
    >
      <p className="mono text-[.62rem] font-bold uppercase tracking-[.16em]">Talk to us now</p>
      <a
        href={CONTACT_SMS_HREF}
        className={`display mt-1 inline-block text-3xl sm:text-4xl ${smsLinkClass}`}
        data-testid="menu-phone"
      >
        {CONTACT_SMS_LABEL}
      </a>
      <p className="mt-2 text-sm font-extrabold uppercase tracking-wide" data-testid="menu-lead-line">
        {LEAD_MAGNET_LINE}
      </p>
      <p className="mt-2 text-[.7rem] font-semibold leading-relaxed text-[#161616]/80">
        {LEAD_MAGNET_DISCLOSURE} Privacy:{' '}
        <a className="underline underline-offset-2" href="/privacy">thankyousomuch.ai/privacy</a>
      </p>
    </div>
  );
}
