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
    let timer: ReturnType<typeof setTimeout> | undefined;
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
      clearTimeout(timer);
    };
    const snap = () => {
      if (completed.current || snapping) return;
      snapping = true;
      root.classList.add('menu-entry-snapping');
      window.scrollTo({
        top: window.scrollY + menu.getBoundingClientRect().top,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      // scrollend is preferred; timeout also covers older mobile browsers.
      timer = setTimeout(finish, 1400);
    };
    const onWheel = (event: WheelEvent) => {
      if (completed.current || event.ctrlKey || interactive(event.target)) return;
      if (snapping || (event.deltaY > 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX))) {
        event.preventDefault();
        snap();
      }
    };
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
      touchX = event.touches.length === 1 ? event.touches[0].clientX : undefined;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (completed.current || event.touches.length !== 1 || interactive(event.target)) return;
      const dy = touchY === undefined ? 0 : touchY - event.touches[0].clientY;
      const dx = touchX === undefined ? 0 : touchX - event.touches[0].clientX;
      if (snapping || (dy > 8 && Math.abs(dy) > Math.abs(dx))) {
        event.preventDefault();
        snap();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (completed.current || event.defaultPrevented || event.ctrlKey || event.altKey
        || event.metaKey || event.shiftKey || interactive(event.target)) return;
      if (['ArrowDown', 'PageDown', ' ', 'End'].includes(event.key)) {
        event.preventDefault();
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
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', finish);
    return () => {
      clearTimeout(timer);
      root.classList.remove('menu-entry-snapping');
      // Opening the inquiry during a snap must not re-arm it on close.
      if (snapping) completed.current = true;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', finish);
    };
  }, [dialogOpen]);
}
