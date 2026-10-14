import * as THREE from 'three';

/**
 * Uniforms shared by every PS1-patched material, so one write updates all.
 */
export const ps1Uniforms = {
  uSnapRes: { value: new THREE.Vector2(320, 240) },
  uSnap: { value: 1 },
  uAffine: { value: 1 },
};

const VERT_PARS = /* glsl */ `
uniform vec2 uSnapRes;
uniform float uSnap;
#ifdef USE_MAP
varying vec3 vAffineUv;
#endif
`;

// Runs after <project_vertex>, which wrote gl_Position.
const VERT_MAIN = /* glsl */ `
if (uSnap > 0.5 && gl_Position.w > 0.0) {
  // Snap clip-space XY to the low-res pixel grid: the classic PS1 vertex jitter.
  vec2 grid = uSnapRes * 0.5;
  vec2 ndc = gl_Position.xy / gl_Position.w;
  ndc = floor(ndc * grid + 0.5) / grid;
  gl_Position.xy = ndc * gl_Position.w;
}
#ifdef USE_MAP
// Pre-multiplying by w and dividing per-fragment cancels perspective correction -> affine mapping.
vAffineUv = vec3(vMapUv * gl_Position.w, gl_Position.w);
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform float uAffine;
#ifdef USE_MAP
varying vec3 vAffineUv;
#endif
`;

const FRAG_MAP = /* glsl */ `
#ifdef USE_MAP
  vec2 ps1Uv = mix(vMapUv, vAffineUv.xy / vAffineUv.z, uAffine);
  vec4 sampledDiffuseColor = texture2D(map, ps1Uv);
  diffuseColor *= sampledDiffuseColor;
#endif
`;

/**
 * Patch any built-in three.js mesh material (Basic, Lambert, Phong, Standard...)
 * with vertex snapping and toggleable affine texture mapping. Safe to call on
 * materials from loaded glTF files.
 */
export function applyPS1<T extends THREE.Material>(material: T): T {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uSnapRes = ps1Uniforms.uSnapRes;
    shader.uniforms.uSnap = ps1Uniforms.uSnap;
    shader.uniforms.uAffine = ps1Uniforms.uAffine;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP);
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `ps1|${prevKey()}`;
  material.needsUpdate = true;
  return material;
}

/** Convenience: a PS1-patched Lambert material. */
export function ps1Lambert(params: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return applyPS1(new THREE.MeshLambertMaterial(params));
}

export function ps1Basic(params: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return applyPS1(new THREE.MeshBasicMaterial(params));
}

/** Patch every material under an object (e.g. a loaded glTF scene). */
export function applyPS1ToObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const tex = (m as THREE.MeshStandardMaterial).map;
      if (tex) {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestMipmapNearestFilter;
        tex.needsUpdate = true;
      }
      applyPS1(m);
    }
  });
}
