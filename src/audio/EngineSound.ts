/**
 * Procedural engine sound synthesizer using the Web Audio API.
 *
 * Each engine type produces a distinct character:
 *  - Firing frequency based on cylinder count and RPM
 *  - Low-pass filter that opens up as RPM rises (dark at idle → bright at redline)
 *  - Amplitude-modulated main oscillator for the cylinder "chug/pulse" feel
 *  - Sub-bass oscillator (½ fundamental) for deep rumble
 *  - Upper harmonic oscillator (2× fundamental) for screaming presence
 *  - Optional turbo/electric whistle that builds with RPM (F40, McLaren, W16, hybrid)
 *
 * Audio graph per instance:
 *
 *   mainOsc ──────────────────→ mainGain ──→ filter ──→ masterGain ──→ destination
 *   subOsc  ──→ subGainNode  ──→    ↑
 *   harmOsc ──→ harmGainNode ──→    ↑
 *   lfo     ──→ lfoGain ──→ mainGain.gain (AudioParam modulation)
 *   turboOsc ──→ turboGainNode ──────────────────────→ masterGain
 */

export type EngineType =
  | 'rotary'
  | 'inline4'
  | 'inline6'
  | 'flat6'
  | 'v8'
  | 'v8_muscle'
  | 'v8_turbo'
  | 'v10'
  | 'v12'
  | 'w16'
  | 'hybrid';

/**
 * Maps CarType strings (from CarSprites) to their engine type.
 * Each car's real-world counterpart determines the sound character.
 */
export const CAR_ENGINE_TYPE: Record<string, EngineType> = {
  silver:         'inline6',    // BMW M3 — straight-six
  gray_roadster:  'flat6',      // Porsche Boxster — boxer flat-six
  orange_supra:   'inline6',    // Toyota Supra — 2JZ straight-six
  red_rx7:        'rotary',     // Mazda RX-7 — Wankel rotary
  yellow_lotus:   'inline4',    // Lotus Elise — featherweight 4-cyl
  red_roadster:   'v8',         // Italian roadster — V8
  red:            'v8',         // Mid-engine GT — V8
  red_hyper:      'hybrid',     // Ferrari hybrid — V6 hybrid system
  blue_gt40:      'v8',         // Ford GT40 — V8
  blue_porsche:   'flat6',      // Porsche GT — flat-six
  green:          'v10',        // Lamborghini Huracán — V10
  orange:         'v10',        // Track weapon — V10
  red_f40:        'v8_turbo',   // Ferrari F40 — twin-turbo V8
  lime_super:     'v12',        // Lamborghini Aventador — V12
  blue_cobra:     'v8_muscle',  // AC Cobra — big-block V8
  blue_viper:     'v10',        // Dodge Viper — V10
  yellow_muscle:  'v8_muscle',  // Mustang — V8 muscle
  black_hyper:    'w16',        // Bugatti Veyron/Chiron — W16 quad-turbo
  dark_hyper:     'v8_turbo',   // Koenigsegg — V8 twin-turbo
  orange_mclaren: 'v8_turbo',   // McLaren — twin-turbo V8
  white_proto:    'hybrid',     // Aero prototype — hybrid
};

interface EngineProfile {
  /** Power strokes per crankshaft revolution: determines pitch for a given RPM */
  firingPerRev: number;
  /** Primary oscillator waveform */
  waveform: OscillatorType;
  /** Master volume when running (0–1) */
  volume: number;
  /** Low-pass filter cutoff at idle RPM (Hz) */
  filterMin: number;
  /** Low-pass filter cutoff at max RPM (Hz) */
  filterMax: number;
  /** Filter resonance Q (higher = more coloured/nasal) */
  filterQ: number;
  /** Amplitude modulation depth (0 = no pulse, 1 = full cylinder chug) */
  pulseDepth: number;
  /** Sub-bass oscillator gain (0.5× frequency) */
  subBassGain: number;
  /** Upper harmonic oscillator gain (2× frequency) */
  harmGain: number;
  /** Add a turbo/electric whistle that scales with RPM */
  turboWhistle: boolean;
}

/**
 * Engine profiles ordered from low-cylinder rumble to high-cylinder scream.
 * Each value is tuned to feel distinct at both idle and redline.
 */
