/**
 * All feel-related tuning in one place. Units: metres, seconds, radians.
 * Edit these and the dev server hot-reloads the page.
 */
export const TUNING = {
  player: {
    /** Top running speed (m/s). */
    runSpeed: 8.0,
    /** How fast you reach top speed on the ground (m/s^2). */
    groundAccel: 60,
    /** How fast you stop on the ground with no input (m/s^2). */
    groundDecel: 45,
    /** Acceleration while airborne (lower = floatier steering). */
    airAccel: 24,
    /** Air drag with no input. */
    airDecel: 4,
    /** Facing turn rate (rad/s). */
    turnSpeedGround: 16,
    turnSpeedAir: 9,

    /** Gravity while rising (m/s^2). */
    gravity: 34,
    /** Extra gravity multiplier when falling - snappier landings. */
    fallGravityMultiplier: 1.55,
    maxFallSpeed: 28,

    /** Apex height of a full (held) jump, metres. */
    jumpHeight: 2.3,
    /** Apex height of the double jump, measured from where it starts. */
    doubleJumpHeight: 1.7,
    /** Vertical speed is multiplied by this when jump is released early. */
    jumpCutMultiplier: 0.45,
    /** Grace period after leaving a ledge where a ground jump still works. */
    coyoteTime: 0.12,
    /** A jump pressed this long before landing still fires on landing. */
    jumpBufferTime: 0.14,

    /** Tail-spin attack. */
    spinDuration: 0.42,
    spinCooldown: 0.12,
    spinRadius: 1.7,
    /** Upward speed given by a mid-air spin (once per airtime). Forgiving recovery tool. */
    spinAirHop: 4.5,
    /** Gravity multiplier during a mid-air spin (gives a little hang time). */
    spinAirGravity: 0.55,

    /** Bounce height after stomping an enemy. */
    stompBounceHeight: 2.0,

    maxHealth: 3,
    invulnTime: 1.4,
    knockbackSpeed: 7,
    knockbackUp: 6,
    hurtControlLock: 0.3,

    capsuleRadius: 0.35,
    capsuleHalfHeight: 0.35,
    stepHeight: 0.35,
    maxSlopeDeg: 50,
    snapToGround: 0.3,
  },

  camera: {
    fov: 60,
    distance: 7.5,
    minDistance: 1.0,
    /** Pivot height above the player's centre. */
    pivotHeight: 1.0,
    defaultPitch: 0.33,
    minPitch: -0.4,
    maxPitch: 1.25,
    /** Horizontal follow lag (seconds, time-constant). 0 = locked to player. */
    followLag: 0.07,
    /** Vertical follow lag on the ground. */
    verticalLagGround: 0.1,
    /** Vertical follow lag while airborne (camera mostly ignores jumps). */
    verticalLagAir: 0.5,
    /** While airborne the camera only tracks height if the player strays this far from the take-off height. */
    airVerticalDeadzone: 2.5,
    /** Auto-rotate-behind rate at full run speed (rad/s). */
    autoRotateSpeed: 2.0,
    /** Seconds after a manual camera move before auto-rotate resumes. */
    autoRotateDelay: 1.2,
    pitchReturnSpeed: 0.8,

    touchSensitivity: 0.0065,
    mouseSensitivity: 0.005,
    gamepadSpeed: 3.2,
    keyboardSpeed: 2.4,
    invertY: false,

    collisionRadius: 0.25,
    /** How fast the camera eases back out after a wall pushed it in (m/s). */
    collisionRecoverSpeed: 5,
  },

  render: {
    /** Internal render height in pixels (PS1 was ~240). Width follows aspect ratio. */
    targetHeight: 240,
    /** Adaptive resolution never goes below this. */
    minHeight: 144,
    /** Cap on device-pixel-ratio for the upscale pass. */
    maxOutputDpr: 2,
    adaptive: true,
    targetFps: 60,
    fogNear: 22,
    fogFar: 65,
    fogColor: 0x6b6f9e,
    affineTextures: true,
    vertexSnap: true,
    dither: true,
    /** Colour levels per channel after quantisation (32 = 15-bit colour). */
    colorLevels: 32,
  },

  input: {
    joystickRadius: 56,
    touchDeadzone: 0.12,
    gamepadDeadzone: 0.18,
  },

  character: {
    /**
     * Set to a glTF/GLB URL (e.g. 'models/bimble.glb' in /public) to replace
     * the primitive mascot. Clip names: Idle, Run, Jump, Fall, Spin, Hurt.
     */
    modelUrl: null as string | null,
    modelScale: 1,
    /** Model-space Y offset so feet sit on the ground. */
    modelYOffset: 0,
  },
};

export type Tuning = typeof TUNING;
