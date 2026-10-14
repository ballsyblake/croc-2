import { el } from './Hud';

/** Small FPS / resolution readout, toggled from the pause menu. */
export class Stats {
  private root: HTMLDivElement;
  private frames = 0;
  private acc = 0;
  private fps = 0;
  visible = false;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'stats');
    parent.append(this.root);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'block' : 'none';
  }

  update(dt: number, info: () => string): void {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.frames = 0;
      this.acc = 0;
      if (this.visible) this.root.textContent = `${this.fps.toFixed(0)} fps | ${info()}`;
    }
  }
}
