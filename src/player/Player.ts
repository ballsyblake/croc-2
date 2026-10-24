import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { TUNING } from '../config';
import type { InputFrame } from '../input/InputState';
import type { Physics } from '../world/Physics';
import type { CharacterAnimState, CharacterModel } from './CharacterModel';
import { createCharacterModel } from './createCharacterModel';

export type PlayerEvent =
  | { type: 'jump'; kind: 1 | 2 }
  | { type: 'land'; impact: number }
  | { type: 'spin' }
  | { type: 'hurt'; health: number }
  | { type: 'dead' };

const tmpWish = new THREE.Vector3();

/**
 * Third-person platformer controller on top of Rapier's kinematic character
 * controller. Runs at a fixed timestep; the visual model is interpolated.
 */
export class Player {
  readonly model: CharacterModel;
  readonly collider: RAPIER.Collider;
  private body: RAPIER.RigidBody;
  private controller: RAPIER.KinematicCharacterController;

  /** Capsule centre (simulation). */
  readonly position = new THREE.Vector3();
  private prevPosition = new THREE.Vector3();
  /** Interpolated capsule centre for rendering / camera. */
  readonly renderPosition = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  facing = 0;

  grounded = false;
  /** Height of the last surface stood on (camera uses this). */
  lastGroundY = 0;
  health = TUNING.player.maxHealth;

  private coyote = 0;
  private jumpBuffer = 0;
  private jumpedSinceGround = false;
  private doubleJumpUsed = false;
  private jumpCutDone = true;
  private spinTimer = 0;
  private spinCooldown = 0;
  private spinAirUsed = false;
  private invuln = 0;
  private controlLock = 0;
  private landImpact = 0;
  private pendingJumpKind: 0 | 1 | 2 = 0;

  onEvent: (e: PlayerEvent) => void = () => {};

