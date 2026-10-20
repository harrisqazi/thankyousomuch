import { ArrowUpRight } from "lucide-react";
import { formatUsd, PRODUCTS, type ProductId } from "@workspace/api-zod";

function LineIllustration({ kind }: { kind: (typeof PRODUCTS)[number]["icon"] }) {
  const shared = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "phone") {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M19 9c-3 0-7 4-7 8 0 16 19 35 35 35 4 0 8-4 8-7l-2-9-12-2-5 7c-8-4-13-9-17-17l7-5-2-12-5-1Z" /><path d="M39 11c7 2 12 7 14 14M39 19c3 1 5 3 6 6" /></svg>;
  }
  if (kind === "reply") {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M12 15h40v29H31L19 54v-10h-7z" /><path d="M21 25h22M21 33h15" /><path d="m42 7 5 5 9-9" /></svg>;
  }
  if (kind === "quote") {
    return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M12 11h40v42H12z" /><path d="M20 21h24M20 29h19M20 37h24" /><path d="m37 46 5 5 10-12" /></svg>;
  }
  return <svg viewBox="0 0 64 64" aria-hidden="true" {...shared}><path d="M13 29a19 19 0 0 1 38 0v13a7 7 0 0 1-7 7h-5V33h12M13 33h12v16h-5a7 7 0 0 1-7-7z" /><path d="M27 51c2 4 8 5 12 2M32 19v7M28 22h8" /></svg>;
}

export function MenuSection({ onSelectService }: { onSelectService: (id: ProductId) => void }) {
  return (
    <section id="menu" className="relative z-[21] w-full scroll-mt-6 border-t-2 border-white bg-[#cd1725] text-white">
      <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-5 sm:px-9 sm:pb-12 sm:pt-7 lg:px-14 lg:pb-14 lg:pt-8">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:mb-7 sm:flex-row sm:items-end">
          <div>
            <h2 className="display text-4xl leading-[1.04] sm:text-5xl">MENU.</h2>
            <p className="mono mt-2 text-[.68rem] font-medium uppercase tracking-[.17em] text-white">GREAT SERVICE. SIMPLE PRICES.</p>
          </div>
        </div>
        <div className="border-t-2 border-white" role="group" aria-label="Follow-up services">
          {PRODUCTS.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectService(product.id)}
              className="service-button group w-full border-b border-white/40 py-4 text-left sm:py-5"
              data-testid={`button-service-${product.id}`}
            >
              <span className="service-row">
                <span className="mono text-[.7rem] tracking-[.13em] text-white">{product.number}</span>
                <span className="service-icon" aria-hidden="true"><LineIllustration kind={product.icon} /></span>
                <span className="service-title-wrap min-w-0">
                  <span className="display block text-[1.2rem] leading-tight sm:text-[1.45rem] lg:text-[1.65rem]">{product.name}</span>
                  <span className="service-copy mt-1 block text-[.78rem] font-semibold leading-snug text-white sm:text-sm">{product.description}</span>
                </span>
                <span className="dot-leader" aria-hidden="true" />
                <span className="service-price display whitespace-nowrap text-[1.05rem] sm:text-[1.3rem]">{formatUsd(product.monthlyPrice)}<span className="mono text-[.67rem] font-normal">/month</span></span>
                <span className="service-arrow flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white transition-colors group-hover:border-white group-hover:bg-white/10 group-focus-visible:border-white group-focus-visible:bg-white/10">
                  <ArrowUpRight size={17} />
                </span>
              </span>
              <span className="mono mt-2 block pl-[5rem] text-[.61rem] uppercase tracking-[.1em] text-white sm:pl-[6.7rem]">One-time setup {formatUsd(product.setupPrice)}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-[.62rem] font-extrabold leading-relaxed tracking-[.07em] sm:text-xs" data-testid="text-menu-terms">MONTH-TO-MONTH · STANDARD INSTALLATION INCLUDED AFTER SETUP · NO LONG-TERM CONTRACT</p>
      </div>
    </section>
  );
}
