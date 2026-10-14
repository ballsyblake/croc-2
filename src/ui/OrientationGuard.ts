import { el } from './Hud';

/**
 * Shows a "rotate to landscape" overlay on touch devices held in portrait.
 * iOS Safari cannot lock orientation from JS, so this is the fallback;
 * where the Screen Orientation API works (Android, some PWAs) we also try to lock.
 */
export class OrientationGuard {
  private overlay: HTMLDivElement;
  private mq = matchMedia('(orientation: portrait)');
  private isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  onChange: (blocked: boolean) => void = () => {};

  constructor(parent: HTMLElement) {
    this.overlay = el('div', 'rotate-overlay');
    const phone = el('div', 'rotate-phone');
    this.overlay.append(phone, el('div', 'rotate-text', 'Rotate your device to landscape'));
    parent.append(this.overlay);

    const update = () => {
      this.overlay.classList.toggle('show', this.blocked);
      this.onChange(this.blocked);
    };
    this.mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    update();

    const tryLock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o?.lock?.('landscape').catch(() => {});
      window.removeEventListener('touchend', tryLock);
    };
    window.addEventListener('touchend', tryLock);
  }

  get blocked(): boolean {
    return this.isTouch && this.mq.matches;
  }
}
