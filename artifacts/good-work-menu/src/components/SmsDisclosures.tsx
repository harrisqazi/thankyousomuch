/** Public disclosures linked by the phone inquiry campaign application. */
export function SmsDisclosures() {
  return (
    <div className="mt-6 max-w-[80ch] space-y-4 text-xs leading-relaxed text-[#161616]/75">
      <p>Thank You So Much (TYSM) is operated by Frame of Reference.</p>
      <section id="privacy" className="scroll-mt-6" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="font-extrabold uppercase">Privacy notice</h2>
        <p className="mt-2">We collect the contact details and inquiry you provide, including your calling or texting number, messages, consent choices, and any name, business, or preferred callback number you share. We privately store inquiries and email them to our team to respond and retain a backup if email is unavailable.</p>
        <p className="mt-2">We use service providers to operate the website, store inquiries, and deliver calls, texts, and email. We do not sell your information or share mobile numbers, SMS opt-in information, or consent with third parties or affiliates for marketing or promotional purposes. Providers may process this information only as needed to operate these services.</p>
        <p className="mt-2">To ask about your information or request correction or deletion, email <a className="underline underline-offset-2" href="mailto:admin@thankyousomuch.ai">admin@thankyousomuch.ai</a>. We may retain records needed to honor opt-outs or meet legal obligations.</p>
      </section>
      <section id="sms-terms" className="scroll-mt-6" aria-labelledby="sms-terms-heading">
        <h2 id="sms-terms-heading" className="font-extrabold uppercase">SMS inquiry terms</h2>
        <p className="mt-2">TYSM inquiry texts help people request a callback, provide their name and business, and discuss their inquiry. Once texting is activated, you can opt in by calling (859) 715-8052, hearing the text-message disclosure, and pressing 1, or by initiating an inquiry by texting HI to that number. Providing a number in our website contact form alone does not opt you into SMS.</p>
        <p className="mt-2">Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to stop texts or HELP for help; email <a className="underline underline-offset-2" href="mailto:admin@thankyousomuch.ai">admin@thankyousomuch.ai</a> for support. Reply START to opt back in after opting out.</p>
        <p className="mt-2">A callback request is not a confirmed appointment or a guarantee of an immediate response. Text delivery depends on carrier availability; carriers are not liable for delayed or undelivered messages. This service is not for emergencies. See our <a className="underline underline-offset-2" href="#privacy">privacy notice</a> for how inquiry and consent information is handled.</p>
      </section>
    </div>
  );
}
