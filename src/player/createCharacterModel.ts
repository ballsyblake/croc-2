import * as THREE from 'three';
import { TUNING } from '../config';
import type { CharacterAnimState, CharacterModel } from './CharacterModel';
import { GltfCharacter } from './GltfCharacter';
import { PrimitiveMascot } from './PrimitiveMascot';

/**
 * Holds whichever model is active. Starts with the primitive mascot so the
 * game is playable immediately, then hot-swaps to the glTF model once it
 * loads (if TUNING.character.modelUrl is set).
 */
class CharacterSlot implements CharacterModel {
  readonly root = new THREE.Group();
  private model: CharacterModel;

  constructor(initial: CharacterModel) {
    this.model = initial;
    this.root.add(initial.root);
  }

  swap(next: CharacterModel): void {
    this.root.remove(this.model.root);
    this.model.dispose?.();
    this.model = next;
    this.root.add(next.root);
  }

  update(dt: number, state: CharacterAnimState): void {
    this.model.update(dt, state);
  }
}

export function createCharacterModel(): CharacterModel {
  const slot = new CharacterSlot(new PrimitiveMascot());
  const { modelUrl, modelScale, modelYOffset } = TUNING.character;
  if (modelUrl) {
    const url = new URL(modelUrl, document.baseURI).href;
    GltfCharacter.load(url, modelScale, modelYOffset)
      .then((m) => slot.swap(m))
      .catch((err) => console.warn('Character glTF failed to load, keeping primitive mascot:', err));
  }
  return slot;
}
