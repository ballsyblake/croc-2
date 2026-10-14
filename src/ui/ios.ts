/**
 * iOS Safari hardening: no pinch-zoom, no double-tap zoom, no rubber-band
 * scroll, no long-press callout / text selection.
 */
export function installIOSGuards(): void {
  const prevent = (e: Event) => e.preventDefault();
  // Safari-only pinch gesture events.
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('gestureend', prevent, { passive: false });
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);

  document.addEventListener(
    'touchmove',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.scrollable')) return;
      e.preventDefault();
    },
    { passive: false },
  );

  // Multi-finger touches on non-game elements can still zoom on some iOS versions.
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1 && !(e.target as HTMLElement)?.closest?.('.touch-layer')) e.preventDefault();
    },
    { passive: false },
  );

  // Track the real visible height (iOS toolbars change it) in a CSS variable.
  const setVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`);
  window.addEventListener('resize', setVh);
  setVh();
}
