import type * as THREE from 'three';

/** Everything a visual model needs to animate itself. Produced by the Player each frame. */
export interface CharacterAnimState {
  /** 0..1 horizontal speed relative to run speed. */
  speed01: number;
  grounded: boolean;
  /** Vertical velocity (m/s). */
  vy: number;
  spinning: boolean;
  /** 0..1 progress through the current spin. */
  spinProgress: number;
  /** True while invulnerable after a hit. */
  hurt: boolean;
  /** 0..1, spikes to 1 on landing, decays. Use for squash. */
  landImpact: number;
  /** Set for one frame when a jump starts: 1 = ground jump, 2 = double jump. */
  jumpKind: 0 | 1 | 2;
}

/**
 * The hook for swapping visuals. The Player owns physics and only talks to
 * the model through this interface. `root` origin must be at the feet,
 * facing +Z. See GltfCharacter.ts for a glTF implementation.
 */
export interface CharacterModel {
  readonly root: THREE.Object3D;
  update(dt: number, state: CharacterAnimState): void;
  dispose?(): void;
}
