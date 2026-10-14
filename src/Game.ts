import * as THREE from 'three';
import { Sfx } from './audio/Sfx';
import { CameraRig } from './camera/CameraRig';
import { TUNING } from './config';
import { Checkpoint } from './entities/Checkpoint';
import { Enemy } from './entities/Enemy';
import { Gems } from './entities/Gems';
import { Particles } from './entities/Particles';
import { RescueCage } from './entities/RescueCage';
import { InputManager } from './input/InputManager';
import { emptyFrame, type InputFrame } from './input/InputState';
import { Player, type PlayerEvent } from './player/Player';
import { ps1Basic, ps1Uniforms } from './render/ps1Material';
import { PS1Renderer } from './render/PS1Renderer';
import { Hud } from './ui/Hud';
import { OrientationGuard } from './ui/OrientationGuard';
import { PauseMenu, type Toggle } from './ui/PauseMenu';
import { Stats } from './ui/Stats';
import type { Physics } from './world/Physics';
import { buildTestLevel, type LevelData } from './world/TestLevel';
import { Water } from './world/Water';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;
const SETTINGS_KEY = 'bimble.settings.v1';

type RespawnReason = 'splash' | 'fall' | 'dead';

export class Game {
  private renderer: PS1Renderer;
  private scene = new THREE.Scene();
  private rig: CameraRig;
  private input: InputManager;
  private sfx = new Sfx();
  private hud: Hud;
  private menu: PauseMenu;
  private stats: Stats;
  private orientation: OrientationGuard;

  private level: LevelData;
  private player: Player;
  private water: Water;
  private gems: Gems;
  private cages: RescueCage[];
  private enemies: Enemy[];
  private checkpoints: Checkpoint[];
  private particles = new Particles();
  private shadow: THREE.Mesh;
  private sky: THREE.Mesh;

  private currentCheckpoint: Checkpoint;
  private rescued = 0;
  private gemCount = 0;
  private paused = false;
  private respawn: { t: number; reason: RespawnReason; teleported: boolean } | null = null;
  private acc = 0;
  private lastTime = -1;
  private idleInput = emptyFrame();

