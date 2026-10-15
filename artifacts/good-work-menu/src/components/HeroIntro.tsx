export function HeroIntro() {
  return (
    <div className="mt-4 max-w-[760px] text-[.98rem] leading-relaxed sm:mt-5 sm:text-lg">
      <p className="reveal reveal-delay-1 font-semibold" data-testid="text-hero-intro">
        Missed calls. New inquiries. Unanswered quotes.
      </p>
      <p className="reveal reveal-delay-2 mt-2 font-semibold sm:mt-3">
        We cover the follow-up, you focus on what you do best,
      </p>
      <p className="reveal reveal-delay-3 mt-2 font-semibold sm:mt-3" data-testid="text-hero-thank-you">
        your customers say, <strong className="font-extrabold">“Thank you so much.”</strong>
      </p>
    </div>
  );
}
