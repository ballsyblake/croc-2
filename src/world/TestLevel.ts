import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder';
import type { Physics } from './Physics';
import { labelSprite } from './textures';
import type { WaterVolume } from './Water';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface LevelData {
  staticMesh: THREE.Mesh;
  decor: THREE.Object3D[];
  gems: THREE.Vector3[];
  rescues: THREE.Vector3[];
  enemies: { a: THREE.Vector3; b: THREE.Vector3 }[];
  /** Ground position + respawn facing yaw. First entry is the level start. */
  checkpoints: { pos: THREE.Vector3; facing: number }[];
  water: WaterVolume[];
  /** Falling below this is a pit death. */
  killY: number;
}

const COL = {
  wall: 0x6d6680,
  start: 0x8fb06a,
  steps: 0xe0a050,
  ramp: 0xc9b48a,
  float: 0x9a8fd0,
  sand: 0xd8c690,
  basin: 0x5a6a7a,
  stone: 0xa8a8b4,
  arena: 0x9a90b0,
  tunnel: 0x7a7090,
  chasmPlat: 0xb08fd0,
  beam: 0xd06a6a,
  summit: 0xc0a080,
  tower: 0xd0d0e0,
  abyss: 0x2a2440,
};

/**
 * Grey-box test course. Runs toward -Z through five sections:
 *  A  Start meadow  - jump-height steps (1-4 m), ramp, first enemy
 *  B  Lake          - stepping stones over water, pillar needing a double jump
 *  C  Arena         - two enemies, low-ceiling tunnel (camera collision test)
 *  D  Chasm         - floating platforms over a bottomless pit, narrow beam detour
 *  E  Summit        - stepped tower to the final rescue
 * 50 gems, 5 rescues.
 */
