import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export type RapierModule = typeof RAPIER;

/** Thin wrapper around a Rapier world: static level colliders + spatial queries. */
export class Physics {
  readonly R: RapierModule = RAPIER;
  readonly world: RAPIER.World;
  private ball = new RAPIER.Ball(0.25);
  private ballRadius = 0.25;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = 1 / 60;
  }

  static async create(): Promise<Physics> {
    await RAPIER.init();
    return new Physics();
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  /** Static oriented box collider. `size` is full extents. */
  addBox(center: THREE.Vector3, size: THREE.Vector3, rotation?: THREE.Quaternion): RAPIER.Collider {
    const desc = this.R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(center.x, center.y, center.z)
      .setFriction(0);
    if (rotation) desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    return this.world.createCollider(desc);
  }

  addCylinder(center: THREE.Vector3, radius: number, height: number): RAPIER.Collider {
    const desc = this.R.ColliderDesc.cylinder(height / 2, radius).setTranslation(center.x, center.y, center.z);
    return this.world.createCollider(desc);
  }

  /**
   * Sweep a sphere from `from` along unit `dir` up to `maxDist`.
   * Returns distance travelled before contact, or maxDist if clear.
   */
  sphereCast(from: THREE.Vector3, dir: THREE.Vector3, maxDist: number, radius: number, exclude?: RAPIER.Collider): number {
    if (radius !== this.ballRadius) {
      this.ball = new this.R.Ball(radius);
      this.ballRadius = radius;
    }
    const hit = this.world.castShape(
      { x: from.x, y: from.y, z: from.z },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: dir.x, y: dir.y, z: dir.z },
      this.ball,
      0,
      maxDist,
      true,
      undefined,
      undefined,
      exclude,
    );
    return hit ? hit.time_of_impact : maxDist;
  }

  /** Downward ray, returns hit Y or null. */
  groundBelow(from: THREE.Vector3, maxDist: number, exclude?: RAPIER.Collider): number | null {
    const ray = new this.R.Ray({ x: from.x, y: from.y, z: from.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxDist, true, undefined, undefined, exclude);
    return hit ? from.y - hit.timeOfImpact : null;
  }
}
