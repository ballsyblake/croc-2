import * as THREE from 'three';

/** Deterministic PRNG so procedural textures look the same every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void, seed = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, rng(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Grey-box tile: light grey with noise, a darker border and a corner notch, so scale and motion read clearly. */
export function greyboxTexture(): THREE.CanvasTexture {
  return canvasTexture(32, (ctx, rand) => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const checker = ((x >> 4) + (y >> 4)) & 1;
        const v = 196 + checker * 22 + Math.floor(rand() * 14);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgba(60,60,70,0.55)';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = 'rgba(60,60,70,0.35)';
    ctx.fillRect(2, 2, 3, 3);
  }, 7);
}

export function waterTexture(): THREE.CanvasTexture {
  return canvasTexture(32, (ctx, rand) => {
    ctx.fillStyle = '#2f6fb0';
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rand() * 32);
      const y = Math.floor(rand() * 32);
      const w = 2 + Math.floor(rand() * 5);
      ctx.fillStyle = rand() > 0.5 ? '#5a9be0' : '#24578f';
      ctx.fillRect(x, y, w, 1);
    }
  }, 3);
}

/** Small text sprite for in-world labels (jump-height markers etc). */
export function labelSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,18,40,0.75)';
  ctx.fillRect(0, 4, 64, 24);
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 17);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true }));
  sprite.scale.set(2.4, 1.2, 1);
  return sprite;
}
