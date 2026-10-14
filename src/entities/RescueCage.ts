import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';

const cageMat = ps1Lambert({ color: 0x8a7a66, flatShading: true });
const sproutMat = ps1Lambert({ color: 0xb6e35a, flatShading: true });
const leafMat = ps1Lambert({ color: 0x3fae4a, flatShading: true });
const eyeMat = ps1Lambert({ color: 0x151520 });

/**
 * A caged "Sproutling" - a tiny bulb creature with a leaf on its head.
 * Touch the cage (or spin it) to free it.
 */
export class RescueCage {
  readonly group = new THREE.Group();
  rescued = false;
  private bars = new THREE.Group();
  private sprout = new THREE.Group();
  private t = 0;
  private freedT = -1;

  constructor(readonly position: THREE.Vector3) {
    this.group.position.copy(position);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.15, 8), cageMat);
    base.position.y = 0.075;
    this.group.add(base);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 8), cageMat);
    top.position.y = 1.55;
    this.bars.add(top);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.3, 0.07), cageMat);
      bar.position.set(Math.cos(a) * 0.62, 0.8, Math.sin(a) * 0.62);
      this.bars.add(bar);
    }
    this.group.add(this.bars);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), sproutMat);
    body.scale.set(1, 0.9, 1);
    const leaf1 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), leafMat);
    leaf1.position.set(0.06, 0.3, 0);
    leaf1.rotation.z = -0.6;
    const leaf2 = leaf1.clone();
    leaf2.position.x = -0.06;
    leaf2.rotation.z = 0.6;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), eyeMat);
    eyeL.position.set(-0.09, 0.04, 0.23);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.09;
    this.sprout.add(body, leaf1, leaf2, eyeL, eyeR);
    this.sprout.position.y = 0.42;
    this.group.add(this.sprout);
  }

  /** Centre used for trigger tests. */
  get center(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z);
  }

  free(): void {
    if (this.rescued) return;
    this.rescued = true;
    this.freedT = 0;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.freedT < 0) {
      // Bounce nervously inside the cage.
      this.sprout.position.y = 0.42 + Math.abs(Math.sin(this.t * 4)) * 0.18;
      this.sprout.rotation.y = Math.sin(this.t * 1.3) * 0.6;
      return;
    }
    this.freedT += dt;
    const f = this.freedT;
    // Bars blow outward and shrink.
    this.bars.scale.setScalar(Math.max(0, 1 - f * 3));
    this.bars.position.y = f * 2;
    // Sproutling hops up, spins and floats away.
    this.sprout.position.y = 0.42 + f * 2.2 + Math.sin(f * 8) * 0.2;
    this.sprout.rotation.y += dt * 10;
    this.sprout.scale.setScalar(Math.max(0, 1 - Math.max(0, f - 1.2) * 1.5));
    if (f > 2.2) this.group.visible = this.bars.visible = false;
  }

  reset(): void {
    this.rescued = false;
    this.freedT = -1;
    this.bars.scale.setScalar(1);
    this.bars.position.y = 0;
    this.sprout.scale.setScalar(1);
    this.group.visible = true;
  }
}