const PROFILES: Record<EngineType, EngineProfile> = {
  // ── Rotary (Wankel) ────────────────────────────────────────────────────────
  // Very smooth, almost turbine-like whine; minimal cylinder thump.
  // High harmonic content gives the distinctive rotary shriek.
  rotary: {
    firingPerRev: 3,
    waveform: 'sawtooth',
    volume: 0.38,
    filterMin: 900,
    filterMax: 6500,
    filterQ: 1.5,
    pulseDepth: 0.10,
    subBassGain: 0.12,
    harmGain: 0.60,
    turboWhistle: false,
  },

  // ── Inline-4 ───────────────────────────────────────────────────────────────
  // Punchy, mid-high pitch; pronounced cylinder thump at low RPM.
  inline4: {
    firingPerRev: 2,
    waveform: 'sawtooth',
    volume: 0.33,
    filterMin: 350,
    filterMax: 2900,
    filterQ: 1.2,
    pulseDepth: 0.48,
    subBassGain: 0.38,
    harmGain: 0.22,
    turboWhistle: false,
  },

  // ── Inline-6 ───────────────────────────────────────────────────────────────
  // Smooth, balanced, pleasant at all RPM. The "silk and steel" character.
  inline6: {
    firingPerRev: 3,
    waveform: 'sawtooth',
    volume: 0.38,
    filterMin: 560,
    filterMax: 3900,
    filterQ: 0.9,
    pulseDepth: 0.22,
    subBassGain: 0.42,
    harmGain: 0.20,
    turboWhistle: false,
  },

  // ── Flat-6 (Boxer) ─────────────────────────────────────────────────────────
  // Distinctive Porsche rumble. Higher resonance (Q) colours the mid-range.
  // Offset firing order gives more pulse than a straight-six.
  flat6: {
    firingPerRev: 3,
    waveform: 'sawtooth',
    volume: 0.38,
    filterMin: 480,
    filterMax: 3300,
    filterQ: 2.8,
    pulseDepth: 0.40,
    subBassGain: 0.52,
    harmGain: 0.18,
    turboWhistle: false,
  },

  // ── V8 (European / Italian) ────────────────────────────────────────────────
  // Warm, throaty. More refined than muscle but still powerful.
  v8: {
    firingPerRev: 4,
    waveform: 'sawtooth',
    volume: 0.46,
    filterMin: 300,
    filterMax: 2500,
    filterQ: 1.4,
    pulseDepth: 0.42,
    subBassGain: 0.58,
    harmGain: 0.16,
    turboWhistle: false,
  },

  // ── V8 Muscle (American) ───────────────────────────────────────────────────
  // Deep, guttural burble. Lowest filter cutoff = darkest, fattest sound.
  // High pulse depth = the iconic "potato potato" idle rhythm.
  v8_muscle: {
    firingPerRev: 4,
    waveform: 'sawtooth',
    volume: 0.52,
    filterMin: 190,
    filterMax: 1900,
    filterQ: 2.3,
    pulseDepth: 0.60,
    subBassGain: 0.72,
    harmGain: 0.09,
    turboWhistle: false,
  },

  // ── V8 Turbo ───────────────────────────────────────────────────────────────
  // Turbos flatten the exhaust note and add whistle. Smoother than N/A V8.
  v8_turbo: {
    firingPerRev: 4,
    waveform: 'sawtooth',
    volume: 0.44,
    filterMin: 430,
    filterMax: 3600,
    filterQ: 1.0,
    pulseDepth: 0.26,
    subBassGain: 0.40,
    harmGain: 0.24,
    turboWhistle: true,
  },

  // ── V10 ────────────────────────────────────────────────────────────────────
  // Aggressive screaming character. Higher harmonic gain = the banshee wail.
  v10: {
    firingPerRev: 5,
    waveform: 'sawtooth',
    volume: 0.48,
    filterMin: 410,
    filterMax: 4400,
    filterQ: 1.3,
    pulseDepth: 0.26,
    subBassGain: 0.32,
    harmGain: 0.40,
    turboWhistle: false,
  },

  // ── V12 ────────────────────────────────────────────────────────────────────
  // Silky smooth turbine-like scream at high RPM. Very low pulse depth = glass smooth.
  v12: {
    firingPerRev: 6,
    waveform: 'sawtooth',
    volume: 0.48,
    filterMin: 510,
    filterMax: 5500,
    filterQ: 0.7,
    pulseDepth: 0.13,
    subBassGain: 0.26,
    harmGain: 0.50,
    turboWhistle: false,
  },

  // ── W16 (Bugatti) ──────────────────────────────────────────────────────────
  // Dense, massive low-end. 16 cylinders fire incredibly close together.
  // Turbo whistle present due to quad-turbo setup.
  w16: {
    firingPerRev: 8,
    waveform: 'sawtooth',
    volume: 0.50,
    filterMin: 290,
    filterMax: 2900,
    filterQ: 1.1,
    pulseDepth: 0.17,
    subBassGain: 0.54,
    harmGain: 0.28,
    turboWhistle: true,
  },

  // ── Hybrid ─────────────────────────────────────────────────────────────────
  // V6 base character with electric motor whine overlaid. Higher, smoother.
  hybrid: {
    firingPerRev: 3,
    waveform: 'sawtooth',
    volume: 0.34,
    filterMin: 620,
    filterMax: 4800,
    filterQ: 0.8,
    pulseDepth: 0.15,
    subBassGain: 0.18,
    harmGain: 0.44,
    turboWhistle: true,
  },
};

