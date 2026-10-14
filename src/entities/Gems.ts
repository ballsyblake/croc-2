import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';

const PALETTE = [0xff4f8b, 0x4fd7ff, 0xffd54f, 0x8bff6a, 0xc58bff];
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3();
const p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** All small collectible gems in a single instanced mesh. */
export class Gems {
  readonly mesh: THREE.InstancedMesh;
  readonly total: number;
  private positions: THREE.Vector3[];
  private collected: boolean[];
  private popTimers: number[];
  private time = 0;

  constructor(positions: THREE.Vector3[]) {
    this.positions = positions.map((v) => v.clone());
    this.total = positions.length;
    this.collected = positions.map(() => false);
    this.popTimers = positions.map(() => 0);
    const geo = new THREE.OctahedronGeometry(0.24, 0);
    geo.scale(0.8, 1.25, 0.8);
    const mat = ps1Lambert({ color: 0xffffff, emissive: 0x333333, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < this.total; i++) this.mesh.setColorAt(i, c.set(PALETTE[i % PALETTE.length]));
    this.mesh.frustumCulled = false;
    this.update(0);
  }

  colorOf(i: number): number {
    return PALETTE[i % PALETTE.length];
  }

  get collectedCount(): number {
    return this.collected.filter(Boolean).length;
  }

  /** Returns indices collected this call. */
  collect(playerCenter: THREE.Vector3, radius: number): number[] {
    const out: number[] = [];
    const r2 = radius * radius;
    for (let i = 0; i < this.total; i++) {
      if (this.collected[i]) continue;
      const g = this.positions[i];
      const dx = g.x - playerCenter.x;
      const dy = (g.y - playerCenter.y) * 0.7; // a bit more generous vertically
      const dz = g.z - playerCenter.z;
      if (dx * dx + dy * dy + dz * dz < r2) {
        this.collected[i] = true;
        this.popTimers[i] = 0.2;
        out.push(i);
      }
    }
    return out;
  }

  positionOf(i: number): THREE.Vector3 {
    return this.positions[i];
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.total; i++) {
      let scale = 1;
      if (this.collected[i]) {
        this.popTimers[i] = Math.max(0, this.popTimers[i] - dt);
        scale = this.popTimers[i] > 0 ? 1 + (0.2 - this.popTimers[i]) * 5 : 0;
      }
      const base = this.positions[i];
      p.set(base.x, base.y + Math.sin(this.time * 2.5 + i * 0.7) * 0.12, base.z);
      q.setFromAxisAngle(UP, this.time * 2.2 + i);
      sc.setScalar(scale);
      this.mesh.setMatrixAt(i, m.compose(p, q, sc));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    this.collected.fill(false);
    this.popTimers.fill(0);
  }
}
