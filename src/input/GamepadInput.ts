import { TUNING } from '../config';
import { applyDeadzone, type InputFrame, type InputSource } from './InputState';

// "standard" mapping button indices.
const BTN_SOUTH = 0; // A / Cross
const BTN_EAST = 1; // B / Circle
const BTN_WEST = 2; // X / Square
const BTN_NORTH = 3; // Y / Triangle
const BTN_START = 9;

/** Gamepad API (Bluetooth controllers on iOS 14.5+, desktop browsers). Uses the first connected pad. */
export class GamepadInput implements InputSource {
  private prev: boolean[] = [];

  poll(dt: number, out: InputFrame): void {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) return;

    const dz = TUNING.input.gamepadDeadzone;
    const [mx, my] = applyDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, dz);
    const [lx, ly] = applyDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, dz);

    const pressed = (i: number) => !!pad!.buttons[i]?.pressed;
    const edge = (i: number) => pressed(i) && !this.prev[i];

    let used = false;
    if (Math.hypot(mx, my) > Math.hypot(out.moveX, out.moveY)) {
      out.moveX = mx;
      out.moveY = -my;
      used = true;
    }
    const cam = TUNING.camera;
    if (lx !== 0 || ly !== 0) {
      out.lookYaw -= lx * cam.gamepadSpeed * dt;
      out.lookPitch += ly * cam.gamepadSpeed * 0.6 * dt * (cam.invertY ? -1 : 1);
      used = true;
    }
    if (pressed(BTN_SOUTH)) out.jumpHeld = true;
    if (edge(BTN_SOUTH)) out.jumpPressed = true;
    if (edge(BTN_WEST) || edge(BTN_EAST) || edge(BTN_NORTH)) out.attackPressed = true;
    if (edge(BTN_START)) out.pausePressed = true;

    for (let i = 0; i < pad.buttons.length; i++) {
      if (pressed(i)) used = true;
      this.prev[i] = pressed(i);
    }
    if (used) out.lastDevice = 'gamepad';
  }
}
