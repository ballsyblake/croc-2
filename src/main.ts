import './style.css';
import { Game } from './Game';
import { installIOSGuards } from './ui/ios';
import { Physics } from './world/Physics';

async function boot(): Promise<void> {
  installIOSGuards();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const bootEl = document.getElementById('boot')!;
  const msg = document.getElementById('boot-msg')!;

  try {
    const physics = await Physics.create();
    const game = new Game(physics, canvas, ui);
    game.start();
    bootEl.classList.add('hidden');
    setTimeout(() => bootEl.remove(), 500);
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  } catch (err) {
    console.error(err);
    msg.textContent = `Failed to start: ${(err as Error).message}`;
  }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  }
}

void boot();
