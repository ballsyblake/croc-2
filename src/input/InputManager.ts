import { GamepadInput } from './GamepadInput';
import { emptyFrame, type InputFrame, type InputSource } from './InputState';
import { KeyboardMouse } from './KeyboardMouse';
import { TouchControls } from './TouchControls';

/**
 * Merges every input source into one InputFrame per rendered frame.
 * Button presses are latched until a fixed simulation step consumes them,
 * so a tap is never lost when the render rate outpaces the physics rate.
 */
export class InputManager {
  readonly touch: TouchControls;
  private sources: InputSource[];
  private frame = emptyFrame();
  private pending = { jump: false, attack: false, pause: false };

  constructor(canvas: HTMLElement, uiRoot: HTMLElement) {
    this.touch = new TouchControls(uiRoot);
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.touch.setVisible(isTouch);
    this.sources = [new KeyboardMouse(canvas), new GamepadInput(), this.touch];
    if (isTouch) this.frame.lastDevice = 'touch';
  }

  poll(dt: number): InputFrame {
    const f = this.frame;
    const last = f.lastDevice;
    f.moveX = f.moveY = f.lookYaw = f.lookPitch = 0;
    f.jumpHeld = false;
    f.jumpPressed = f.attackPressed = f.pausePressed = false;
    for (const s of this.sources) s.poll(dt, f);
    this.pending.jump ||= f.jumpPressed;
    this.pending.attack ||= f.attackPressed;
    this.pending.pause ||= f.pausePressed;
    f.jumpPressed = this.pending.jump;
    f.attackPressed = this.pending.attack;
    f.pausePressed = this.pending.pause;
    if (f.lastDevice !== last && f.lastDevice !== 'touch') this.touch.setVisible(false);
    if (f.lastDevice === 'touch') this.touch.setVisible(true);
    return f;
  }

  /** Call after a simulation step has seen the presses. */
  consumePresses(): void {
    this.pending.jump = this.pending.attack = false;
    this.frame.jumpPressed = this.frame.attackPressed = false;
  }

  consumePause(): void {
    this.pending.pause = false;
    this.frame.pausePressed = false;
  }

  /** Drop any latched presses (e.g. when unpausing so the resume tap doesn't jump). */
  clear(): void {
    this.consumePresses();
    this.consumePause();
  }
}