  constructor(private physics: Physics, canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.renderer = new PS1Renderer(canvas);
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.input = new InputManager(canvas, ui);
    this.hud = new Hud(ui);
    this.stats = new Stats(ui);

    // --- Scene / look ---
    const r = TUNING.render;
    this.scene.background = new THREE.Color(r.fogColor);
    this.scene.fog = new THREE.Fog(r.fogColor, r.fogNear, r.fogFar);
    this.scene.add(new THREE.HemisphereLight(0xd8deff, 0x5a4a6a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(sun);
    this.sky = makeSky(r.fogColor);
    this.scene.add(this.sky);

    // --- Level & entities ---
    this.level = buildTestLevel(physics);
    this.scene.add(this.level.staticMesh, ...this.level.decor);
    this.water = new Water(this.level.water);
    this.scene.add(this.water.group);
    this.gems = new Gems(this.level.gems);
    this.scene.add(this.gems.mesh);
    this.cages = this.level.rescues.map((p) => new RescueCage(p));
    this.enemies = this.level.enemies.map((e) => new Enemy(e.a, e.b));
    this.checkpoints = this.level.checkpoints.map((c) => new Checkpoint(c.pos, c.facing));
    for (const o of [...this.cages, ...this.enemies, ...this.checkpoints]) this.scene.add(o.group);
    this.scene.add(this.particles.mesh);

    this.currentCheckpoint = this.checkpoints[0];
    this.currentCheckpoint.activate();

    // --- Player ---
    const footOffset = TUNING.player.capsuleHalfHeight + TUNING.player.capsuleRadius;
    this.player = new Player(physics, this.currentCheckpoint.spawnPoint(footOffset));
    this.player.facing = this.currentCheckpoint.facing;
    this.player.onEvent = (e) => this.onPlayerEvent(e);
    this.scene.add(this.player.model.root);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 10).rotateX(-Math.PI / 2),
      ps1Basic({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    this.scene.add(this.shadow);
    this.physics.step(FIXED_DT); // register colliders with the query pipeline
    this.rig.snapBehind(this.player);

    // --- UI ---
    this.menu = new PauseMenu(ui, this.buildToggles());
    this.menu.onResume = () => this.setPaused(false);
    this.menu.onRestart = () => {
      this.restartLevel();
      this.setPaused(false);
    };
    this.hud.pauseButton.addEventListener('click', () => this.setPaused(!this.paused));
    this.orientation = new OrientationGuard(ui);
    this.hud.setGems(0, this.gems.total);
    this.hud.setRescues(0, this.cages.length);
    this.hud.setHealth(this.player.health);

    window.addEventListener('resize', () => this.onResize());
    window.visualViewport?.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.setPaused(true);
      this.lastTime = -1;
    });
  }

  start(): void {
    this.renderer.renderer.setAnimationLoop((t) => this.frame(t));
    this.hud.showToast('Find 5 Sproutlings!', 3);
  }

  private onResize(): void {
    this.renderer.resize();
    this.rig.setAspect(window.innerWidth / window.innerHeight);
  }

  private setPaused(p: boolean): void {
    this.paused = p;
    this.menu.setOpen(p);
    this.input.clear();
    this.lastTime = -1;
  }

  private buildToggles(): Toggle[] {
    const saved = loadSettings();
    const toggles: (Toggle & { key: string })[] = [
      {
        key: 'affine', label: 'Texture wobble',
        get: () => ps1Uniforms.uAffine.value > 0.5,
        set: (v) => { ps1Uniforms.uAffine.value = v ? 1 : 0; },
      },
      {
        key: 'snap', label: 'Vertex snap',
        get: () => ps1Uniforms.uSnap.value > 0.5,
        set: (v) => { ps1Uniforms.uSnap.value = v ? 1 : 0; },
      },
      {
        key: 'dither', label: 'Dither',
        get: () => TUNING.render.dither,
        set: (v) => { TUNING.render.dither = v; this.renderer.setDither(v); },
      },
      {
        key: 'adaptive', label: 'Auto resolution',
        get: () => TUNING.render.adaptive,
        set: (v) => { TUNING.render.adaptive = v; },
      },
      {
        key: 'invertY', label: 'Invert camera Y',
        get: () => TUNING.camera.invertY,
        set: (v) => { TUNING.camera.invertY = v; },
      },
      {
        key: 'sound', label: 'Sound',
        get: () => !this.sfx.muted,
        set: (v) => { this.sfx.muted = !v; },
      },
      {
        key: 'stats', label: 'Show FPS',
        get: () => this.stats.visible,
        set: (v) => this.stats.setVisible(v),
      },
    ];
    ps1Uniforms.uAffine.value = TUNING.render.affineTextures ? 1 : 0;
    ps1Uniforms.uSnap.value = TUNING.render.vertexSnap ? 1 : 0;
    for (const t of toggles) if (t.key in saved) t.set(saved[t.key]);
    return toggles.map((t) => ({
      label: t.label,
      get: t.get,
      set: (v: boolean) => {
        t.set(v);
        saveSettings(Object.fromEntries(toggles.map((x) => [x.key, x.get()])));
      },
    }));
  }

  // ---------------------------------------------------------------- loop

  private frame(now: number): void {
    const dt = this.lastTime < 0 ? FIXED_DT : Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const input = this.input.poll(dt);
    if (input.pausePressed) {
      this.input.consumePause();
      this.setPaused(!this.paused);
    }
    if (this.orientation.blocked) return;

    this.stats.update(dt, () => this.renderer.qualityLabel);
    if (!this.paused) {
      this.renderer.trackFrame(dt);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < MAX_STEPS) {
        this.fixedStep(FIXED_DT, input);
        this.input.consumePresses();
        this.acc -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
      this.updateVisuals(dt, this.acc / FIXED_DT, input);
    }
    this.renderer.render(this.scene, this.rig.camera);
  }

  private fixedStep(dt: number, input: InputFrame): void {
    const p = this.player;
    const controlInput = this.respawn ? this.idleInput : input;
    p.fixedUpdate(dt, controlInput, this.rig.yaw);
    this.physics.step(dt);

    const feetY = p.position.y - p.footOffset;
    for (const e of this.enemies) e.update(dt, p.position, feetY);

    if (this.respawn) {
      this.tickRespawn(dt);
      return;
    }

    // Gems
    for (const i of this.gems.collect(p.position, 1.0)) {
      this.gemCount++;
      this.hud.setGems(this.gemCount, this.gems.total);
      this.sfx.gem();
      this.particles.burst(this.gems.positionOf(i), this.gems.colorOf(i), 8, 3.5, { gravity: 6, size: 0.1 });
      if (this.gemCount === this.gems.total) this.hud.showToast('All gems found!', 2.5);
    }

    // Rescues
    for (const c of this.cages) {
      if (c.rescued) continue;
      const dx = c.position.x - p.position.x;
      const dz = c.position.z - p.position.z;
      const reach = p.isSpinning ? TUNING.player.spinRadius : 1.15;
      if (dx * dx + dz * dz < reach * reach && feetY > c.position.y - 1.2 && feetY < c.position.y + 1.8) {
        c.free();
        this.rescued++;
        this.hud.setRescues(this.rescued, this.cages.length);
        this.particles.burst(c.center, 0xb6e35a, 18, 5, { size: 0.16 });
        if (this.rescued === this.cages.length) {
          this.sfx.complete();
          this.hud.showToast('All Sproutlings rescued! Test level clear!', 4);
        } else {
          this.sfx.rescue();
          this.hud.showToast(`Sproutling rescued! ${this.rescued}/${this.cages.length}`, 2);
        }
      }
    }

    // Checkpoints
    for (const cp of this.checkpoints) {
      const dx = cp.position.x - p.position.x;
      const dz = cp.position.z - p.position.z;
      if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(feetY - cp.position.y) < 2 && cp !== this.currentCheckpoint) {
        cp.activate();
        this.currentCheckpoint = cp;
        this.sfx.checkpoint();
        this.hud.showToast('Checkpoint!', 1.5);
        p.restoreHealth();
        this.hud.setHealth(p.health);
      }
    }

    // Enemies
    const pr = TUNING.player.capsuleRadius;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.position.x - p.position.x;
      const dz = e.position.z - p.position.z;
      const h = Math.hypot(dx, dz);
      const headY = p.position.y + p.footOffset;
      const verticalOverlap = feetY < e.position.y + e.height && headY > e.position.y;
      if (p.isSpinning && h < TUNING.player.spinRadius && Math.abs(feetY - e.position.y) < 1.5) {
        this.defeatEnemy(e);
      } else if (h < e.radius + pr && verticalOverlap) {
        if (p.velocity.y < -0.5 && feetY > e.position.y + e.height * 0.4) {
          this.defeatEnemy(e);
          p.stompBounce();
          this.sfx.stomp();
        } else if (!p.isInvulnerable) {
          p.hurt(e.position);
        }
      }
    }