// RPM reference points (matching constants.ts values)
const IDLE_RPM = 800;
const MAX_RPM  = 8500;

// ─── EngineSound ──────────────────────────────────────────────────────────────

/**
 * One synthesised engine voice. Create once per car; call `update()` every
 * frame with the current RPM. Call `start()` / `stop()` for fade in/out.
 * Call `destroy()` when the race ends to release Web Audio resources.
 */
export class EngineSound {
  private readonly ctx: AudioContext;
  private readonly profile: EngineProfile;

  private readonly masterGain: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly mainOsc: OscillatorNode;
  private readonly mainGain: GainNode;
  private readonly subOsc: OscillatorNode;
  private readonly subGainNode: GainNode;
  private readonly harmOsc: OscillatorNode;
  private readonly harmGainNode: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoGain: GainNode;
  private readonly turboOsc: OscillatorNode | null;
  private readonly turboGainNode: GainNode | null;

  private _running  = false;
  private _destroyed = false;

  /**
   * @param ctx   Shared AudioContext (pass the same one for all sounds).
   * @param type  Engine character to synthesise.
   * @param pan   Stereo pan: -1 = hard left, 0 = centre, +1 = hard right.
   * @param volScale  Extra volume multiplier (e.g. 0.5 for CPU car).
   */
  constructor(ctx: AudioContext, type: EngineType, pan = 0, volScale = 1) {
    this.ctx = ctx;
    const p = PROFILES[type];
    this.profile = { ...p, volume: p.volume * volScale };

    // ── Master gain ───────────────────────────────────────────────────────────
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0; // silent until start()

    // Optional stereo pan before destination
    if (pan !== 0 && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      this.masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      this.masterGain.connect(ctx.destination);
    }

    // ── Low-pass filter ───────────────────────────────────────────────────────
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = p.filterMin;
    this.filter.Q.value = p.filterQ;
    this.filter.connect(this.masterGain);

    // ── Main oscillator (primary harmonic content) ────────────────────────────
    this.mainOsc = ctx.createOscillator();
    this.mainOsc.type = p.waveform;
    this.mainGain = ctx.createGain();
    // Base gain = 1 − half of pulse depth so LFO swings around a good centre
    this.mainGain.gain.value = 1 - p.pulseDepth * 0.5;
    this.mainOsc.connect(this.mainGain);
    this.mainGain.connect(this.filter);

    // ── Sub-bass (½ frequency) — the physical thump ───────────────────────────
    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subGainNode = ctx.createGain();
    this.subGainNode.gain.value = p.subBassGain;
    this.subOsc.connect(this.subGainNode);
    this.subGainNode.connect(this.filter);

    // ── Upper harmonic (2× frequency) — the scream ────────────────────────────
    this.harmOsc = ctx.createOscillator();
    this.harmOsc.type = 'triangle';
    this.harmGainNode = ctx.createGain();
    this.harmGainNode.gain.value = p.harmGain;
    this.harmOsc.connect(this.harmGainNode);
    this.harmGainNode.connect(this.filter);

    // ── LFO at firing frequency → modulates mainGain.gain ─────────────────────
    // This creates the cylinder-firing pulse rhythm.
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = p.pulseDepth;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.mainGain.gain); // AudioParam modulation

    // ── Turbo / electric whistle ─────────────────────────────────────────────
    if (p.turboWhistle) {
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 1800;
      this.turboGainNode = ctx.createGain();
      this.turboGainNode.gain.value = 0;
      this.turboOsc.connect(this.turboGainNode);
      this.turboGainNode.connect(this.masterGain);
    } else {
      this.turboOsc = null;
      this.turboGainNode = null;
    }

