import { useEffect, useRef } from 'react';

const INTERACTIVE = 'a, button, input, textarea, select, [contenteditable="true"], [role="dialog"], [role="button"]';

/** Stop at the menu on entry and on return, then release the next gesture. */
export function useMenuEntryScroll(dialogOpen: boolean) {
  const introHandled = useRef(false);

  useEffect(() => {
    if (dialogOpen) return;
    const menu = document.getElementById('menu');
    if (!menu) return;
    // Preserve deep links, restored positions, and browser back navigation.
    if (window.location.hash || window.scrollY > 8) {
      introHandled.current = true;
    }

    let snapping = false;
    let frame = 0;
    let lastInput = 0;
    let fingerDown = false;
    let touchY: number | undefined;
    let touchX: number | undefined;
    const root = document.documentElement;
    const targetTop = () => window.scrollY + menu.getBoundingClientRect().top;
    let previousY = window.scrollY;
    let armedSide: 'above' | 'below' | null = window.scrollY > targetTop() + 80
      ? 'below' : window.scrollY < targetTop() - 80 ? 'above' : null;
    const interactive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(INTERACTIVE));
    const finish = () => {
      if (!snapping) return;
      snapping = false;
      introHandled.current = true;
      armedSide = null;
      previousY = window.scrollY;
      root.classList.remove('menu-entry-snapping');
      cancelAnimationFrame(frame);
    };
    const noteInput = () => { lastInput = performance.now(); };
    const approachingMenu = (delta: number) => {
      const y = window.scrollY;
      const top = targetTop();
      if (!introHandled.current && y < top && delta > 0) return true;
      // Rearm only after leaving the menu, never while trying to leave it.
      if (y > top + 80) armedSide = 'below';
      else if (y < top - 80) armedSide = 'above';
      return (armedSide === 'below' && delta < 0 && y > top + 2 && y + delta <= top + 100)
        || (armedSide === 'above' && delta > 0 && y < top - 2 && y + delta >= top - 100);
    };
    const snap = () => {
      if (snapping) return;
      snapping = true;
      noteInput();
      const start = window.scrollY;
      const startedAt = performance.now();
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
      root.classList.add('menu-entry-snapping');
      // Own the initial gesture instead of trusting scrollend/native momentum.
      // Continue pinning the exact target until the gesture has gone quiet.
      const tick = (now: number) => {
        if (!snapping) return;
        const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo({ top: start + (targetTop() - start) * eased, behavior: 'instant' });
        if (progress === 1 && !fingerDown && now - lastInput >= 140
          && now - startedAt >= duration + 60) {
          finish();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (snapping || (Math.abs(event.deltaY) > Math.abs(event.deltaX) && approachingMenu(delta))) {
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
      if (event.touches.length !== 1) return;
      const dy = touchY === undefined ? 0 : touchY - event.touches[0].clientY;
      const dx = touchX === undefined ? 0 : touchX - event.touches[0].clientX;
      touchY = event.touches[0].clientY;
      touchX = event.touches[0].clientX;
      if (snapping || (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) && approachingMenu(dy))) {
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
      if (event.defaultPrevented || event.ctrlKey || event.altKey
        || event.metaKey || interactive(event.target)) return;
      const delta = event.key === 'End' ? document.documentElement.scrollHeight
        : event.key === 'Home' ? -document.documentElement.scrollHeight
        : event.key === 'ArrowDown' ? 40 : event.key === 'ArrowUp' ? -40
        : event.key === 'PageDown' ? window.innerHeight : event.key === 'PageUp' ? -window.innerHeight
        : event.key === ' ' ? window.innerHeight * (event.shiftKey ? -1 : 1) : 0;
      if (delta && (snapping || approachingMenu(delta))) {
        event.preventDefault();
        noteInput();
        snap();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || introHandled.current || interactive(event.target)
        || window.getSelection()?.toString()) return;
      snap();
    };
    const onScroll = () => {
      const y = window.scrollY;
      const top = targetTop();
      if (!snapping) {
        const crossedFromBelow = armedSide === 'below' && previousY > top + 2 && y <= top + 2;
        const crossedFromAbove = armedSide === 'above' && previousY < top - 2 && y >= top - 2;
        if ((!introHandled.current && y > 8) || crossedFromBelow || crossedFromAbove) snap();
        else if (y > top + 80) armedSide = 'below';
        else if (y < top - 80) armedSide = 'above';
      }
      previousY = y;
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
      if (snapping) introHandled.current = true;
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
