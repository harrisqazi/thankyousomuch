import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';

function CheckoutChrome({ children }: { children: ReactNode }) {
  return (
    <div className="paper-grain min-h-[100dvh] bg-[#FFE76E] text-[#161616]">
      <header className="mx-auto flex max-w-[800px] items-center justify-between px-5 py-4">
        <a href="/" className="display text-sm font-bold tracking-[-.04em]">THANK YOU SO MUCH.</a>
        <a href="/" className="text-xs font-bold underline underline-offset-2">Home</a>
      </header>
      <main className="mx-auto max-w-[800px] px-5 pb-16 pt-6 sm:pt-12">
        <div className="border-2 border-[#161616] bg-white px-6 py-9 text-center shadow-[10px_10px_0_#cd1725] sm:px-12 sm:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}

export function CheckoutSuccessPage() {
  return (
    <CheckoutChrome>
      <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffda43] text-[#176b45]"><Check size={30} /></span>
      <p className="mono mb-3 text-[.68rem] uppercase tracking-[.18em] text-[#cd1725]">Payment received</p>
      <h1 className="display text-3xl uppercase leading-[1.05] sm:text-5xl" data-testid="text-checkout-success">Thank you so much.</h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-sm font-semibold leading-relaxed sm:text-base">
        You&apos;re all set. Stripe has emailed your receipt, and a real person from our team will reach out within one business day to start your setup.
      </p>
      <a href="/" className="primary-button mt-8 inline-flex min-h-[54px] items-center gap-3 bg-[#cd1725] px-7 text-sm font-extrabold text-white">Back to the menu ↗</a>
    </CheckoutChrome>
  );
}

export function CheckoutCancelPage() {
  return (
    <CheckoutChrome>
      <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#161616]/20 text-[#161616]/70"><X size={28} /></span>
      <p className="mono mb-3 text-[.68rem] uppercase tracking-[.18em] text-[#cd1725]">Checkout canceled</p>
      <h1 className="display text-3xl uppercase leading-[1.05] sm:text-5xl" data-testid="text-checkout-cancel">No charge was made.</h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-sm font-semibold leading-relaxed sm:text-base">
        Your details are saved, so our team can still follow up. Whenever you&apos;re ready, you can pick up right where you left off.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="/start" className="primary-button inline-flex min-h-[54px] items-center gap-3 bg-[#176b45] px-7 text-sm font-extrabold text-white">Try checkout again ↗</a>
        <a href="/" className="secondary-button min-h-11 border-b-2 border-[#6EB2FF] px-1 py-3 text-[.73rem] font-extrabold uppercase tracking-[.08em]">Back to the menu</a>
      </div>
    </CheckoutChrome>
  );
}
