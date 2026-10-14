import { TUNING } from '../config';

/** DOM HUD: hearts, gem + rescue counters, toast messages, screen fade, pause button. */
export class Hud {
  readonly root: HTMLDivElement;
  private hearts: HTMLDivElement;
  private gemText: HTMLSpanElement;
  private rescueText: HTMLSpanElement;
  private toast: HTMLDivElement;
  private fade: HTMLDivElement;
  private toastTimer = 0;
  readonly pauseButton: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    const left = el('div', 'hud-left');
    this.hearts = el('div', 'hearts');
    const counters = el('div', 'counters');
    const gemRow = el('div', 'counter');
    gemRow.append(el('span', 'icon-gem'));
    this.gemText = el('span', 'count');
    gemRow.append(this.gemText);
    const rescueRow = el('div', 'counter');
    rescueRow.append(el('span', 'icon-sprout'));
    this.rescueText = el('span', 'count');
    rescueRow.append(this.rescueText);
    counters.append(gemRow, rescueRow);
    left.append(this.hearts, counters);

    this.pauseButton = el('button', 'pause-btn');
    this.pauseButton.setAttribute('aria-label', 'Pause');
    this.pauseButton.append(el('span'), el('span'));

    this.toast = el('div', 'toast');
    this.fade = el('div', 'fade');
    this.root.append(left, this.pauseButton, this.toast);
    parent.append(this.root, this.fade);
    this.setHealth(TUNING.player.maxHealth);
  }

  setHealth(n: number): void {
    const max = TUNING.player.maxHealth;
    if (this.hearts.childElementCount !== max) {
      this.hearts.replaceChildren(...Array.from({ length: max }, () => el('span', 'heart')));
    }
    Array.from(this.hearts.children).forEach((h, i) => h.classList.toggle('empty', i >= n));
  }

  setGems(n: number, total: number): void {
    this.gemText.textContent = `${n}/${total}`;
    bump(this.gemText);
  }

  setRescues(n: number, total: number): void {
    this.rescueText.textContent = `${n}/${total}`;
    bump(this.rescueText);
  }

  showToast(text: string, seconds = 2): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  /** 0 = clear, 1 = black. */
  setFade(a: number): void {
    this.fade.style.opacity = String(a);
  }

  update(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
  }
}

function bump(e: HTMLElement): void {
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
