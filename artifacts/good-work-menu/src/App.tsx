import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useHealthCheck, useSendInquiry } from '@workspace/api-client-react';
import { CUSTOM_PRODUCT, PRODUCTS, type ProductId } from '@workspace/api-zod';
import { MenuSection } from './components/MenuSection';
import { HeroIntro } from './components/HeroIntro';

const queryClient = new QueryClient();

type InquiryFields = {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

const emptyFields: InquiryFields = {
  name: '',
  businessName: '',
  email: '',
  phone: '',
  message: '',
  website: '',
};

const rotatingLines = [
  'YOUR POS SYSTEM?',
  'YOUR MISSED CALLS?',
  'YOUR APPOINTMENTS?',
  'YOUR CRM?',
  'YOUR EMAIL?',
  'YOUR ENTIRE WORKFLOW?',
];

function LineIllustration({ kind }: { kind: (typeof PRODUCTS)[number]['icon'] }) {
  const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (kind === 'phone') {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M19 9c-3 0-7 4-7 8 0 16 19 35 35 35 4 0 8-4 8-7l-2-9-12-2-5 7c-8-4-13-9-17-17l7-5-2-12-5-1Z" /><path d="M39 11c7 2 12 7 14 14M39 19c3 1 5 3 6 6" /></svg>;
  }
  if (kind === 'reply') {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M12 15h40v29H31L19 54v-10h-7z" /><path d="M21 25h22M21 33h15" /><path d="m42 7 5 5 9-9" /></svg>;
  }
  if (kind === 'quote') {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M12 11h40v42H12z" /><path d="M20 21h24M20 29h19M20 37h24" /><path d="m37 46 5 5 10-12" /></svg>;
  }
  return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M13 29a19 19 0 0 1 38 0v13a7 7 0 0 1-7 7h-5V33h12M13 33h12v16h-5a7 7 0 0 1-7-7z" /><path d="M27 51c2 4 8 5 12 2M32 19v7M28 22h8" /></svg>;
}

function InquiryDialog({
  open,
  onOpenChange,
  serviceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: ProductId;
}) {
  const service = serviceId === CUSTOM_PRODUCT.id
    ? CUSTOM_PRODUCT
    : PRODUCTS.find((item) => item.id === serviceId);
  const [fields, setFields] = useState<InquiryFields>(emptyFields);
  const [accepted, setAccepted] = useState(false);
  const [emailDelayed, setEmailDelayed] = useState(false);
  const [formError, setFormError] = useState('');
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const sendInquiry = useSendInquiry();

  useEffect(() => {
    if (open) {
      setFields(emptyFields);
      setAccepted(false);
      setEmailDelayed(false);
      setFormError('');
      sendInquiry.reset();
    }
  // Reset only when a new panel is opened, not when the mutation object changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceId]);

  const changeField = (field: keyof InquiryFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    try {
      const result = await sendInquiry.mutateAsync({
        data: {
          serviceId,
          name: fields.name.trim(),
          businessName: fields.businessName.trim(),
          email: fields.email.trim(),
          phone: fields.phone.trim(),
          message: fields.message.trim(),
          website: fields.website.trim(),
        },
      });
      if (result.accepted) {
        setEmailDelayed(result.emailStatus === 'failed');
        setAccepted(true);
      } else {
        setFormError('We couldn’t confirm your message was delivered. Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something interrupted the send. Please try again.';
      setFormError(message);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className="dialog-panel"
          aria-describedby="inquiry-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            firstFieldRef.current?.focus();
          }}
        >
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#161616]/20 pb-5">
            <div>
              <p className="mono mb-2 text-[.68rem] uppercase tracking-[.18em] text-[#cd1725]">Thank you for reaching out</p>
              <DialogPrimitive.Title className="display text-3xl leading-[1.05] sm:text-4xl">
                {accepted ? 'LOOKS LIKE THE START OF SOMETHING GOOD.' : 'Let’s talk it through.'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description id="inquiry-description" className="mt-2 max-w-[38ch] text-sm leading-relaxed text-[#161616]/70">
                {accepted
                  ? emailDelayed
                    ? "Your message is safely saved. The email notification was delayed, so there's no need to submit it again."
                    : "Your message is safely saved and our team has been notified. We'll be in touch."
                  : 'Tell us a little about your business. A real person will follow up.'}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close inquiry"
              data-testid="button-close-inquiry"
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#161616]/20 hover:bg-[#ffda43] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457ed]"
            >
              <X size={20} strokeWidth={2.2} />
            </DialogPrimitive.Close>
          </div>
          {accepted ? (
            <div className="py-7 text-center" role="status" data-testid="status-inquiry-success">
              <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffda43] text-[#cd1725]"><Check size={30} /></span>
              <button onClick={() => onOpenChange(false)} className="primary-button mt-7 min-h-12 bg-[#cd1725] px-7 font-extrabold text-white" data-testid="button-done-inquiry">Back to the menu</button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-3 border-l-[3px] border-[#cd1725] bg-white px-4 py-3">
                <div>
                  <p className="mono text-[.62rem] uppercase tracking-[.15em] text-[#161616]/65">I’m interested in</p>
                  <p className="mt-1 font-extrabold leading-tight" data-testid="text-selected-service">{serviceId === CUSTOM_PRODUCT.id ? 'CUSTOM AI INTEGRATION' : service?.name ?? 'A custom setup'}</p>
                </div>
                <span className="mono mt-1 text-[.62rem] uppercase tracking-[.12em] text-[#161616]/65">Selected</span>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="form-label">Your name <span className="text-[#cd1725]">*</span></span>
                    <input ref={firstFieldRef} className="field" autoComplete="name" required maxLength={100} value={fields.name} onChange={(e) => changeField('name', e.target.value)} placeholder="Name" data-testid="input-inquiry-name" />
                  </label>
                  <label>
                    <span className="form-label">Business name <span className="text-[#cd1725]">*</span></span>
                    <input className="field" autoComplete="organization" required maxLength={120} value={fields.businessName} onChange={(e) => changeField('businessName', e.target.value)} placeholder="Your business" data-testid="input-inquiry-business" />
                  </label>
                  <label>
                    <span className="form-label">Email <span className="text-[#cd1725]">*</span></span>
                    <input className="field" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={(e) => changeField('email', e.target.value)} placeholder="you@yourbusiness.com" data-testid="input-inquiry-email" />
                  </label>
                  <label>
                    <span className="form-label">Phone <span className="font-normal text-[#161616]/65">(optional)</span></span>
                    <input className="field" type="tel" autoComplete="tel" maxLength={50} value={fields.phone} onChange={(e) => changeField('phone', e.target.value)} placeholder="(555) 000-0000" data-testid="input-inquiry-phone" />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="form-label">What would you like help with? <span className="font-normal text-[#161616]/65">(optional)</span></span>
                  <textarea className="field min-h-24 resize-y" maxLength={4000} value={fields.message} onChange={(e) => changeField('message', e.target.value)} placeholder="A few details are plenty." data-testid="input-inquiry-message" />
                </label>
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="inquiry-website">Website</label>
                  <input id="inquiry-website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => changeField('website', e.target.value)} />
                </div>
                {formError && (
                  <div role="alert" className="mt-4 border border-[#cd1725]/35 bg-[#cd1725]/[.06] px-4 py-3 text-sm leading-relaxed text-[#cd1725]" data-testid="status-inquiry-error">
                    <p>{formError}</p>
                    <p className="mt-1 font-bold">Your details are still here. Please try again.</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={sendInquiry.isPending}
                  className="primary-button mt-5 flex min-h-[54px] w-full items-center justify-center gap-3 bg-[#cd1725] px-5 font-extrabold text-white disabled:cursor-wait disabled:opacity-65"
                  data-testid="button-submit-inquiry"
                >
                  {sendInquiry.isPending ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> Sending your note…</>
                  ) : <>LET&apos;S GET STARTED ↗</>}
                </button>
                <p className="mt-3 text-center text-xs leading-relaxed text-[#161616]/65">No pressure. Just a real conversation about your follow-up.</p>
              </form>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Home() {
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ProductId>(PRODUCTS[0].id);
  const openerRef = useRef<HTMLElement | null>(null);
  const health = useHealthCheck();

  const openInquiry = (serviceId: ProductId) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedService(serviceId);
    setInquiryOpen(true);
  };

  const changeInquiryOpen = (nextOpen: boolean) => {
    setInquiryOpen(nextOpen);
    if (!nextOpen) {
      window.requestAnimationFrame(() => openerRef.current?.focus());
    }
  };

  return (
    <div className="site-shell paper-grain min-h-[100dvh] bg-[#FFE76E] text-[#161616]">
      <header className="site-header relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 sm:px-9 lg:px-14">
        <a href="#top" className="brand-link flex items-center gap-2.5" aria-label="Thank You So Much home" data-testid="link-home">
          <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-[#cd1725] text-[.56rem] font-bold tracking-[-.04em] text-white">TYSM</span>
          <span className="brand-wordmark display text-[.82rem] tracking-[-.045em] sm:text-[1.2rem]">THANK YOU SO MUCH<span className="text-[#cd1725]">.</span></span>
        </a>
        <nav className="site-nav flex items-center gap-5 sm:gap-9" aria-label="Main navigation">
          <a className="menu-link mono text-[.7rem] font-medium uppercase tracking-[.16em]" href="#menu" data-testid="link-menu">MENU</a>
          <button onClick={() => openInquiry(CUSTOM_PRODUCT.id)} className="secondary-button flex min-h-11 items-center gap-1.5 border-b-2 border-[#cd1725] px-1 text-[.73rem] font-extrabold uppercase tracking-[.08em]" data-testid="button-header-message">
            MESSAGE US ↗
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-[#cd1725] text-white" aria-labelledby="custom-ai-heading">
          <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-9 sm:py-16 lg:px-14 lg:py-20">
            <h1 id="custom-ai-heading" className="display text-[clamp(1.7rem,5.4vw,5rem)] leading-[.98] tracking-[-.05em]">
              NEED CUSTOM AI FOR
            </h1>
            <div className="rotator-window display mt-2 text-[clamp(1.35rem,4.2vw,3.1rem)] leading-[1.12]" aria-label={rotatingLines.join(' ')}>
              <div className="rotator-track" aria-hidden="true">
                {[...rotatingLines, rotatingLines[0]].map((line, index) => (
                  <div className="rotator-line" key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            </div>
            <p className="mt-5 max-w-[45ch] text-base font-semibold leading-relaxed text-white/90 sm:text-lg">Tell us what's slowing your business down. We'll figure it out together.</p>
            <button onClick={() => openInquiry(CUSTOM_PRODUCT.id)} className="primary-button custom-ai-button mt-6 inline-flex min-h-[54px] items-center gap-3 bg-[#176b45] px-6 text-sm font-extrabold text-white sm:px-8" data-testid="button-custom-ai-inquiry">
              MESSAGE US ↗
            </button>
          </div>
        </section>

        <MenuSection onSelectService={openInquiry} />

        <section className="relative mx-auto max-w-[1440px] px-5 pb-8 pt-10 sm:px-9 sm:pb-10 sm:pt-14 lg:px-14" aria-labelledby="follow-up-heading">
          <h2 id="follow-up-heading" className="display hero-title reveal max-w-[1120px] uppercase text-[#6EB2FF]" data-testid="text-hero-headline">
            YOU DO GREAT WORK.<br className="hidden md:block" /> WE HANDLE THE FOLLOW-UP.
          </h2>
          <HeroIntro />
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-12 sm:px-9 sm:pb-16 lg:px-14">
          <div className="flex flex-col items-center gap-5 border-2 border-[#161616] bg-[#ffda43] px-5 py-7 text-center sm:flex-row sm:gap-8 sm:px-9 sm:py-8 sm:text-left lg:px-12">
            <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-2 border-[#2457ed] bg-white text-[#2457ed] sm:h-32 sm:w-32" aria-hidden="true">
              <span className="display text-[2.7rem] leading-none">07</span>
              <span className="mono mt-1 text-[.52rem] font-bold uppercase tracking-[.12em]">business days</span>
            </div>
            <div>
              <h2 className="display text-[1.7rem] uppercase leading-[1.08] sm:text-3xl lg:text-4xl">LIVE IN 7 BUSINESS DAYS. OR YOUR FIRST MONTH IS FREE.</h2>
              <p className="mx-auto mt-3 max-w-[74ch] text-sm font-semibold leading-relaxed sm:mx-0 sm:text-base">Applies to our standard products when customer access and applicable third-party approvals are ready. If our work causes the delay, the first month is credited or refunded.</p>
            </div>
          </div>
        </section>

        <section className="w-full bg-[#cd1725] text-white" aria-label="Recover your leads">
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-9 sm:py-12 lg:px-14">
            <p className="display text-3xl uppercase leading-tight sm:text-4xl">DON’T LET THE NEXT LEAD GET AWAY.</p>
            <button onClick={() => openInquiry(CUSTOM_PRODUCT.id)} className="primary-button custom-ai-button inline-flex min-h-[54px] shrink-0 items-center gap-3 bg-[#176b45] px-6 text-sm font-extrabold text-white sm:px-8" data-testid="button-recover-leads">
              Recover my leads ↗
            </button>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1440px] px-5 py-8 sm:px-9 sm:py-10 lg:px-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="display flex h-9 w-9 items-center justify-center rounded-full bg-[#161616] text-[.56rem] font-bold tracking-[-.04em] text-white">TYSM</span>
            <p className="display text-[.9rem] sm:text-lg">THANK YOU SO MUCH<span className="text-[#cd1725]">.</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="#privacy" className="menu-link text-xs font-bold" data-testid="link-privacy">Privacy notice</a>
            <p className="mono text-[.58rem] text-[#161616]/65">An expert in enterprise AI.</p>
          </div>
        </div>
        <p id="privacy" className="mt-4 max-w-[72ch] text-[.7rem] leading-relaxed text-[#161616]/65">We privately store your inquiry and email it to our team so we can respond, even if email is unavailable. We don’t sell your information.</p>
        <p className="mono mt-5 text-[.58rem] uppercase tracking-[.08em] text-[#161616]/55" aria-live="polite" data-testid="status-api-process">
          {health.isLoading ? 'API process: checking' : health.error ? 'API process: unavailable' : `API process: ${health.data?.status ?? 'unknown'}`}
        </p>
      </footer>
      <InquiryDialog open={inquiryOpen} onOpenChange={changeInquiryOpen} serviceId={selectedService} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>
  );
}

export default App;
