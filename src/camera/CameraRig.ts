import * as THREE from 'three';
import { TUNING } from '../config';
import type { InputFrame } from '../input/InputState';
import type { Player } from '../player/Player';
import type { Physics } from '../world/Physics';

const dir = new THREE.Vector3();
const pivotPoint = new THREE.Vector3();

/**
 * Orbit camera: smooth follow with lag, auto-rotates behind the player while
 * running, manual orbit from touch/mouse/stick, and a sphere-cast so it never
 * ends up inside walls. Camera position = pivot + (sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)) * distance.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = TUNING.camera.defaultPitch;
  private distance = TUNING.camera.distance;
  private pivot = new THREE.Vector3();
  private manualTimer = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(TUNING.camera.fov, aspect, 0.1, 200);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Jump straight to a framing behind the player (spawn / respawn). */
  snapBehind(player: Player): void {
    this.yaw = player.facing + Math.PI;
    this.pitch = TUNING.camera.defaultPitch;
    this.pivot.copy(player.renderPosition);
    this.distance = TUNING.camera.distance;
    this.manualTimer = 0;
  }

  update(dt: number, input: InputFrame, player: Player, physics: Physics): void {
    const c = TUNING.camera;

    // Manual orbit.
    if (input.lookYaw !== 0 || input.lookPitch !== 0) {
      this.yaw += input.lookYaw;
      this.pitch += input.lookPitch;
      this.manualTimer = c.autoRotateDelay;
    }
    this.manualTimer = Math.max(0, this.manualTimer - dt);
    this.pitch = THREE.MathUtils.clamp(this.pitch, c.minPitch, c.maxPitch);

    // Auto-rotate behind the player while they run (not when running at the camera).
    const speed01 = Math.min(1, Math.hypot(player.velocity.x, player.velocity.z) / TUNING.player.runSpeed);
    if (this.manualTimer <= 0 && speed01 > 0.15) {
      const behind = player.facing + Math.PI;
      const diff = wrapAngle(behind - this.yaw);
      if (Math.abs(diff) < 2.5) {
        this.yaw += diff * (1 - Math.exp(-c.autoRotateSpeed * speed01 * dt));
      }
      this.pitch += (c.defaultPitch - this.pitch) * (1 - Math.exp(-c.pitchReturnSpeed * dt));
    }
    this.yaw = wrapAngle(this.yaw);

    // Follow. Vertical tracking mostly ignores jumps so the horizon stays put.
    const p = player.renderPosition;
    let targetY = p.y;
    let vLag = c.verticalLagGround;
    if (!player.grounded) {
      const ground = player.lastGroundY;
      if (p.y < ground - 0.2) {
        targetY = p.y; // falling off a ledge / into a pit - follow promptly
      } else if (p.y - ground > c.airVerticalDeadzone) {
        targetY = p.y - c.airVerticalDeadzone;
        vLag = c.verticalLagAir;
      } else {
        targetY = ground;
        vLag = c.verticalLagAir;
      }
    }
    const kh = c.followLag > 0 ? 1 - Math.exp(-dt / c.followLag) : 1;
    const kv = vLag > 0 ? 1 - Math.exp(-dt / vLag) : 1;
    this.pivot.x += (p.x - this.pivot.x) * kh;
    this.pivot.z += (p.z - this.pivot.z) * kh;
    this.pivot.y += (targetY - this.pivot.y) * kv;

    pivotPoint.set(this.pivot.x, this.pivot.y + c.pivotHeight, this.pivot.z);
    const cp = Math.cos(this.pitch);
    dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);

    // Collision: sweep a small sphere from the pivot to the desired position.
    const clear = physics.sphereCast(pivotPoint, dir, c.distance, c.collisionRadius, player.collider);
    const allowed = Math.max(c.minDistance, clear - 0.05);
    if (allowed < this.distance) this.distance = allowed;
    else this.distance = Math.min(allowed, this.distance + c.collisionRecoverSpeed * dt);

    this.camera.position.copy(pivotPoint).addScaledVector(dir, this.distance);
    this.camera.lookAt(pivotPoint);
  }
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