export function buildTestLevel(physics: Physics): LevelData {
  const b = new LevelBuilder(physics);
  const decor: THREE.Object3D[] = [];
  const gems: THREE.Vector3[] = [];
  const rescues: THREE.Vector3[] = [];
  const enemies: LevelData['enemies'] = [];
  const GEM_H = 0.9; // gem height above a surface

  const label = (text: string, pos: THREE.Vector3) => {
    const s = labelSprite(text);
    s.position.copy(pos);
    decor.push(s);
  };

  // ---------- Boundary ----------
  b.boxMinMax([-22, -18, -97], [-21, 7, 15], COL.wall);
  b.boxMinMax([21, -18, -97], [22, 7, 15], COL.wall);
  b.boxMinMax([-22, -4, 14], [22, 7, 15], COL.wall);
  b.boxMinMax([-22, -18, -97], [22, 12, -96], COL.wall);
  b.boxMinMax([-21, -18, -72], [21, -17, -56], COL.abyss); // chasm floor (purely visual; kill plane is above it)

  // ---------- A: Start meadow (z 14 .. -12) ----------
  b.boxMinMax([-21, -4, -12], [21, 0, 14], COL.start);
  // Ring of gems around the spawn.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    gems.push(v(Math.cos(a) * 3.5, GEM_H, 1.5 + Math.sin(a) * 3.5));
  }
  // Jump-height test steps, adjacent so they also form a staircase.
  for (let i = 0; i < 4; i++) {
    const h = i + 1;
    const z = 8 - i * 3;
    b.boxMinMax([13.5, 0, z - 1.5], [16.5, h, z + 1.5], COL.steps);
    label(`${h}m`, v(12.8, h + 0.6, z));
    gems.push(v(15, h + GEM_H, z));
  }
  // Ramp up to a ledge, then a hop to a floating platform with rescue #1.
  b.ramp(v(-12, 0, 6), v(-12, 3, -4), 4, 1, COL.ramp);
  b.boxMinMax([-15, -4, -10], [-9, 3, -4], COL.ramp);
  for (const t of [0.25, 0.5, 0.75]) gems.push(v(-12, 3 * t + GEM_H, 6 - 10 * t));
  gems.push(v(-13.5, 3 + GEM_H, -8.5), v(-10.5, 3 + GEM_H, -8.5));
  b.boxMinMax([-6.5, 3.5, -9.5], [-3.5, 4, -6.5], COL.float);
  rescues.push(v(-5, 4, -8));
  enemies.push({ a: v(-6, 0, -6), b: v(6, 0, -6) });

  // ---------- B: Lake (z -12 .. -36) ----------
  b.boxMinMax([-21, -4, -36], [-12, 0, -12], COL.sand);
  b.boxMinMax([12, -4, -36], [21, 0, -12], COL.sand);
  b.boxMinMax([-12, -4, -36], [12, -2.5, -12], COL.basin);
  const stones: [number, number][] = [[0, -15.5], [-3, -20.5], [1, -25.5], [-2, -30.5], [1.5, -35]];
  stones.forEach(([x, z], i) => {
    b.boxMinMax([x - 1.2, -2.5, z - 1.2], [x + 1.2, 0.4, z + 1.2], COL.stone);
    gems.push(v(x, 0.4 + GEM_H, z));
    if (i > 0) {
      const [px, pz] = stones[i - 1];
      gems.push(v((x + px) / 2, 2.2, (z + pz) / 2));
    }
  });
  // Pillar reachable from the east bank with a double jump.
  b.boxMinMax([7, -2.5, -25], [9, 2.5, -23], COL.stone);
  rescues.push(v(8, 2.5, -24));
  label('2.5m', v(10.5, 3.2, -24));

  // ---------- C: Arena (z -36 .. -56) ----------
  b.boxMinMax([-21, -18, -56], [21, 0, -36], COL.arena);
  enemies.push({ a: v(-4, 0, -44), b: v(8, 0, -44) });
  enemies.push({ a: v(8, 0, -50), b: v(-4, 0, -50) });
  for (const x of [0, 3, 6]) gems.push(v(x, GEM_H, -40.5));
  for (const x of [-1, 2, 5, 8]) gems.push(v(x, GEM_H, -47));
  // Low tunnel, open at the +Z end, dead end with rescue #3.
  b.boxMinMax([-15.5, 0, -54.5], [-15, 2.6, -40], COL.tunnel); // west wall
  b.boxMinMax([-11, 0, -54.5], [-10.5, 2.6, -40], COL.tunnel); // east wall
  b.boxMinMax([-15.5, 2.6, -54.5], [-10.5, 3.2, -40], COL.tunnel); // ceiling
  b.boxMinMax([-15.5, 0, -55], [-10.5, 3.2, -54.5], COL.tunnel); // end cap
  for (const z of [-42, -45, -48, -51]) gems.push(v(-13, GEM_H, z));
  rescues.push(v(-13, 0, -53.2));

  // ---------- D: Chasm (z -56 .. -72) ----------
  const plats: [number, number, number][] = [[0, 0.5, -59.5], [3.5, 1.5, -63.5], [0, 2.5, -67.5]];
  for (const [x, top, z] of plats) {
    b.boxMinMax([x - 1.5, top - 1, z - 1.5], [x + 1.5, top, z + 1.5], COL.chasmPlat);
    gems.push(v(x, top + GEM_H, z));
  }
  // Narrow beam detour to rescue #4.
  b.boxMinMax([5, 1.1, -63.9], [10.8, 1.5, -63.1], COL.beam);
  b.boxMinMax([10.8, 0.5, -65], [13.2, 1.5, -62], COL.chasmPlat);
  for (const x of [6.5, 8, 9.5]) gems.push(v(x, 1.5 + GEM_H, -63.5));
  rescues.push(v(12, 1.5, -63.5));

  // ---------- E: Summit (z -72 .. -96) ----------
  b.boxMinMax([-21, -18, -96], [21, 3, -72], COL.summit);
  const tower: [number, number, number][] = [[4, 4.2, -80], [7, 5.4, -78], [10, 6.6, -80], [12, 7.8, -83], [10, 9.0, -86]];
  for (const [x, top, z] of tower) {
    b.boxMinMax([x - 1, 3, z - 1], [x + 1, top, z + 1], COL.tower);
    gems.push(v(x, top + GEM_H, z));
  }
  b.boxMinMax([4.5, 3, -89.5], [7.5, 10.2, -86.5], COL.tower);
  gems.push(v(5, 10.2 + GEM_H, -87), v(7, 10.2 + GEM_H, -87));
  rescues.push(v(6, 10.2, -88.3));
  enemies.push({ a: v(-8, 3, -79), b: v(-8, 3, -91) });

  if (gems.length !== 50) console.warn(`Test level has ${gems.length} gems (expected 50)`);
  if (rescues.length !== 5) console.warn(`Test level has ${rescues.length} rescues (expected 5)`);

  return {
    staticMesh: b.build(),
    decor,
    gems,
    rescues,
    enemies,
    checkpoints: [
      { pos: v(0, 0, 6.5), facing: Math.PI },
      { pos: v(3, 0, -37.5), facing: Math.PI },
      { pos: v(-3, 3, -73.5), facing: Math.PI },
    ],
    water: [{ minX: -12, maxX: 12, minZ: -36, maxZ: -12, surfaceY: -0.6 }],
    killY: -12,
  };
}
