import { el } from './Hud';

export interface Toggle {
  label: string;
  get: () => boolean;
  set: (v: boolean) => void;
}

/** Pause overlay with render/feel toggles. */
export class PauseMenu {
  readonly root: HTMLDivElement;
  private toggles: { t: Toggle; btn: HTMLButtonElement }[] = [];
  onResume: () => void = () => {};
  onRestart: () => void = () => {};

  constructor(parent: HTMLElement, toggles: Toggle[]) {
    this.root = el('div', 'menu');
    const panel = el('div', 'menu-panel scrollable');
    panel.append(el('div', 'menu-title', 'PAUSED'));

    const resume = el('button', 'menu-btn primary', 'Resume');
    resume.addEventListener('click', () => this.onResume());
    panel.append(resume);

    const grid = el('div', 'toggle-grid');
    for (const t of toggles) {
      const btn = el('button', 'menu-btn toggle');
      btn.addEventListener('click', () => {
        t.set(!t.get());
        this.refresh();
      });
      grid.append(btn);
      this.toggles.push({ t, btn });
    }
    panel.append(grid);

    const restart = el('button', 'menu-btn', 'Restart level');
    restart.addEventListener('click', () => this.onRestart());
    panel.append(restart);

    panel.append(
      el(
        'div',
        'menu-help',
        'Touch: left thumb moves, drag right side to look, JUMP (tap again in air = double jump), SPIN attacks. ' +
          'Keyboard: WASD move, Space jump, J/Shift spin, Q/E or mouse-drag camera, Esc pause. ' +
          'Gamepad: left stick, right stick camera, A jump, X/B spin, Start pause.',
      ),
    );
    this.root.append(panel);
    parent.append(this.root);
    this.refresh();
  }

  private refresh(): void {
    for (const { t, btn } of this.toggles) {
      btn.textContent = `${t.label}: ${t.get() ? 'ON' : 'OFF'}`;
      btn.classList.toggle('on', t.get());
    }
  }

  get open(): boolean {
    return this.root.classList.contains('show');
  }

  setOpen(v: boolean): void {
    this.refresh();
    this.root.classList.toggle('show', v);
  }
}
