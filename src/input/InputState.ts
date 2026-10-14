export type InputDevice = 'keyboard' | 'touch' | 'gamepad';

/** Snapshot consumed by gameplay each frame. */
export interface InputFrame {
  /** Analog move vector, x = right, y = forward. Magnitude <= 1. */
  moveX: number;
  moveY: number;
  /** Camera orbit delta for this frame, radians. */
  lookYaw: number;
  lookPitch: number;
  jumpHeld: boolean;
  /** Edge-triggered; stay true until a simulation step consumes them. */
  jumpPressed: boolean;
  attackPressed: boolean;
  pausePressed: boolean;
  lastDevice: InputDevice;
}

/** Common shape for every input source. */
export interface InputSource {
  /** Called once per rendered frame. */
  poll(dt: number, out: InputFrame): void;
  dispose?(): void;
}

export function emptyFrame(): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    lookYaw: 0,
    lookPitch: 0,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    pausePressed: false,
    lastDevice: 'keyboard',
  };
}

/** Radial deadzone with rescale so output starts at 0 just past the deadzone. */
export function applyDeadzone(x: number, y: number, dz: number): [number, number] {
  const len = Math.hypot(x, y);
  if (len < dz) return [0, 0];
  const scaled = Math.min(1, (len - dz) / (1 - dz));
  return [(x / len) * scaled, (y / len) * scaled];
}
