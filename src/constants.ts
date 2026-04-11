// ─── Track ────────────────────────────────────────────────────────────────────

export const QUARTER_MILE_METERS = 402.336;

// ─── Engine / gear model ──────────────────────────────────────────────────────

/** Idle RPM when engine is running */
export const IDLE_RPM = 1000;

/** Rev limiter – hard cap */
export const MAX_RPM = 8500;

/** RPM at which power peaks (torque curve apex used for acceleration calc) */
export const PEAK_POWER_RPM = 6500;

/**
 * RPM window below MAX_RPM where the soft rev limiter begins progressively
 * cutting drive force. Creates an authentic bounce/stutter feel and rewards
 * shifting before the limiter rather than riding it.
 */
export const REV_LIMITER_WINDOW = 200; // starts cutting at 8300 RPM

/** Gear ratios (higher number = more torque multiplication, lower top speed) */
export const GEAR_RATIOS: readonly number[] = [0, 3.5, 2.2, 1.5, 1.1];
// index 0 unused; gears 1-4

/** Final drive ratio – constant multiplier */
export const FINAL_DRIVE = 3.9;

/** Tyre radius in metres (used to convert wheel speed → vehicle speed) */
export const TYRE_RADIUS = 0.33;

/**
 * Engine force constant.
 * Real formula: F = (torque × gearRatio × finalDrive) / tyreRadius
 */
export const ENGINE_TORQUE_BASE = 420; // Nm at peak

/** Vehicle mass in kg */
export const CAR_MASS = 1200;

/**
 * Aerodynamic drag coefficient (dragForce = AERO_DRAG × v²).
 * Reduced from 0.45 → 0.28 so the car feels weighty and keeps momentum
 * rather than stopping abruptly when the throttle lifts.
 */
export const AERO_DRAG = 0.28;

/**
 * Rolling resistance (constant opposing force, Newtons).
 * Reduced from 180 → 70 – less artificial "floor friction" so coasting
 * from high speed feels smooth and progressive.
 */
export const ROLLING_RESISTANCE = 70;

/**
 * Engine braking force applied during coasting (Newtons), scaled by gear ratio.
 * Gives a realistic resistance when lifting off without the car stopping
 * immediately – first gear brakes hardest, fourth gear barely resists.
 */
export const ENGINE_BRAKING_FORCE = 220;

/** How fast RPM climbs when throttle is open (RPM/s while stationary) */
export const STAGING_RPM_CLIMB = 3500;

/** How fast RPM drops when throttle released */
export const RPM_DROP_RATE = 4000;

// ─── Launch window ────────────────────────────────────────────────────────────

/** RPM range considered a perfect launch */
export const LAUNCH_RPM_PERFECT_LOW  = 4800;
export const LAUNCH_RPM_PERFECT_HIGH = 5600; // widened slightly (was 5400)

/** RPM range considered a good launch */
export const LAUNCH_RPM_GOOD_LOW  = 4000; // slightly wider (was 4200)
export const LAUNCH_RPM_GOOD_HIGH = 6200; // slightly wider (was 6000)

/** Below LAUNCH_RPM_GOOD_LOW → bog. Above LAUNCH_RPM_GOOD_HIGH → wheelspin. */

/**
 * Wheelspin penalty: reduced from 0.55 → 0.65 so it's still punishing but
 * the car isn't completely crippled. Ramps back to 1.0 smoothly over duration.
 */
export const WHEELSPIN_PENALTY  = 0.65;
export const WHEELSPIN_DURATION = 0.8;  // seconds (was 1.2 – shorter, snappier)

/**
 * Bog penalty: reduced from 0.60 → 0.68. Ramps back to 1.0 smoothly.
 */
export const BOG_PENALTY  = 0.68;
export const BOG_DURATION = 0.55; // seconds (was 0.8)

// ─── Shifting ─────────────────────────────────────────────────────────────────

/** Ideal upshift RPM – shifting here gives no penalty */
export const SHIFT_RPM_IDEAL = 7200;

/** ±200 RPM of ideal = perfect */
export const SHIFT_RPM_PERFECT_WINDOW = 200;

/** ±600 RPM of ideal = good */
export const SHIFT_RPM_GOOD_WINDOW = 600;

/** Outside good window = early (below) or late (above) */

/** Speed loss fraction per shift grade */
export const SHIFT_SPEED_LOSS: Record<string, number> = {
  PERFECT: 0.00,
  GOOD:    0.02, // reduced from 0.03
  EARLY:   0.07, // reduced from 0.09
  LATE:    0.10, // reduced from 0.12
};

/**
 * After upshift, RPM drops by this fraction of the gear ratio change.
 * Increased from 0.68 → 0.76 for smoother, less jarring gear changes.
 */
export const SHIFT_RPM_DROP_FACTOR = 0.76;

// ─── Nitrous ─────────────────────────────────────────────────────────────────

/** Total nitro available (seconds) */
export const NITRO_DURATION = 3.0;

/** Extra force while nitro is active (Newtons) */
export const NITRO_FORCE = 2800;

/** Nitro also raises RPM */
export const NITRO_RPM_BOOST = 800; // RPM/s added to climb rate

// ─── AI opponent ──────────────────────────────────────────────────────────────

/** Difficulty configuration for the AI opponent */
export interface DifficultyConfig {
  key:         string;
  label:       string;
  description: string;
  color:       number;   // Phaser hex colour (0xRRGGBB)
  colorStr:    string;   // CSS hex colour for text tints
  targetET:    number;   // AI quarter-mile elapsed time in seconds
  variance:    number;   // ±random wobble applied each race
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    key: "ROOKIE",  label: "ROOKIE",
    description: "Slow opponent — good for learning the ropes",
    color: 0x00cc44, colorStr: "#00cc44",
    targetET: 15.5,  variance: 1.0,
  },
  {
    key: "STREET",  label: "STREET",
    description: "Average street racer — solid execution needed",
    color: 0xffcc00, colorStr: "#ffcc00",
    targetET: 12.5,  variance: 0.5,
  },
  {
    key: "PRO",     label: "PRO",
    description: "Seasoned competitor — near-perfect runs required",
    color: 0xff8800, colorStr: "#ff8800",
    targetET: 10.5,  variance: 0.3,
  },
  {
    key: "ELITE",   label: "ELITE",
    description: "Machine precision — only perfection wins",
    color: 0xff2200, colorStr: "#ff2200",
    targetET: 9.0,   variance: 0.15,
  },
];

/** Default difficulty index (STREET) */
export const DEFAULT_DIFFICULTY_INDEX = 1;

// ─── Countdown ────────────────────────────────────────────────────────────────

/** Duration each amber light stays on (seconds) */
export const COUNTDOWN_LIGHT_INTERVAL = 0.5;

/** Number of amber lights */
export const COUNTDOWN_AMBER_COUNT = 3;

// ─── localStorage ─────────────────────────────────────────────────────────────

export const BEST_TIME_KEY = "dragrace_best_time";
