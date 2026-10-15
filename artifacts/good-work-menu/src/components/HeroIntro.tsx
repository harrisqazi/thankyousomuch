const introduction = 'Missed calls. New inquiries. Unanswered quotes. We take care of the follow-up, so you can focus on what you do best.';

export function HeroIntro() {
  return (
    <div className="mt-4 max-w-[760px] text-[.98rem] leading-relaxed sm:mt-5 sm:text-lg">
      <p className="reveal reveal-delay-1 font-semibold" data-testid="text-hero-intro">
        {introduction}
      </p>
      <p className="reveal reveal-delay-2 mt-2 font-bold sm:mt-3" data-testid="text-hero-thank-you">
        Have your customers saying, “Thank you so much.”
      </p>
    </div>
  );
}
