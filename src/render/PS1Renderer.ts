import * as THREE from 'three';
import { TUNING } from '../config';
import { ps1Uniforms } from './ps1Material';

const BLIT_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLIT_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uLowRes;
uniform float uDither;
uniform float uLevels;
varying vec2 vUv;

vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  // 4x4 Bayer matrix, normalised to [-0.5, 0.5).
  float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return m[i] / 16.0 - 0.5;
}

void main() {
  vec3 c = linearToSRGB(texture2D(tScene, vUv).rgb);
  if (uDither > 0.5) {
    vec2 px = floor(vUv * uLowRes);
    c += bayer4(px) / uLevels;
    c = floor(c * (uLevels - 1.0) + 0.5) / (uLevels - 1.0);
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

interface QualityLevel {
  height: number;
  dpr: number;
}

/**
 * Renders the scene into a small render target, then upscales it with
 * nearest-neighbour filtering (plus optional ordered dither + colour
 * quantisation) to the full canvas. Also owns adaptive resolution.
 */
export class PS1Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private blitScene = new THREE.Scene();
  private blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blitMat: THREE.ShaderMaterial;

  private levels: QualityLevel[];
  private levelIndex: number;
  private lowW = 320;
  private lowH = 240;

  // Adaptive resolution bookkeeping.
  private sampleTime = 0;
  private sampleFrames = 0;
  private goodSeconds = 0;
  private cooldown = 0;
  /** Each upgrade that had to be undone doubles the wait before the next attempt (stops oscillation). */
  private failedUpgrades = 0;
  private sinceUpgrade = Infinity;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.rt = new THREE.WebGLRenderTarget(this.lowW, this.lowH, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });

    this.blitMat = new THREE.ShaderMaterial({
      vertexShader: BLIT_VERT,
      fragmentShader: BLIT_FRAG,
      uniforms: {
        tScene: { value: this.rt.texture },
        uLowRes: { value: new THREE.Vector2(this.lowW, this.lowH) },
        uDither: { value: TUNING.render.dither ? 1 : 0 },
        uLevels: { value: TUNING.render.colorLevels },
      },
      depthTest: false,
      depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quad = new THREE.Mesh(tri, this.blitMat);
    quad.frustumCulled = false;
    this.blitScene.add(quad);

    // Quality ladder: only ever scale *down* from the configured target.
    const r = TUNING.render;
    const dpr = Math.min(window.devicePixelRatio || 1, r.maxOutputDpr);
    const heights = [r.targetHeight, Math.round(r.targetHeight * 0.85), Math.round(r.targetHeight * 0.72), r.minHeight]
      .filter((h, i, a) => h >= r.minHeight && a.indexOf(h) === i);
    this.levels = heights.map((h, i) => ({ height: h, dpr: i >= heights.length - 1 ? 1 : dpr }));
    this.levelIndex = 0;

    this.resize();
  }

  get lowResolution(): { width: number; height: number } {
    return { width: this.lowW, height: this.lowH };
  }

  get qualityLabel(): string {
    const l = this.levels[this.levelIndex];
    return `${this.lowW}x${this.lowH} @${l.dpr.toFixed(1)}x`;
  }

  setDither(on: boolean): void {
    this.blitMat.uniforms.uDither.value = on ? 1 : 0;
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const level = this.levels[this.levelIndex];
    this.renderer.setPixelRatio(level.dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.lowH = level.height;
    this.lowW = Math.max(1, Math.round(level.height * (w / h)));
    this.rt.setSize(this.lowW, this.lowH);
    this.blitMat.uniforms.uLowRes.value.set(this.lowW, this.lowH);
    ps1Uniforms.uSnapRes.value.set(this.lowW, this.lowH);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCam);
  }

  /** Feed real frame time (seconds). Steps resolution down when frames are slow, back up when they recover. */
  trackFrame(frameDt: number): void {
    if (!TUNING.render.adaptive || frameDt > 0.25) return;
    this.sampleTime += frameDt;
    this.sampleFrames++;
    this.cooldown = Math.max(0, this.cooldown - frameDt);
    this.sinceUpgrade += frameDt;
    if (this.sampleTime < 1) return;

    const avgMs = (this.sampleTime / this.sampleFrames) * 1000;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    const budget = 1000 / TUNING.render.targetFps;

    if (avgMs > budget * 1.15) {
      this.goodSeconds = 0;
      if (this.cooldown <= 0 && this.levelIndex < this.levels.length - 1) {
        this.levelIndex++;
        if (this.sinceUpgrade < 8) this.failedUpgrades = Math.min(this.failedUpgrades + 1, 4);
        this.cooldown = 2;
        this.resize();
      }
    } else if (avgMs < budget * 1.05) {
      this.goodSeconds++;
      const needed = 5 * 2 ** this.failedUpgrades;
      if (this.goodSeconds >= needed && this.cooldown <= 0 && this.levelIndex > 0) {
        this.levelIndex--;
        this.sinceUpgrade = 0;
        this.goodSeconds = 0;
        this.cooldown = 4;
        this.resize();
      }
    }
  }
}
