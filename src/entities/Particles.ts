import * as THREE from 'three';
import { ps1Basic } from '../render/ps1Material';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();

/** Pooled chunky cube particles - one instanced draw call for all bursts. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private next = 0;

  constructor(private capacity = 256) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ps1Basic({ color: 0xffffff }), capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < capacity; i++) {
      this.parts.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0, gravity: 0 });
      this.mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
  }

  burst(at: THREE.Vector3, color: THREE.ColorRepresentation, count = 12, speed = 4, opts: { gravity?: number; size?: number; up?: number } = {}): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.next;
      this.next = (this.next + 1) % this.capacity;
      const p = this.parts[idx];
      p.pos.copy(at);
      p.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1 + (opts.up ?? 0.6), Math.random() * 2 - 1).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      p.maxLife = p.life = 0.45 + Math.random() * 0.4;
      p.size = (opts.size ?? 0.14) * (0.7 + Math.random() * 0.6);
      p.gravity = opts.gravity ?? 14;
      this.mesh.setColorAt(idx, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      const k = Math.max(0, p.life / p.maxLife);
      s.setScalar(p.size * k);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.life * 10);
      this.mesh.setMatrixAt(i, m.compose(p.pos, q, s));
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
