import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';

const bodyMat = ps1Lambert({ color: 0xc8643a, flatShading: true });
const capMat = ps1Lambert({ color: 0x6b3d24, flatShading: true });
const footMat = ps1Lambert({ color: 0x3d2416, flatShading: true });
const whiteMat = ps1Lambert({ color: 0xffffff });
const blackMat = ps1Lambert({ color: 0x151520 });

type State = 'patrol' | 'pause' | 'chase' | 'dead';

/**
 * "Grumblenut": a grumpy walking nut. Patrols between two points, waddles
 * toward the player if they get close (never leaving its patrol line).
 * Defeated by the spin attack or by landing on its head.
 */
export class Enemy {
  readonly group = new THREE.Group();
  readonly radius = 0.5;
  readonly height = 1.0;
  readonly position = new THREE.Vector3();
  state: State = 'patrol';

  private visual = new THREE.Group();
  private feet: THREE.Mesh[] = [];
  private dir = 1; // +1 toward b, -1 toward a
  private t = 0; // 0..1 along a->b
  private pauseTimer = 0;
  private walkPhase = 0;
  private deadTimer = 0;
  private deadVel = new THREE.Vector3();
  private segLen: number;

  constructor(private a: THREE.Vector3, private b: THREE.Vector3, private speed = 2.2, private chaseSpeed = 3.4) {
    this.segLen = Math.max(0.001, a.distanceTo(b));
    this.position.copy(a);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bodyMat);
    body.position.y = 0.55;
    body.scale.set(1, 0.9, 1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.53, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 0.62;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25, 4), capMat);
    stalk.position.y = 1.2;
    this.visual.add(body, cap, stalk);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), whiteMat);
      eye.position.set(side * 0.17, 0.55, 0.42);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 3), blackMat);
      pupil.position.set(side * 0.17, 0.54, 0.52);
      // Angry brow
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), blackMat);
      brow.position.set(side * 0.17, 0.7, 0.48);
      brow.rotation.z = side * 0.45;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), footMat);
      foot.position.set(side * 0.22, 0.06, 0);
      this.feet.push(foot);
      this.visual.add(eye, pupil, brow, foot);
    }
    this.group.add(this.visual);
    this.syncGroup();
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  update(dt: number, playerPos: THREE.Vector3, playerFeetY: number): void {
    if (this.state === 'dead') {
      this.deadTimer += dt;
      this.deadVel.y -= 20 * dt;
      this.group.position.addScaledVector(this.deadVel, dt);
      this.visual.rotation.x += dt * 12;
      this.visual.scale.setScalar(Math.max(0, 1 - this.deadTimer * 0.9));
      if (this.deadTimer > 1.2) this.group.visible = false;
      return;
    }

    const toPlayer = new THREE.Vector3(playerPos.x - this.position.x, 0, playerPos.z - this.position.z);
    const near = toPlayer.length() < 5 && Math.abs(playerFeetY - this.position.y) < 1.5;

    let moveSpeed = 0;
    if (near) {
      this.state = 'chase';
      // Project the player onto the patrol segment and walk toward that point.
      const ab = new THREE.Vector3().subVectors(this.b, this.a);
      const ap = new THREE.Vector3(playerPos.x - this.a.x, 0, playerPos.z - this.a.z);
      const targetT = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
      const dtT = targetT - this.t;
      const stepT = (this.chaseSpeed * dt) / this.segLen;
      if (Math.abs(dtT) > 0.01) {
        this.dir = Math.sign(dtT);
        this.t += Math.sign(dtT) * Math.min(Math.abs(dtT), stepT);
        moveSpeed = this.chaseSpeed;
      }
    } else if (this.state === 'pause') {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) this.state = 'patrol';
    } else {
      this.state = 'patrol';
      this.t += (this.dir * this.speed * dt) / this.segLen;
      moveSpeed = this.speed;
      if (this.t >= 1 || this.t <= 0) {
        this.t = THREE.MathUtils.clamp(this.t, 0, 1);
        this.dir *= -1;
        this.state = 'pause';
        this.pauseTimer = 0.7;
      }
    }

    this.position.lerpVectors(this.a, this.b, this.t);

    // Face movement direction, or the player while chasing.
    const face = near ? Math.atan2(toPlayer.x, toPlayer.z) : Math.atan2((this.b.x - this.a.x) * this.dir, (this.b.z - this.a.z) * this.dir);
    let d = face - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 8);

    // Waddle
    this.walkPhase += dt * (moveSpeed > 0 ? 10 + moveSpeed * 2 : 2);
    const w = moveSpeed > 0 ? 1 : 0.15;
    this.visual.rotation.z = Math.sin(this.walkPhase) * 0.15 * w;
    this.visual.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08 * w;
    this.feet[0].position.z = Math.sin(this.walkPhase) * 0.15 * w;
    this.feet[1].position.z = -Math.sin(this.walkPhase) * 0.15 * w;
    this.syncGroup();
  }

  defeat(from: THREE.Vector3): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadTimer = 0;
    const away = new THREE.Vector3(this.position.x - from.x, 0, this.position.z - from.z);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.normalize().multiplyScalar(5);
    this.deadVel.set(away.x, 8, away.z);
  }

  reset(): void {
    this.state = 'patrol';
    this.t = 0;
    this.dir = 1;
    this.position.copy(this.a);
    this.visual.rotation.set(0, 0, 0);
    this.visual.scale.setScalar(1);
    this.group.visible = true;
    this.syncGroup();
  }

  private syncGroup(): void {
    this.group.position.copy(this.position);
  }
}