    // Hazards
    if (this.water.isSubmerged(p.position.x, feetY, p.position.z)) this.beginRespawn('splash');
    else if (feetY < this.level.killY) this.beginRespawn('fall');
  }

  private defeatEnemy(e: Enemy): void {
    e.defeat(this.player.position);
    this.sfx.enemyPop();
    this.particles.burst(e.position.clone().setY(e.position.y + 0.6), 0xc8643a, 14, 5);
  }

  private beginRespawn(reason: RespawnReason): void {
    if (this.respawn) return;
    this.respawn = { t: 0, reason, teleported: false };
    if (reason === 'splash') {
      this.sfx.splash();
      const at = this.player.position.clone();
      at.y = this.level.water[0]?.surfaceY ?? at.y;
      this.particles.burst(at, 0x8fc7ff, 20, 6, { up: 1.5 });
    } else if (reason === 'fall') {
      this.sfx.fall();
    }
    if (reason !== 'dead') this.player.damageNoKnockback();
  }

  private tickRespawn(dt: number): void {
    const r = this.respawn!;
    r.t += dt;
    const FADE = 0.4;
    if (!r.teleported && r.t >= FADE + 0.1) {
      const p = this.player;
      if (p.health <= 0) p.restoreHealth();
      p.teleport(this.currentCheckpoint.spawnPoint(p.footOffset), this.currentCheckpoint.facing);
      this.hud.setHealth(p.health);
      this.rig.snapBehind(p);
      r.teleported = true;
    }
    if (r.t >= FADE * 2 + 0.1) this.respawn = null;
  }

  private onPlayerEvent(e: PlayerEvent): void {
    switch (e.type) {
      case 'jump':
        if (e.kind === 1) this.sfx.jump();
        else {
          this.sfx.doubleJump();
          this.particles.burst(this.player.position.clone().setY(this.player.position.y - 0.6), 0xffffff, 6, 2, { gravity: 2, size: 0.12 });
        }
        break;
      case 'land':
        this.sfx.land(e.impact);
        if (e.impact > 0.4) this.particles.burst(this.player.position.clone().setY(this.player.position.y - 0.65), 0xd8d0c0, 6, 2.5, { gravity: 4, up: 0.2, size: 0.1 });
        break;
      case 'spin':
        this.sfx.spin();
        break;
      case 'hurt':
        this.sfx.hurt();
        this.hud.setHealth(e.health);
        break;
      case 'dead':
        this.hud.showToast('Ouch! Back to the checkpoint', 1.5);
        this.beginRespawn('dead');
        break;
    }
  }

  private updateVisuals(dt: number, alpha: number, input: InputFrame): void {
    this.player.render(dt, alpha);
    this.rig.update(dt, this.respawn ? this.idleInput : input, this.player, this.physics);
    this.sky.position.copy(this.rig.camera.position);

    // Blob shadow
    const rp = this.player.renderPosition;
    const ground = this.physics.groundBelow(rp, 40, this.player.collider);
    if (ground !== null) {
      const height = rp.y - this.player.footOffset - ground;
      this.shadow.visible = true;
      this.shadow.position.set(rp.x, ground + 0.03, rp.z);
      this.shadow.scale.setScalar(THREE.MathUtils.clamp(1 - height * 0.08, 0.35, 1));
    } else {
      this.shadow.visible = false;
    }

    this.gems.update(dt);
    for (const c of this.cages) c.update(dt);
    for (const c of this.checkpoints) c.update(dt);
    this.water.update(dt);
    this.particles.update(dt);
    this.sfx.tick(dt);
    this.hud.update(dt);

    if (this.respawn) {
      const t = this.respawn.t;
      const FADE = 0.4;
      this.hud.setFade(t < FADE ? t / FADE : Math.max(0, 1 - (t - FADE - 0.1) / FADE));
    } else {
      this.hud.setFade(0);
    }
  }

  private restartLevel(): void {
    this.gems.reset();
    for (const c of this.cages) c.reset();
    for (const e of this.enemies) e.reset();
    for (const c of this.checkpoints) c.deactivate();
    this.currentCheckpoint = this.checkpoints[0];
    this.currentCheckpoint.activate();
    this.gemCount = 0;
    this.rescued = 0;
    this.respawn = null;
    this.player.restoreHealth();
    this.player.teleport(this.currentCheckpoint.spawnPoint(this.player.footOffset), this.currentCheckpoint.facing);
    this.rig.snapBehind(this.player);
    this.hud.setGems(0, this.gems.total);
    this.hud.setRescues(0, this.cages.length);
    this.hud.setHealth(this.player.health);
    this.hud.setFade(0);
  }
}

function makeSky(horizon: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(150, 12, 8);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x2c2a6e);
  const mid = new THREE.Color(horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 150, 0, 1);
    c.copy(mid).lerp(top, Math.pow(t, 0.7));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

function loadSettings(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveSettings(s: Record<string, boolean>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. */
  }
}
