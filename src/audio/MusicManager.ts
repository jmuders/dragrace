/**
 * MusicManager — procedural arcade music via Web Audio API.
 *
 * Style: retro 80s driving synth (OutRun / Lotus Esprit Turbo Challenge).
 * No audio files needed — everything is synthesised in real time.
 *
 * Usage (singleton):
 *   MusicManager.get().start();          // begin playback (safe before user gesture — resumes after first interaction)
 *   MusicManager.get().setVolume(0.2);   // fade to race-background level
 *   MusicManager.get().setVolume(0.55);  // fade back to menu level
 */

// ─── Note frequencies (Hz) ───────────────────────────────────────────────────

const N = {
  C2:  65.41, D2:  73.42, E2:  82.41, F2:  87.31, G2:  98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
} as const;

// ─── Song data ────────────────────────────────────────────────────────────────
//
// Tempo: 148 BPM  |  Grid: 8th notes  |  Pattern: 32 steps (4 bars)
// Chord progression: Am  |  F  |  C  |  Em
//
// Pattern layout  (bar × 8 steps, beats on 0/2/4/6):
//   step  0  1  2  3  4  5  6  7   = bar beat positions
//         1  .  2  .  3  .  4  .
//
const R = 0; // rest

/** Bass line — sawtooth, root-fifth arpeggios */
const BASS_PAT: number[] = [
  // Bar 1  Am
  N.A2, R, N.E3, R, N.A2, R, N.C3, R,
  // Bar 2  F
  N.F2, R, N.C3, R, N.F2, R, N.A2, R,
  // Bar 3  C
  N.C3, R, N.G3, R, N.C3, R, N.E3, R,
  // Bar 4  Em
  N.E2, R, N.B2, R, N.E2, R, N.G2, R,
];

/** Lead melody — bright square-wave synth, quarter-note hits */
const LEAD_PAT: number[] = [
  // Bar 1  Am  — soaring ascent
  N.A4, R, N.C5, R, N.E5, R, N.G5, R,
  // Bar 2  F   — descend through the chord
  N.F5, R, N.E5, R, N.D5, R, N.C5, R,
  // Bar 3  C   — climb to the peak
  N.C5, R, N.E5, R, N.G5, R, N.A5, R,
  // Bar 4  Em  — graceful resolve
  N.E5, R, N.D5, R, N.B4, R, N.A4, R,
];

/** Pad chords — one per bar, triangle wave, gentle attack */
const PAD_CHORDS: number[][] = [
  [N.A3, N.C4, N.E4],  // Am
  [N.F3, N.A3, N.C4],  // F
  [N.C4, N.E4, N.G4],  // C
  [N.E3, N.G3, N.B3],  // Em
];

/** Kick — hit on beats 1 & 3 of every bar */
const KICK_PAT: number[] = [
  1,0,0,0, 1,0,0,0,
  1,0,0,0, 1,0,0,0,
  1,0,0,0, 1,0,0,0,
  1,0,0,0, 1,0,0,0,
];

/** Snare — hit on beats 2 & 4 of every bar */
const SNARE_PAT: number[] = [
  0,0,1,0, 0,0,1,0,
  0,0,1,0, 0,0,1,0,
  0,0,1,0, 0,0,1,0,
  0,0,1,0, 0,0,1,0,
];

/** Closed hi-hat every 8th note; open on the "and of 4" (step 7 of each bar) */
const HAT_PAT: number[] = [
  1,1,1,1, 1,1,1,2,
  1,1,1,1, 1,1,1,2,
  1,1,1,1, 1,1,1,2,
  1,1,1,1, 1,1,1,2,
]; // 1=closed, 2=open

// ─── Timing ───────────────────────────────────────────────────────────────────

const BPM          = 148;
const STEP_DUR     = 60 / BPM / 2;   // 8th-note duration in seconds ≈ 0.2027 s
const LOOK_AHEAD   = 0.15;           // seconds we schedule ahead of the audio clock
const SCHEDULER_MS = 25;             // how often (ms) we call the scheduler

// ─── MusicManager ─────────────────────────────────────────────────────────────

export class MusicManager {
  // ── singleton ────────────────────────────────────────────────────────────
  private static _inst: MusicManager | null = null;
  static get(): MusicManager {
    if (!MusicManager._inst) MusicManager._inst = new MusicManager();
    return MusicManager._inst;
  }
  private constructor() {}

