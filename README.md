# Bimble's Bounce

A late-90s-style low-poly 3D collect-a-thon platformer that runs in the browser and targets iPhone Safari. Built with Vite, TypeScript, three.js and Rapier.

**Status: Phase 1.** One grey-box test level for tuning how the game feels.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (also served on your LAN IP)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

To test on an iPhone, run `npm run dev` and open the printed `Network:` URL on a phone that is on the same Wi-Fi. The service worker only registers in production builds.

## Controls

| Action | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Move | Left thumb (floating stick) | WASD / arrows | Left stick |
| Camera | Drag on the right side | Q / E, mouse drag | Right stick |
| Jump / double jump | JUMP (hold for a higher jump) | Space | A / Cross |
| Tail spin | SPIN | J / K / Shift | X, B / Square, Circle |
| Pause | Pause button (top right) | Esc / P | Start |

Mechanics: variable jump height, a double jump, a 0.12 s coyote time and a 0.14 s jump buffer. Spinning in the air gives one small hop each time you are airborne, which helps you recover from a bad jump. Landing on an enemy's head defeats it and gives you back your double jump. Water and pits cost one heart and send you back to the last checkpoint. Touching a checkpoint refills your hearts. There is no game over.

## Tuning feel

All feel constants are in **`src/config.ts`**. The ones to start with are:

- `player.runSpeed`, `groundAccel`, `airAccel`: speed and how responsive steering is
- `player.jumpHeight`, `doubleJumpHeight`, `gravity`, `fallGravityMultiplier`, `jumpCutMultiplier`
- `player.coyoteTime`, `jumpBufferTime`, `spinAirHop`
- `camera.distance`, `followLag`, `verticalLagAir`, `autoRotateSpeed`, `autoRotateDelay`, `touchSensitivity`
- `render.targetHeight` (internal resolution, default 240p), `fogNear`, `fogFar`

The dev server hot-reloads when you save. The test level has 1 m to 4 m labelled steps for checking jump heights.

The pause menu lets you switch texture wobble, vertex snap, dither, automatic resolution, invert Y, sound and an FPS readout. These settings are saved in `localStorage`.

## Swapping in a real character model

The player only talks to its visuals through the `CharacterModel` interface in `src/player/CharacterModel.ts`. To use a glTF model:

1. Put `bimble.glb` in `public/models/`. Its origin should be at the feet, it should face +Z, and its clips should be named `Idle`, `Run`, `Jump`, `Fall`, `Spin` and `Hurt` (any of them may be missing).
2. Set `TUNING.character.modelUrl = 'models/bimble.glb'` and adjust `modelScale` and `modelYOffset` if needed.

The primitive mascot shows first and is swapped out once the model loads. The PS1 shader is applied to the model's materials automatically (`applyPS1ToObject`).

## Deploy to GitHub Pages

1. Push to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. `.github/workflows/deploy.yml` builds the game and publishes `dist/`. The build uses relative paths, so it works under `https://<user>.github.io/<repo>/`.

## Add to the iPhone home screen

1. Open the deployed URL in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Start it from the new icon. It runs fullscreen with no browser UI, and it works offline after the first load.

iOS Safari has no fullscreen or orientation-lock API for web pages, so the home-screen app is the only way to get fullscreen. If you hold the phone in portrait, a "rotate your device" screen appears and the game pauses.

## Project layout

```
src/
  config.ts          all tuning constants
  Game.ts            fixed-timestep loop, interactions, respawn
  player/            controller, CharacterModel interface, primitive mascot, glTF loader
  camera/            orbit/follow camera with sphere-cast collision
  input/             keyboard+mouse, Gamepad API, touch controls, merger
  world/             Rapier wrapper, level builder, test level, water, textures
  entities/          gems, rescue cages, enemy, checkpoints, particles
  render/            PS1 material patch, low-res render target + upscale, adaptive resolution
  ui/                HUD, pause menu, orientation guard, iOS guards, stats
  audio/             procedural WebAudio sound effects
```

## PS1 rendering

- The scene is drawn into a render target 240 px tall (its width follows the screen's aspect ratio). It is then upscaled with nearest-neighbour filtering, a 4x4 ordered dither and 15-bit colour quantisation.
- Vertices are snapped to the low-res pixel grid in the vertex shader. Affine texture mapping comes from the w-premultiply trick. Both switch on and off through shared uniforms.
- Distance fog, no mipmap blending, and low-poly meshes with flat shading.
- Adaptive resolution measures frame time once per second. If frames take more than 115% of the 16.7 ms budget, it steps down the internal height and output DPR (240, 204, 173, 144). It steps back up after several good seconds, and waits longer each time an upgrade fails, so it doesn't keep switching back and forth.
