import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';
import type { CharacterAnimState, CharacterModel } from './CharacterModel';

/**
 * "Bimble" - placeholder mascot built from primitives: a round teal
 * puffball with long floppy ears, a cream belly, an orange scarf and a
 * pom-pom tail it whirls around for its spin attack.
 */
export class PrimitiveMascot implements CharacterModel {
  readonly root = new THREE.Group();
  private spinPivot = new THREE.Group();
  private bodyPivot = new THREE.Group();
  private earL = new THREE.Group();
  private earR = new THREE.Group();
  private footL: THREE.Mesh;
  private footR: THREE.Mesh;
  private tail = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private mats: THREE.MeshLambertMaterial[] = [];

  private runPhase = 0;
  private earLag = 0;
  private time = 0;
  private blinkTimer = 2;
  private stretch = 0;

  constructor() {
    const fur = this.mat(0x3fc1b0);
    const furDark = this.mat(0x2a8d86);
    const belly = this.mat(0xf3e6c4);
    const scarf = this.mat(0xf08a2c);
    const white = this.mat(0xffffff);
    const black = this.mat(0x151520);
    const pink = this.mat(0xf2879b);

    this.root.add(this.spinPivot);
    this.spinPivot.add(this.bodyPivot);

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 9, 7), fur);
    body.position.y = 0.55;
    body.scale.set(1, 0.95, 0.95);
    this.bodyPivot.add(body);

    const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 8, 6), belly);
    bellyMesh.position.set(0, 0.48, 0.2);
    bellyMesh.scale.set(1, 1, 0.6);
    this.bodyPivot.add(bellyMesh);

    // Scarf
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.08, 4, 10), scarf);
    scarfRing.rotation.x = Math.PI / 2;
    scarfRing.position.y = 0.78;
    this.bodyPivot.add(scarfRing);
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.05), scarf);
    scarfTail.position.set(0.18, 0.66, -0.36);
    scarfTail.rotation.set(0.3, 0, -0.25);
    this.bodyPivot.add(scarfTail);

    // Eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), white);
      ball.scale.set(0.8, 1.15, 0.6);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), black);
      pupil.position.set(0, -0.01, 0.055);
      pupil.scale.set(0.9, 1.2, 0.6);
      eye.add(ball, pupil);
      eye.position.set(side * 0.15, 0.68, 0.38);
      eye.rotation.y = side * 0.25;
      this.bodyPivot.add(eye);
      this.eyes.push(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), pink);
    nose.position.set(0, 0.58, 0.45);
    this.bodyPivot.add(nose);

    // Ears: pivot at the top of the head so they flop.
    for (const [ear, side] of [[this.earL, -1], [this.earR, 1]] as const) {
      const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 2, 6), fur);
      outer.position.y = 0.3;
      outer.scale.set(1, 1, 0.55);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.36, 2, 5), pink);
      inner.position.set(0, 0.3, 0.035);
      inner.scale.set(1, 1, 0.4);
      ear.add(outer, inner);
      ear.position.set(side * 0.2, 0.92, -0.02);
      ear.rotation.z = -side * 0.35;
      this.bodyPivot.add(ear);
    }

    // Arms (little nubs)
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), furDark);
      arm.position.set(side * 0.44, 0.46, 0.06);
      arm.scale.set(0.8, 1.1, 0.8);
      this.bodyPivot.add(arm);
    }

    // Feet
    const footGeo = new THREE.SphereGeometry(0.14, 7, 4);
    this.footL = new THREE.Mesh(footGeo, furDark);
    this.footR = new THREE.Mesh(footGeo, furDark);
    for (const [f, side] of [[this.footL, -1], [this.footR, 1]] as const) {
      f.scale.set(0.9, 0.55, 1.35);
      f.position.set(side * 0.2, 0.08, 0.04);
      this.spinPivot.add(f);
    }

    // Tail: stem + pom-pom, behind the body.
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.35, 5), fur);
    stem.rotation.x = Math.PI / 2;
    stem.position.z = -0.17;
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), belly);
    pom.position.z = -0.38;
    this.tail.add(stem, pom);
    this.tail.position.set(0, 0.4, -0.38);
    this.tail.rotation.x = -0.5;
    this.bodyPivot.add(this.tail);
  }

  private mat(color: number): THREE.MeshLambertMaterial {
    const m = ps1Lambert({ color, flatShading: true });
    this.mats.push(m);
    return m;
  }

  update(dt: number, s: CharacterAnimState): void {
    this.time += dt;

    // Run cycle
    const cadence = 7 + s.speed01 * 9;
    if (s.grounded && s.speed01 > 0.05) this.runPhase += dt * cadence;
    const runAmt = s.grounded ? s.speed01 : 0;
    const sw = Math.sin(this.runPhase);
    this.footL.position.z = 0.04 + sw * 0.22 * runAmt;
    this.footR.position.z = 0.04 - sw * 0.22 * runAmt;
    this.footL.position.y = 0.08 + Math.max(0, sw) * 0.12 * runAmt;
    this.footR.position.y = 0.08 + Math.max(0, -sw) * 0.12 * runAmt;
    if (!s.grounded) {
      // Tuck feet in the air.
      this.footL.position.set(-0.2, 0.15, 0.12);
      this.footR.position.set(0.2, 0.12, -0.05);
    }

    const bob = s.grounded ? Math.abs(Math.cos(this.runPhase)) * 0.07 * runAmt : 0;
    const breathe = Math.sin(this.time * 2.4) * 0.02 * (1 - runAmt);

    // Squash & stretch
    const targetStretch = s.grounded ? 0 : THREE.MathUtils.clamp(s.vy / 14, -0.5, 1);
    this.stretch += (targetStretch - this.stretch) * Math.min(1, dt * 14);
    const sy = 1 + this.stretch * 0.14 - s.landImpact * 0.28 + breathe;
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    this.bodyPivot.scale.set(sxz, sy, sxz);
    this.bodyPivot.position.y = bob;
    this.bodyPivot.rotation.x = runAmt * 0.18;

    // Ears lag behind vertical motion and flap while running.
    const earTarget = THREE.MathUtils.clamp(-s.vy * 0.06, -0.6, 0.9) + Math.sin(this.runPhase * 2) * 0.12 * runAmt + runAmt * 0.5;
    this.earLag += (earTarget - this.earLag) * Math.min(1, dt * 10);
    this.earL.rotation.x = -this.earLag;
    this.earR.rotation.x = -this.earLag * 0.9;

    // Spin attack: two full turns, tail swings out.
    if (s.spinning) {
      const t = s.spinProgress;
      this.spinPivot.rotation.y = easeOut(t) * Math.PI * 4;
      this.tail.rotation.x = -1.45;
      this.tail.scale.setScalar(1.35);
    } else {
      this.spinPivot.rotation.y = 0;
      this.tail.rotation.x = -0.5 + Math.sin(this.time * 6) * 0.15 * (1 - runAmt) + runAmt * 0.3;
      this.tail.scale.setScalar(1);
    }

    // Blink
    this.blinkTimer -= dt;
    const blink = this.blinkTimer < 0.12;
    if (this.blinkTimer < 0) this.blinkTimer = 1.8 + Math.random() * 2.5;
    for (const e of this.eyes) e.scale.y = blink ? 0.15 : 1;

    // Hurt flash
    const flash = s.hurt && Math.floor(this.time * 16) % 2 === 0;
    for (const m of this.mats) m.emissive.setRGB(flash ? 0.6 : 0, flash ? 0.15 : 0, flash ? 0.15 : 0);
  }

  dispose(): void {
    this.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const m of this.mats) m.dispose();
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
