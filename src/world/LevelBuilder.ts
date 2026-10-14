import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from './Physics';
import { ps1Lambert } from '../render/ps1Material';
import { greyboxTexture } from './textures';

export interface BoxOptions {
  rotation?: THREE.Quaternion;
  collide?: boolean;
  /** Metres per texture tile. */
  tile?: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Collects grey-box geometry, merges it into a single draw call and creates
 * matching static colliders. Large faces are subdivided so the affine
 * texture warp stays in the "charming" range rather than "broken".
 */
export class LevelBuilder {
  private pieces: THREE.BufferGeometry[] = [];
  private color = new THREE.Color();

  constructor(private physics: Physics) {}

  /** Axis-aligned (or rotated) box. `center` and `size` in world units. */
  box(center: THREE.Vector3, size: THREE.Vector3, color: THREE.ColorRepresentation, opts: BoxOptions = {}): void {
    const seg = (d: number) => THREE.MathUtils.clamp(Math.ceil(d / 2.5), 1, 16);
    const g = new THREE.BoxGeometry(size.x, size.y, size.z, seg(size.x), seg(size.y), seg(size.z));
    const tile = opts.tile ?? 2;

    const pos = g.attributes.position as THREE.BufferAttribute;
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    this.color.set(color);
    const side = this.color.clone().multiplyScalar(0.82);
    const bottom = this.color.clone().multiplyScalar(0.6);

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i) + center.x;
      const py = pos.getY(i) + center.y;
      const pz = pos.getZ(i) + center.z;
      const nx = nrm.getX(i);
      const ny = nrm.getY(i);
      let u: number, v: number;
      let c: THREE.Color;
      if (Math.abs(ny) > 0.5) {
        u = px; v = pz; c = ny > 0 ? this.color : bottom;
      } else if (Math.abs(nx) > 0.5) {
        u = pz; v = py; c = side;
      } else {
        u = px; v = py; c = side;
      }
      uv.setXY(i, u / tile, v / tile);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const m = new THREE.Matrix4().compose(center, opts.rotation ?? new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    this.pieces.push(g);

    if (opts.collide !== false) this.physics.addBox(center, size, opts.rotation);
  }

  /** Box spanning min..max corners. */
  boxMinMax(min: [number, number, number], max: [number, number, number], color: THREE.ColorRepresentation, opts?: BoxOptions): void {
    const c = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const s = new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    this.box(c, s, color, opts);
  }

  /** Ramp whose top surface runs from point `a` to point `b` (both on the walkable surface centreline). */
  ramp(a: THREE.Vector3, b: THREE.Vector3, width: number, thickness: number, color: THREE.ColorRepresentation): void {
    const f = b.clone().sub(a);
    const length = f.length();
    f.normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    const center = a.clone().add(b).multiplyScalar(0.5).addScaledVector(u, -thickness / 2);
    this.box(center, new THREE.Vector3(width, thickness, length), color, { rotation: q });
  }

  /** Merge everything collected so far into one mesh. */
  build(): THREE.Mesh {
    const merged = mergeGeometries(this.pieces, false);
    if (!merged) throw new Error('Level geometry merge failed');
    merged.computeBoundingSphere();
    for (const p of this.pieces) p.dispose();
    this.pieces = [];
    const mat = ps1Lambert({ map: greyboxTexture(), vertexColors: true });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = 'level-static';
    return mesh;
  }
}
