import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPS1ToObject } from '../render/ps1Material';
import type { CharacterAnimState, CharacterModel } from './CharacterModel';

type ClipName = 'idle' | 'run' | 'jump' | 'fall' | 'spin' | 'hurt';

/**
 * glTF-backed character. Expects a model whose origin is at the feet and
 * which faces +Z. Animation clips are matched by (case-insensitive) name:
 * Idle, Run, Jump, Fall, Spin, Hurt. Missing clips fall back gracefully
 * (missing Spin = procedural spin of the whole model).
 */
export class GltfCharacter implements CharacterModel {
  readonly root = new THREE.Group();
  private spinPivot = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<ClipName, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  private constructor(gltfScene: THREE.Object3D, clips: THREE.AnimationClip[], scale: number, yOffset: number) {
    applyPS1ToObject(gltfScene);
    gltfScene.scale.setScalar(scale);
    gltfScene.position.y = yOffset;
    this.spinPivot.add(gltfScene);
    this.root.add(this.spinPivot);
    this.mixer = new THREE.AnimationMixer(gltfScene);
    for (const clip of clips) {
      const key = clip.name.toLowerCase() as ClipName;
      this.actions.set(key, this.mixer.clipAction(clip));
    }
  }

  static async load(url: string, scale = 1, yOffset = 0): Promise<GltfCharacter> {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new GltfCharacter(gltf.scene, gltf.animations, scale, yOffset);
  }

  private play(name: ClipName, fade = 0.12): void {
    const next = this.actions.get(name) ?? this.actions.get('idle');
    if (!next || next === this.current) return;
    next.reset().fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = next;
  }

  update(dt: number, s: CharacterAnimState): void {
    let clip: ClipName;
    if (s.hurt && this.actions.has('hurt')) clip = 'hurt';
    else if (s.spinning && this.actions.has('spin')) clip = 'spin';
    else if (!s.grounded) clip = s.vy > 0 ? 'jump' : 'fall';
    else clip = s.speed01 > 0.1 ? 'run' : 'idle';
    this.play(clip);

    const run = this.actions.get('run');
    if (run) run.timeScale = 0.6 + s.speed01 * 0.8;

    this.spinPivot.rotation.y = s.spinning && !this.actions.has('spin') ? s.spinProgress * Math.PI * 4 : 0;
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}