    // Initialise all frequencies to idle before starting oscillators
    this._applyFrequencies(IDLE_RPM, 0);

    this.mainOsc.start();
    this.subOsc.start();
    this.harmOsc.start();
    this.lfo.start();
    this.turboOsc?.start();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Fade the engine in. Call once the AudioContext has been resumed. */
  start(): void {
    if (this._running || this._destroyed) return;
    this._running = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.profile.volume, now, 0.12);
  }

  /** Fade out. */
  stop(): void {
    if (!this._running || this._destroyed) return;
    this._running = false;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, 0.22);
  }

  /**
   * Update pitch, filter and volume each frame.
   * @param rpm         Current engine RPM.
   * @param nitroActive Whether nitrous is active (boosts volume + filter brightness).
   */
  update(rpm: number, nitroActive: boolean): void {
    if (this._destroyed) return;
    const now = this.ctx.currentTime;
    const p   = this.profile;
    const tc  = 0.025; // time constant — smooth but responsive

    this._applyFrequencies(rpm, tc);

    // Filter cutoff opens exponentially with RPM
    const rpmFrac   = Math.max(0, Math.min(1, (rpm - IDLE_RPM) / (MAX_RPM - IDLE_RPM)));
    const filterFreq = p.filterMin + (p.filterMax - p.filterMin) * Math.pow(rpmFrac, 0.55);
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.04);

    // Nitro gives a volume kick and brightens the filter further
    if (this._running) {
      const volTarget = p.volume * (nitroActive ? 1.18 : 1.0);
      this.masterGain.gain.setTargetAtTime(volTarget, now, 0.07);
    }

    // Turbo pitch + volume climb with RPM
    if (this.turboOsc && this.turboGainNode) {
      const turboFreq = 1400 + rpmFrac * 8000;
      const turboVol  = rpmFrac * (nitroActive ? 0.11 : 0.07);
      this.turboOsc.frequency.setTargetAtTime(turboFreq, now, 0.09);
      this.turboGainNode.gain.setTargetAtTime(turboVol, now, 0.09);
    }
  }

  /** Simulate a gear-change throttle cut: brief dip then recovery. */
  shiftCut(): void {
    if (this._destroyed) return;
    const now = this.ctx.currentTime;
    const p   = this.profile;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(p.volume * 0.20, now);
    this.masterGain.gain.setTargetAtTime(p.volume, now + 0.04, 0.05);
  }

  /** Release all Web Audio resources. Safe to call multiple times. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, now);
    try { this.mainOsc.stop(); } catch { /* already stopped */ }
    try { this.subOsc.stop();  } catch {}
    try { this.harmOsc.stop(); } catch {}
    try { this.lfo.stop();     } catch {}
    try { this.turboOsc?.stop(); } catch {}
    this.masterGain.disconnect();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _applyFrequencies(rpm: number, tc: number): void {
    const p    = this.profile;
    const freq = p.firingPerRev * Math.max(rpm, 50) / 60;

    if (tc === 0) {
      this.mainOsc.frequency.value = freq;
      this.subOsc.frequency.value  = freq * 0.5;
      this.harmOsc.frequency.value = freq * 2.0;
      this.lfo.frequency.value     = freq;
    } else {
      const now = this.ctx.currentTime;
      this.mainOsc.frequency.setTargetAtTime(freq,       now, tc);
      this.subOsc.frequency.setTargetAtTime(freq * 0.5,  now, tc);
      this.harmOsc.frequency.setTargetAtTime(freq * 2.0, now, tc);
      this.lfo.frequency.setTargetAtTime(freq,           now, tc);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate a plausible RPM for the CPU car from its speed alone.
 * Cycles through 4 gears over the speed range so the pitch rises and
 * drops rhythmically, mimicking real gear changes.
 */
export function estimateCpuRpm(speedMs: number): number {
  // Approximate top speed of the fastest AI cars: ~90 m/s (≈ 200 mph)
  const MAX_SPEED_MS = 90;
  const RPM_LOW  = 2500;   // RPM at the bottom of each gear
  const RPM_HIGH = 7800;   // RPM at the top of each gear
  const GEARS    = 4;

  const frac = Math.max(0, Math.min(1, speedMs / MAX_SPEED_MS));
  // Which gear are we in and where within it?
  const gearFrac = (frac * GEARS) % 1; // 0→1 within each gear
  return RPM_LOW + (RPM_HIGH - RPM_LOW) * Math.pow(gearFrac, 0.7);
}
