import { useEffect, useRef } from 'react';

const INTERACTIVE = 'a, button, input, textarea, select, [contenteditable="true"], [role="dialog"], [role="button"]';

/** One introductory snap, then ordinary scrolling for the rest of the visit. */
export function useMenuEntryScroll(dialogOpen: boolean) {
  const completed = useRef(false);

  useEffect(() => {
    if (completed.current || dialogOpen) return;
    const menu = document.getElementById('menu');
    if (!menu) return;
    // Preserve deep links, restored positions, and browser back navigation.
    if (window.location.hash || window.scrollY > 8) {
      completed.current = true;
      return;
    }

    let snapping = false;
    let frame = 0;
    let lastInput = 0;
    let fingerDown = false;
    let touchY: number | undefined;
    let touchX: number | undefined;
    const root = document.documentElement;
    const interactive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(INTERACTIVE));
    const finish = () => {
      if (!snapping) return;
      snapping = false;
      completed.current = true;
      root.classList.remove('menu-entry-snapping');
      cancelAnimationFrame(frame);
    };
    const targetTop = () => window.scrollY + menu.getBoundingClientRect().top;
    const noteInput = () => { lastInput = performance.now(); };
    const snap = () => {
      if (completed.current || snapping) return;
      snapping = true;
      noteInput();
      const start = window.scrollY;
      const startedAt = performance.now();
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550;
      root.classList.add('menu-entry-snapping');
      // Own the initial gesture instead of trusting scrollend/native momentum.
      // Continue pinning the exact target until the gesture has gone quiet.
      const tick = (now: number) => {
        if (!snapping) return;
        const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo({ top: start + (targetTop() - start) * eased, behavior: 'instant' });
        if (progress === 1 && !fingerDown && now - lastInput >= 280
          && now - startedAt >= duration + 180) {
          finish();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const onWheel = (event: WheelEvent) => {
      if (completed.current || event.ctrlKey) return;
      if (snapping || (event.deltaY > 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX))) {
        event.preventDefault();
        noteInput();
        snap();
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      fingerDown = event.touches.length > 0;
      touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
      touchX = event.touches.length === 1 ? event.touches[0].clientX : undefined;
      if (snapping) noteInput();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (completed.current || event.touches.length !== 1) return;
      const dy = touchY === undefined ? 0 : touchY - event.touches[0].clientY;
      const dx = touchX === undefined ? 0 : touchX - event.touches[0].clientX;
      if (snapping || (dy > 8 && Math.abs(dy) > Math.abs(dx))) {
        event.preventDefault();
        noteInput();
        snap();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      fingerDown = event.touches.length > 0;
      if (snapping) noteInput();
    };
    const onKey = (event: KeyboardEvent) => {
      if (completed.current || event.defaultPrevented || event.ctrlKey || event.altKey
        || event.metaKey || event.shiftKey || interactive(event.target)) return;
      if (['ArrowDown', 'PageDown', ' ', 'End'].includes(event.key)) {
        event.preventDefault();
        noteInput();
        snap();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || completed.current || interactive(event.target)
        || window.getSelection()?.toString()) return;
      snap();
    };
    const onScroll = () => {
      if (!completed.current && !snapping && window.scrollY > 8) snap();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove('menu-entry-snapping');
      // Opening the inquiry during a snap must not re-arm it on close.
      if (snapping) completed.current = true;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, [dialogOpen]);
}
