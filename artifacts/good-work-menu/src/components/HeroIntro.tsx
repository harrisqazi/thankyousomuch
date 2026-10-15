import { useLayoutEffect, useRef, useState } from 'react';

const introduction = 'Missed calls. New inquiries. Unanswered quotes. We take care of the follow-up, so you can focus on what you do best.';

export function HeroIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(18);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const line = lineRef.current;
    if (!container || !line) return;
    let active = true;

    const fitText = () => {
      if (!active) return;
      const currentSize = Number.parseFloat(getComputedStyle(line).fontSize);
      const widthPerPixel = line.getBoundingClientRect().width / currentSize;
      if (!widthPerPixel || !container.clientWidth) return;
      const nextSize = Math.min(18, (container.clientWidth - 1) / widthPerPixel);
      setFontSize((current) => Math.abs(current - nextSize) < 0.01 ? current : nextSize);
    };

    fitText();
    const observer = new ResizeObserver(fitText);
    observer.observe(container);
    void document.fonts.ready.then(fitText);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="mt-4 min-w-0 w-full leading-relaxed sm:mt-5" style={{ fontSize }}>
      <p className="reveal reveal-delay-1 whitespace-nowrap font-semibold" data-testid="text-hero-intro">
        <span ref={lineRef} className="inline-block">{introduction}</span>
      </p>
      <p className="reveal reveal-delay-2 mt-2 font-bold sm:mt-3" data-testid="text-hero-thank-you">
        Have your customers saying, “Thank you so much.”
      </p>
    </div>
  );
}
