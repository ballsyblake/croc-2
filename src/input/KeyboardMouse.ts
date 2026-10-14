import { TUNING } from '../config';
import type { InputFrame, InputSource } from './InputState';

/**
 * Desktop testing controls:
 *   WASD / arrows  move      Space        jump
 *   J / K / Shift  attack    Q / E        orbit camera
 *   Mouse drag     orbit     Esc / P      pause
 */
export class KeyboardMouse implements InputSource {
  private down = new Set<string>();
  private jumpLatch = false;
  private attackLatch = false;
  private pauseLatch = false;
  private mouseDX = 0;
  private mouseDY = 0;
  private dragging = false;
  private active = false;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    this.active = true;
    if (!e.repeat) {
      if (e.code === 'Space') this.jumpLatch = true;
      if (e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.attackLatch = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseLatch = true;
    }
    this.down.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
  };

  private onMouseDown = (e: MouseEvent) => {
    this.dragging = true;
    this.active = true;
    e.preventDefault();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onMouseUp = () => {
    this.dragging = false;
  };

  poll(dt: number, out: InputFrame): void {
    const k = this.down;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 0 && len > Math.hypot(out.moveX, out.moveY)) {
      out.moveX = x / len;
      out.moveY = y / len;
    }

    const cam = TUNING.camera;
    let yaw = 0;
    if (k.has('KeyQ')) yaw += cam.keyboardSpeed * dt;
    if (k.has('KeyE')) yaw -= cam.keyboardSpeed * dt;
    out.lookYaw += yaw - this.mouseDX * cam.mouseSensitivity;
    out.lookPitch += this.mouseDY * cam.mouseSensitivity * (cam.invertY ? -1 : 1);
    this.mouseDX = this.mouseDY = 0;

    if (k.has('Space')) out.jumpHeld = true;
    if (this.jumpLatch) out.jumpPressed = true;
    if (this.attackLatch) out.attackPressed = true;
    if (this.pauseLatch) out.pausePressed = true;
    this.jumpLatch = this.attackLatch = this.pauseLatch = false;

    if (this.active && (len > 0 || yaw !== 0 || k.size > 0)) out.lastDevice = 'keyboard';
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
