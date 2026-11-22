import {
  CONTACT_NUMBER_DISPLAY,
  CONTACT_NUMBER_E164,
  LEAD_MAGNET_DISCLOSURE,
  LEAD_MAGNET_LINE,
} from '../legal-copy';

export function HeaderLeadMagnet() {
  return (
    <div className="flex min-w-0 flex-col items-end text-right" data-testid="header-lead-magnet">
      <a
        href={`tel:${CONTACT_NUMBER_E164}`}
        className="display text-[1.05rem] leading-none tracking-[-.04em] underline decoration-[#6EB2FF] underline-offset-4 sm:text-xl"
        data-testid="header-phone"
      >
        {CONTACT_NUMBER_DISPLAY}
      </a>
      <p className="mono mt-1 max-w-[18rem] text-[.58rem] font-medium uppercase leading-snug tracking-[.08em] text-[#161616]/80 sm:max-w-none sm:text-[.62rem]">
        Text HI · or call, press 1
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
        href={`tel:${CONTACT_NUMBER_E164}`}
        className="display mt-1 inline-block text-3xl underline decoration-[#cd1725] underline-offset-4 sm:text-4xl"
        data-testid="menu-phone"
      >
        {CONTACT_NUMBER_DISPLAY}
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
