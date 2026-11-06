import type { ReactNode } from 'react';
import {
  PRIVACY_PARAGRAPHS,
  PRIVACY_URL,
  SMS_TERMS_PARAGRAPHS,
  SMS_TERMS_URL,
} from '../legal-copy';

function LegalChrome({
  title,
  canonical,
  children,
}: {
  title: string;
  canonical: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FFE76E] text-[#161616]">
      <header className="mx-auto flex max-w-[800px] items-center justify-between px-5 py-4">
        <a href="/" className="display text-sm font-bold tracking-[-.04em]">THANK YOU SO MUCH.</a>
        <a href="/" className="text-xs font-bold underline underline-offset-2">Home</a>
      </header>
      <main className="mx-auto max-w-[800px] px-5 pb-16 pt-6">
        <h1 className="display text-3xl uppercase leading-tight sm:text-4xl">{title}</h1>
        <p className="mono mt-2 text-[.65rem] text-[#161616]/70">{canonical}</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed">{children}</div>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalChrome title="Privacy notice" canonical={PRIVACY_URL}>
      {PRIVACY_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
      <p>
        SMS inquiry terms:{' '}
        <a className="underline underline-offset-2" href="/sms-terms">{SMS_TERMS_URL}</a>
      </p>
    </LegalChrome>
  );
}

export function SmsTermsPage() {
  return (
    <LegalChrome title="SMS inquiry terms" canonical={SMS_TERMS_URL}>
      {SMS_TERMS_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
      <p>
        Privacy policy:{' '}
        <a className="underline underline-offset-2" href="/privacy">{PRIVACY_URL}</a>
      </p>
    </LegalChrome>
  );
}
