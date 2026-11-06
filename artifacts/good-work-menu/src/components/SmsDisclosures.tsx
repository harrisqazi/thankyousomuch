import { PRIVACY_PARAGRAPHS, PRIVACY_URL, SMS_TERMS_PARAGRAPHS, SMS_TERMS_URL } from '../legal-copy';

/** Public disclosures on the homepage; dedicated crawlable pages live at /privacy and /sms-terms. */
export function SmsDisclosures() {
  return (
    <div className="mt-6 max-w-[80ch] space-y-4 text-xs leading-relaxed text-[#161616]/75">
      <p>Thank You So Much (TYSM) is operated by Frame of Reference.</p>
      <section id="privacy" className="scroll-mt-6" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="font-extrabold uppercase">Privacy notice</h2>
        {PRIVACY_PARAGRAPHS.map((paragraph) => (
          <p className="mt-2" key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <p className="mt-2">
          This notice is also published at{' '}
          <a className="underline underline-offset-2" href="/privacy">{PRIVACY_URL}</a>.
        </p>
      </section>
      <section id="sms-terms" className="scroll-mt-6" aria-labelledby="sms-terms-heading">
        <h2 id="sms-terms-heading" className="font-extrabold uppercase">SMS inquiry terms</h2>
        {SMS_TERMS_PARAGRAPHS.map((paragraph) => (
          <p className="mt-2" key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <p className="mt-2">
          These terms are also published at{' '}
          <a className="underline underline-offset-2" href="/sms-terms">{SMS_TERMS_URL}</a>.
          Privacy policy:{' '}
          <a className="underline underline-offset-2" href="/privacy">{PRIVACY_URL}</a>.
        </p>
      </section>
    </div>
  );
}
