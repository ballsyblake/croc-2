import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';
import { waterTexture } from './textures';

export interface WaterVolume {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surfaceY: number;
}

/** Visual water surfaces + the volumes used for "fell in, respawn" checks. */
export class Water {
  readonly group = new THREE.Group();
  private tex = waterTexture();
  private geos: { geo: THREE.PlaneGeometry; base: Float32Array }[] = [];
  private t = 0;

  constructor(readonly volumes: WaterVolume[]) {
    const mat = ps1Lambert({ map: this.tex, transparent: true, opacity: 0.82, emissive: 0x0a2040 });
    this.tex.repeat.set(1, 1);
    for (const v of volumes) {
      const w = v.maxX - v.minX;
      const d = v.maxZ - v.minZ;
      const geo = new THREE.PlaneGeometry(w, d, Math.ceil(w / 2), Math.ceil(d / 2));
      geo.rotateX(-Math.PI / 2);
      // World-space UVs, 1 tile per 3 m.
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + v.minX) / 3, (pos.getZ(i) + v.minZ) / 3);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((v.minX + v.maxX) / 2, v.surfaceY, (v.minZ + v.maxZ) / 2);
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.geos.push({ geo, base: Float32Array.from(pos.array as Float32Array) });
    }
  }

  /** True if a point (feet) is under water. */
  isSubmerged(x: number, y: number, z: number, depth = 0.3): boolean {
    for (const v of this.volumes) {
      if (x >= v.minX && x <= v.maxX && z >= v.minZ && z <= v.maxZ && y < v.surfaceY - depth) return true;
    }
    return false;
  }

  update(dt: number): void {
    this.t += dt;
    this.tex.offset.set(this.t * 0.05, this.t * 0.03);
    // Gentle vertex swell.
    for (const { geo, base } of this.geos) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        arr[i * 3 + 1] = Math.sin(x * 0.6 + this.t * 1.6) * 0.06 + Math.cos(z * 0.5 + this.t * 1.2) * 0.06;
      }
      pos.needsUpdate = true;
    }
  }
}
