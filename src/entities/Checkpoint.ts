import * as THREE from 'three';
import { ps1Lambert } from '../render/ps1Material';

const postMat = ps1Lambert({ color: 0x6a5a8a, flatShading: true });

/** Lantern post. Touch to make it the respawn point. */
export class Checkpoint {
  readonly group = new THREE.Group();
  active = false;
  private lantern: THREE.Mesh;
  private lanternMat = ps1Lambert({ color: 0x777788, emissive: 0x000000, flatShading: true });
  private t = 0;

  /**
   * @param position ground position of the post
   * @param facing yaw the player faces after respawning here
   */
  constructor(readonly position: THREE.Vector3, readonly facing: number) {
    this.group.position.copy(position);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.6, 6), postMat);
    post.position.y = 0.8;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.2, 6), postMat);
    base.position.y = 0.1;
    this.lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), this.lanternMat);
    this.lantern.position.y = 1.85;
    this.group.add(post, base, this.lantern);
  }

  activate(): boolean {
    if (this.active) return false;
    this.active = true;
    this.lanternMat.color.set(0xffe27a);
    this.lanternMat.emissive.set(0xc89a20);
    return true;
  }

  deactivate(): void {
    this.active = false;
    this.lanternMat.color.set(0x777788);
    this.lanternMat.emissive.set(0x000000);
  }

  /** Where the player's capsule centre goes on respawn. */
  spawnPoint(footOffset: number): THREE.Vector3 {
    // In front of and beside the post, so the post never sits between camera and player.
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    return new THREE.Vector3(
      this.position.x + fx * 1.0 - fz * 1.6,
      this.position.y + footOffset + 0.05,
      this.position.z + fz * 1.0 + fx * 1.6,
    );
  }

  update(dt: number): void {
    this.t += dt;
    this.lantern.rotation.y = this.t * (this.active ? 3 : 0.6);
    this.lantern.position.y = 1.85 + (this.active ? Math.sin(this.t * 3) * 0.08 : 0);
  }
}