  constructor(physics: Physics, spawn: THREE.Vector3) {
    const R = physics.R;
    const p = TUNING.player;
    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = physics.world.createCollider(R.ColliderDesc.capsule(p.capsuleHalfHeight, p.capsuleRadius), this.body);
    this.controller = physics.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(p.stepHeight, 0.15, false);
    this.controller.enableSnapToGround(p.snapToGround);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(p.maxSlopeDeg));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(p.maxSlopeDeg + 5));
    this.controller.setSlideEnabled(true);

    this.position.copy(spawn);
    this.prevPosition.copy(spawn);
    this.renderPosition.copy(spawn);
    this.model = createCharacterModel();
  }

  /** Height from capsule centre to feet. */
  get footOffset(): number {
    return TUNING.player.capsuleHalfHeight + TUNING.player.capsuleRadius;
  }

  get isSpinning(): boolean {
    return this.spinTimer > 0;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  fixedUpdate(dt: number, input: InputFrame, cameraYaw: number): void {
    const p = TUNING.player;
    this.prevPosition.copy(this.position);

    this.invuln = Math.max(0, this.invuln - dt);
    this.controlLock = Math.max(0, this.controlLock - dt);
    this.spinCooldown = Math.max(0, this.spinCooldown - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.landImpact = Math.max(0, this.landImpact - dt * 5);
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);

    // --- Horizontal movement, relative to camera ---
    const locked = this.controlLock > 0;
    const ix = locked ? 0 : input.moveX;
    const iy = locked ? 0 : input.moveY;
    const sinY = Math.sin(cameraYaw);
    const cosY = Math.cos(cameraYaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    tmpWish.set(cosY * ix - sinY * iy, 0, -sinY * ix - cosY * iy);
    if (tmpWish.lengthSq() > 1) tmpWish.normalize();
    const mag = tmpWish.length();

    const targetX = tmpWish.x * p.runSpeed;
    const targetZ = tmpWish.z * p.runSpeed;
    let accel: number;
    if (this.grounded) {
      accel = mag > 0.01 ? p.groundAccel : p.groundDecel;
      // Snappier reversals (skid).
      if (mag > 0.01 && this.velocity.x * targetX + this.velocity.z * targetZ < 0) accel *= 1.6;
    } else {
      accel = mag > 0.01 ? p.airAccel : p.airDecel;
    }
    const dx = targetX - this.velocity.x;
    const dz = targetZ - this.velocity.z;
    const dlen = Math.hypot(dx, dz);
    const step = accel * dt;
    if (dlen <= step) {
      this.velocity.x = targetX;
      this.velocity.z = targetZ;
    } else {
      this.velocity.x += (dx / dlen) * step;
      this.velocity.z += (dz / dlen) * step;
    }

    if (mag > 0.1) {
      const targetYaw = Math.atan2(tmpWish.x, tmpWish.z);
      const turn = (this.grounded ? p.turnSpeedGround : p.turnSpeedAir) * dt;
      this.facing = approachAngle(this.facing, targetYaw, turn);
    }

    // --- Jumping ---
    if (input.jumpPressed && !locked) this.jumpBuffer = p.jumpBufferTime;
    const canGroundJump = this.grounded || (this.coyote > 0 && !this.jumpedSinceGround);
    if (this.jumpBuffer > 0) {
      if (canGroundJump) {
        this.velocity.y = launchSpeed(p.gravity, p.jumpHeight, dt);
        this.jumpedSinceGround = true;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpCutDone = false;
        this.grounded = false;
        this.pendingJumpKind = 1;
        this.onEvent({ type: 'jump', kind: 1 });
      } else if (!this.grounded && !this.doubleJumpUsed) {
        this.velocity.y = launchSpeed(p.gravity, p.doubleJumpHeight, dt);
        this.doubleJumpUsed = true;
        this.jumpedSinceGround = true;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpCutDone = false;
        this.pendingJumpKind = 2;
        this.onEvent({ type: 'jump', kind: 2 });
      }
    }
    // Variable height: releasing jump while rising cuts the jump short.
    if (!input.jumpHeld && !this.jumpCutDone && this.velocity.y > 0) {
      this.velocity.y *= p.jumpCutMultiplier;
      this.jumpCutDone = true;
    }
    if (this.velocity.y <= 0) this.jumpCutDone = true;

    // --- Spin attack ---
    this.spinTimer = Math.max(0, this.spinTimer - dt);
    if (input.attackPressed && !locked && this.spinTimer <= 0 && this.spinCooldown <= 0) {
      this.spinTimer = p.spinDuration;
      this.spinCooldown = p.spinDuration + p.spinCooldown;
      if (!this.grounded && !this.spinAirUsed) {
        this.velocity.y = Math.max(this.velocity.y, p.spinAirHop);
        this.spinAirUsed = true;
        this.jumpCutDone = true;
      }
      this.onEvent({ type: 'spin' });
    }

    // --- Gravity ---
    let g = p.gravity;
    if (this.velocity.y < 0) g *= p.fallGravityMultiplier;
    if (this.spinTimer > 0 && !this.grounded) g *= p.spinAirGravity;
    this.velocity.y = Math.max(-p.maxFallSpeed, this.velocity.y - g * dt);

    // --- Collide & slide ---
    const desired = { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const mv = this.controller.computedMovement();
    const wasGrounded = this.grounded;
    const fallSpeed = -this.velocity.y;
    this.grounded = this.controller.computedGrounded() && this.velocity.y <= 0;

    this.position.set(this.position.x + mv.x, this.position.y + mv.y, this.position.z + mv.z);
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });

    // Lose velocity into walls so we don't "stick" with stored speed.
    const wantH = Math.hypot(desired.x, desired.z);
    const gotH = Math.hypot(mv.x, mv.z);
    if (wantH > 1e-5 && gotH < wantH - 1e-4) {
      this.velocity.x = mv.x / dt;
      this.velocity.z = mv.z / dt;
    }
    // Head bump.
    if (desired.y > 0 && mv.y < desired.y - 1e-3) this.velocity.y = Math.min(this.velocity.y, 0);

    if (this.grounded) {
      this.velocity.y = 0;
      this.coyote = p.coyoteTime;
      this.jumpedSinceGround = false;
      this.doubleJumpUsed = false;
      this.spinAirUsed = false;
      this.lastGroundY = this.position.y;
      if (!wasGrounded) {
        const impact = THREE.MathUtils.clamp(fallSpeed / 22, 0.25, 1);
        this.landImpact = impact;
        this.onEvent({ type: 'land', impact });
      }
    }
  }

  /** Called once per rendered frame with the interpolation factor between fixed steps. */
  render(dt: number, alpha: number): void {
    this.renderPosition.lerpVectors(this.prevPosition, this.position, alpha);
    const root = this.model.root;
    root.position.set(this.renderPosition.x, this.renderPosition.y - this.footOffset, this.renderPosition.z);
    root.rotation.y = this.facing;

    const state: CharacterAnimState = {
      speed01: Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / TUNING.player.runSpeed),
      grounded: this.grounded,
      vy: this.velocity.y,
      spinning: this.spinTimer > 0,
      spinProgress: 1 - this.spinTimer / TUNING.player.spinDuration,
      hurt: this.invuln > 0,
      landImpact: this.landImpact,
      jumpKind: this.pendingJumpKind,
    };
    this.pendingJumpKind = 0;
    this.model.update(dt, state);
  }

  /** Bounce off an enemy's head. Refreshes the double jump. */
  stompBounce(): void {
    const p = TUNING.player;
    this.velocity.y = launchSpeed(p.gravity, p.stompBounceHeight, 1 / 60);
    this.doubleJumpUsed = false;
    this.spinAirUsed = false;
    this.jumpCutDone = false;
    this.grounded = false;
  }

  hurt(from: THREE.Vector3): void {
    if (this.invuln > 0) return;
    const p = TUNING.player;
    this.health = Math.max(0, this.health - 1);
    this.invuln = p.invulnTime;
    this.controlLock = p.hurtControlLock;
    const away = new THREE.Vector3(this.position.x - from.x, 0, this.position.z - from.z);
    if (away.lengthSq() < 1e-4) away.set(-Math.sin(this.facing), 0, -Math.cos(this.facing));
    away.normalize().multiplyScalar(p.knockbackSpeed);
    this.velocity.set(away.x, p.knockbackUp, away.z);
    this.grounded = false;
    this.jumpCutDone = true;
    this.spinTimer = 0;
    this.onEvent({ type: 'hurt', health: this.health });
    if (this.health <= 0) this.onEvent({ type: 'dead' });
  }

  /** Lose a heart without knockback (falling in water / pits). Returns true if that was the last one. */
  damageNoKnockback(): boolean {
    this.health = Math.max(0, this.health - 1);
    this.onEvent({ type: 'hurt', health: this.health });
    return this.health <= 0;
  }

  teleport(pos: THREE.Vector3, facing?: number): void {
    this.position.copy(pos);
    this.prevPosition.copy(pos);
    this.renderPosition.copy(pos);
    this.velocity.set(0, 0, 0);
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    if (facing !== undefined) this.facing = facing;
    this.grounded = false;
    this.spinTimer = 0;
    this.jumpBuffer = 0;
    this.invuln = 1.0;
    this.lastGroundY = pos.y;
  }

  restoreHealth(): void {
    this.health = TUNING.player.maxHealth;
  }
}

/**
 * Take-off speed that reaches `height` under the fixed-step integrator.
 * Gravity is applied before the move each step, so the plain sqrt(2gh)
 * undershoots by about g*dt/2; adding it back keeps config heights truthful.
 */
function launchSpeed(gravity: number, height: number, dt: number): number {
  return Math.sqrt(2 * gravity * height) + gravity * dt * 0.5;
}

function approachAngle(current: number, target: number, maxStep: number): number {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
