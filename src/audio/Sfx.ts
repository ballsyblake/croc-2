/**
 * Tiny procedural sound effects (WebAudio). No audio files, so nothing to
 * license. iOS only lets audio start inside a user gesture, so `unlock()`
 * is wired to the first touch / key / click.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private gemStreak = 0;
  private gemStreakTimer = 0;
  muted = false;

  constructor() {
    const unlock = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        for (const ev of ['touchend', 'pointerdown', 'keydown', 'mousedown']) window.removeEventListener(ev, unlock, true);
      }
    };
    for (const ev of ['touchend', 'pointerdown', 'keydown', 'mousedown']) window.addEventListener(ev, unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Play a silent buffer: the documented way to fully unlock iOS audio.
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  tick(dt: number): void {
    this.gemStreakTimer -= dt;
    if (this.gemStreakTimer <= 0) this.gemStreak = 0;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.5, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, freq: number, vol = 0.5, q = 1): void {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  jump(): void { this.tone('square', 220, 520, 0.14, 0.18); }
  doubleJump(): void { this.tone('square', 330, 880, 0.16, 0.16); }
  land(impact: number): void { this.noiseBurst(0.08, 300, 0.25 * impact, 0.8); }
  spin(): void { this.noiseBurst(0.3, 2200, 0.35, 2); }
  stomp(): void { this.tone('triangle', 300, 90, 0.18, 0.5); }
  enemyPop(): void { this.tone('square', 600, 120, 0.22, 0.25); this.noiseBurst(0.15, 1200, 0.3); }
  hurt(): void { this.tone('sawtooth', 400, 110, 0.35, 0.3); }
  splash(): void { this.noiseBurst(0.5, 900, 0.6, 0.6); }
  fall(): void { this.tone('triangle', 700, 80, 0.7, 0.35); }
  checkpoint(): void {
    [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.3, i * 0.08));
  }
  gem(): void {
    const steps = [0, 2, 4, 5, 7, 9, 11, 12];
    const n = steps[Math.min(this.gemStreak, steps.length - 1)];
    const f = 880 * Math.pow(2, n / 12);
    this.tone('sine', f, f, 0.12, 0.3);
    this.tone('square', f * 2, f * 2, 0.06, 0.06);
    this.gemStreak++;
    this.gemStreakTimer = 0.8;
  }
  rescue(): void {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.22, 0.32, i * 0.09));
  }
  complete(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.25, 0.18, i * 0.13));
  }
}