  // ── state ────────────────────────────────────────────────────────────────
  private ctx:      AudioContext | null = null;
  private master:   GainNode     | null = null;
  private playing   = false;
  private step      = 0;
  private nextTime  = 0;
  private timerId:  ReturnType<typeof setInterval> | null = null;

  // ── public API ───────────────────────────────────────────────────────────

  /**
   * Start music.  Safe to call before a user gesture; the AudioContext will
   * be created in a suspended state and automatically resumed on the next
   * native touch/click event via the DOM unlock listener.
   */
  start(volume = 0.55): void {
    if (this.playing) {
      this.setVolume(volume);
      return;
    }

    if (!this.ctx) {
      // webkitAudioContext fallback for older iOS Safari
      const AC = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx    = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      // Install native DOM listeners — Phaser fires events in its game loop
      // (not synchronously in the touch handler), so iOS ignores ctx.resume()
      // called from Phaser events.  Native capture-phase listeners fire first.
      this._installNativeUnlock();
    }

    this.master!.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.3);

    this.playing  = true;
    this.step     = 0;
    this.nextTime = this.ctx.currentTime + 0.05;

    if (this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {/* ignore */});
    }

    this.timerId = setInterval(() => this._schedule(), SCHEDULER_MS);
  }

  /**
   * Call from any pointer / keyboard handler so the AudioContext is allowed
   * to play by the browser autoplay policy.  On iOS the native DOM listeners
   * registered by `_installNativeUnlock` fire first (capture phase), so this
   * method is primarily a safety net for other browsers / environments.
   */
  handleUserGesture(): void {
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {/* ignore */});
    }
  }

  /**
   * Install native capture-phase DOM listeners that unlock the AudioContext
   * as early as possible — before Phaser processes the same event in its
   * update loop.  Also handles PWA background/foreground transitions where
   * iOS suspends or 'interrupts' the context.
   */
  private _installNativeUnlock(): void {
    const resume = () => {
      if (this.ctx && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {/* ignore */});
      }
    };

    // capture: true → fires before Phaser's bubbling handlers
    // passive: true → no scroll jank
    document.addEventListener('touchstart', resume, { capture: true, passive: true });
    document.addEventListener('touchend',   resume, { capture: true, passive: true });
    document.addEventListener('click',      resume, { capture: true, passive: true });

    // PWA: iOS suspends the AudioContext when the app is sent to the background.
    // Resume it when the user brings the app back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {/* ignore */});
      }
    });

    // iOS-specific: AudioContext can enter 'interrupted' state (e.g. phone call).
    // Resume as soon as the interruption ends.
    this.ctx!.addEventListener('statechange', () => {
      if (this.ctx && (this.ctx.state as string) === 'interrupted') {
        // Will be released once the interruption ends; nothing to do here.
      } else if (this.ctx && this.ctx.state === 'suspended' && this.playing) {
        this.ctx.resume().catch(() => {/* ignore */});
      }
    });
  }

  /**
   * Smooth volume change.  Use fadeSec ≈ 1–2 for musical transitions.
   * @param target   0–1 linear gain
   * @param fadeSec  approximate fade duration in seconds
   */
  setVolume(target: number, fadeSec = 1.2): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    // setTargetAtTime uses a time constant; ÷3 gives a good perceptual fade
    this.master.gain.setTargetAtTime(target, t, fadeSec / 3);
  }

  /** Fade out and stop the sequencer. */
  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timerId !== null) { clearInterval(this.timerId); this.timerId = null; }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    }
  }

  // ── scheduler ────────────────────────────────────────────────────────────

  private _schedule(): void {
    if (!this.ctx || !this.playing) return;
    const limit = this.ctx.currentTime + LOOK_AHEAD;
    while (this.nextTime < limit) {
      this._playStep(this.nextTime, this.step);
      this.step     = (this.step + 1) % BASS_PAT.length;
      this.nextTime += STEP_DUR;
    }
  }

  private _playStep(t: number, step: number): void {
    // ── Bass ──────────────────────────────────────────────────────────────
    if (BASS_PAT[step] > 0) this._bass(BASS_PAT[step], t, STEP_DUR * 0.85);

    // ── Lead ──────────────────────────────────────────────────────────────
    if (LEAD_PAT[step] > 0) this._lead(LEAD_PAT[step], t, STEP_DUR * 1.7);

    // ── Pad (on bar downbeat) ─────────────────────────────────────────────
    if (step % 8 === 0) {
      const barIdx = Math.floor(step / 8) % PAD_CHORDS.length;
      PAD_CHORDS[barIdx].forEach(freq => this._pad(freq, t, STEP_DUR * 8 * 0.92));
    }

    // ── Drums ─────────────────────────────────────────────────────────────
    if (KICK_PAT[step])         this._kick(t);
    if (SNARE_PAT[step])        this._snare(t);
    if (HAT_PAT[step])          this._hat(t, HAT_PAT[step] === 2);
  }

  // ── Instruments ──────────────────────────────────────────────────────────

  /** Driving synth bass — sawtooth + lowpass filter */
  private _bass(freq: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, t);
    filt.Q.value = 2.5;

    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.38, t + 0.012);
    env.gain.setTargetAtTime(0.22, t + 0.02, 0.06);
    env.gain.setTargetAtTime(0,    t + dur - 0.01, 0.025);

    osc.connect(filt); filt.connect(env); env.connect(this.master!);
    osc.start(t); osc.stop(t + dur + 0.08);
  }

  /**
   * Classic 80s lead synth — detuned pair of square-wave oscillators
   * for the characteristic "wide" chorus effect.
   */
  private _lead(freq: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    for (const detune of [-9, 9]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime(detune, t);

      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.17, t + 0.018);
      env.gain.setTargetAtTime(0.11, t + 0.05, 0.08);
      env.gain.setTargetAtTime(0,    t + dur - 0.02, 0.04);

      osc.connect(env); env.connect(this.master!);
      osc.start(t); osc.stop(t + dur + 0.08);
    }
  }

  /** Warm background pad — triangle wave, slow attack */
  private _pad(freq: number, t: number, dur: number): void {
    const ctx  = this.ctx!;
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2200, t);

    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.055, t + 0.25);
    env.gain.setTargetAtTime(0.04, t + 0.4, 0.15);
    env.gain.setTargetAtTime(0,    t + dur - 0.08, 0.12);

    osc.connect(filt); filt.connect(env); env.connect(this.master!);
    osc.start(t); osc.stop(t + dur + 0.1);
  }

  /** 808-style kick — sine sweep from 150 → near-zero */
  private _kick(t: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.28);

    env.gain.setValueAtTime(0.85, t);
    env.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(env); env.connect(this.master!);
    osc.start(t); osc.stop(t + 0.32);
  }

  /** Snare — noise burst + short tonal thud */
  private _snare(t: number): void {
    const ctx = this.ctx!;

    // Tonal thud
    const tone = ctx.createOscillator();
    const tEnv = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(195, t);
    tone.frequency.exponentialRampToValueAtTime(80, t + 0.09);
    tEnv.gain.setValueAtTime(0.32, t);
    tEnv.gain.exponentialRampToValueAtTime(0.01, t + 0.11);
    tone.connect(tEnv); tEnv.connect(this.master!);
    tone.start(t); tone.stop(t + 0.13);

    // White noise transient
    const bufLen = Math.ceil(ctx.sampleRate * 0.18);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    const nFilt = ctx.createBiquadFilter();
    const nEnv  = ctx.createGain();
    noise.buffer = buf;
    nFilt.type = 'highpass'; nFilt.frequency.value = 1500;
    nEnv.gain.setValueAtTime(0.38, t);
    nEnv.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(this.master!);
    noise.start(t); noise.stop(t + 0.18);
  }

  /** Hi-hat — high-pass noise; open hat decays slower */
  private _hat(t: number, open: boolean): void {
    const ctx = this.ctx!;
    const dur = open ? 0.16 : 0.055;

    const bufLen = Math.ceil(ctx.sampleRate * (dur + 0.02));
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    const filt  = ctx.createBiquadFilter();
    const env   = ctx.createGain();
    noise.buffer = buf;
    filt.type = 'highpass'; filt.frequency.value = 9000;
    env.gain.setValueAtTime(open ? 0.11 : 0.07, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filt); filt.connect(env); env.connect(this.master!);
    noise.start(t); noise.stop(t + dur + 0.02);
  }
}
