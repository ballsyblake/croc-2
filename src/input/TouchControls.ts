import { TUNING } from '../config';
import { applyDeadzone, type InputFrame, type InputSource } from './InputState';

type Role = 'stick' | 'look' | 'jump' | 'attack';

/**
 * On-screen controls:
 *  - Left ~45% of the screen: floating virtual joystick (appears under the thumb).
 *  - Right side: Jump and Spin buttons; dragging anywhere else on the right orbits the camera.
 * Uses raw touch events (multi-touch, preventDefault to kill iOS scroll/zoom).
 */
export class TouchControls implements InputSource {
  readonly root: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private jumpBtn: HTMLDivElement;
  private attackBtn: HTMLDivElement;

  private roles = new Map<number, Role>();
  private stickOrigin = { x: 0, y: 0 };
  private stickVec = { x: 0, y: 0 };
  private lookLast = new Map<number, { x: number; y: number }>();
  private lookDX = 0;
  private lookDY = 0;
  private jumpLatch = false;
  private attackLatch = false;
  private used = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    this.base = div('stick-base');
    this.knob = div('stick-knob');
    this.base.appendChild(this.knob);
    this.jumpBtn = div('touch-btn btn-jump', 'JUMP');
    this.attackBtn = div('touch-btn btn-attack', 'SPIN');
    this.jumpBtn.dataset.role = 'jump';
    this.attackBtn.dataset.role = 'attack';
    this.root.append(this.base, this.jumpBtn, this.attackBtn);
    parent.appendChild(this.root);

    const opts: AddEventListenerOptions = { passive: false };
    this.root.addEventListener('touchstart', this.onStart, opts);
    this.root.addEventListener('touchmove', this.onMove, opts);
    this.root.addEventListener('touchend', this.onEnd, opts);
    this.root.addEventListener('touchcancel', this.onEnd, opts);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('visible', v);
  }

  private onStart = (e: TouchEvent) => {
    e.preventDefault();
    this.used = true;
    this.setVisible(true);
    for (const t of Array.from(e.changedTouches)) {
      const btn = (t.target as HTMLElement).closest?.('[data-role]') as HTMLElement | null;
      const btnRole = btn?.dataset.role as Role | undefined;
      if (btnRole === 'jump') {
        this.roles.set(t.identifier, 'jump');
        this.jumpLatch = true;
        this.jumpBtn.classList.add('active');
      } else if (btnRole === 'attack') {
        this.roles.set(t.identifier, 'attack');
        this.attackLatch = true;
        this.attackBtn.classList.add('active');
      } else if (t.clientX < window.innerWidth * 0.45 && !this.hasRole('stick')) {
        this.roles.set(t.identifier, 'stick');
        this.stickOrigin = { x: t.clientX, y: t.clientY };
        this.stickVec = { x: 0, y: 0 };
        this.base.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
        this.knob.style.transform = 'translate(0px, 0px)';
        this.base.classList.add('active');
      } else {
        this.roles.set(t.identifier, 'look');
        this.lookLast.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
  };

  private onMove = (e: TouchEvent) => {
    e.preventDefault();
    const r = TUNING.input.joystickRadius;
    for (const t of Array.from(e.changedTouches)) {
      const role = this.roles.get(t.identifier);
      if (role === 'stick') {
        let dx = t.clientX - this.stickOrigin.x;
        let dy = t.clientY - this.stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > r) {
          // Drag the base along so the stick never "runs out" - feels much better on glass.
          const excess = len - r;
          this.stickOrigin.x += (dx / len) * excess;
          this.stickOrigin.y += (dy / len) * excess;
          dx = (dx / len) * r;
          dy = (dy / len) * r;
          this.base.style.transform = `translate(${this.stickOrigin.x}px, ${this.stickOrigin.y}px)`;
        }
        this.stickVec = { x: dx / r, y: dy / r };
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (role === 'look') {
        const last = this.lookLast.get(t.identifier)!;
        this.lookDX += t.clientX - last.x;
        this.lookDY += t.clientY - last.y;
        last.x = t.clientX;
        last.y = t.clientY;
      }
    }
  };

  private onEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const role = this.roles.get(t.identifier);
      this.roles.delete(t.identifier);
      this.lookLast.delete(t.identifier);
      if (role === 'stick') {
        this.stickVec = { x: 0, y: 0 };
        this.base.classList.remove('active');
      } else if (role === 'jump' && !this.hasRole('jump')) {
        this.jumpBtn.classList.remove('active');
      } else if (role === 'attack' && !this.hasRole('attack')) {
        this.attackBtn.classList.remove('active');
      }
    }
  };

  private hasRole(role: Role): boolean {
    for (const r of this.roles.values()) if (r === role) return true;
    return false;
  }

  poll(_dt: number, out: InputFrame): void {
    const [mx, my] = applyDeadzone(this.stickVec.x, this.stickVec.y, TUNING.input.touchDeadzone);
    if (Math.hypot(mx, my) > Math.hypot(out.moveX, out.moveY)) {
      out.moveX = mx;
      out.moveY = -my;
    }
    const cam = TUNING.camera;
    out.lookYaw -= this.lookDX * cam.touchSensitivity;
    out.lookPitch += this.lookDY * cam.touchSensitivity * (cam.invertY ? -1 : 1);
    this.lookDX = this.lookDY = 0;
    if (this.hasRole('jump')) out.jumpHeld = true;
    if (this.jumpLatch) out.jumpPressed = true;
    if (this.attackLatch) out.attackPressed = true;
    this.jumpLatch = this.attackLatch = false;
    if (this.used && this.roles.size > 0) out.lastDevice = 'touch';
  }
}

function div(className: string, text?: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  if (text) d.textContent = text;
  return d;
}
