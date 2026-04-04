// ─── Track ────────────────────────────────────────────────────────────────────

export const QUARTER_MILE_METERS = 402.336;

// ─── Engine / gear model ──────────────────────────────────────────────────────

/** Idle RPM when engine is running */
export const IDLE_RPM = 1000;

/** Rev limiter */
export const MAX_RPM = 8500;

/** RPM at which power peaks (torque curve apex used for acceleration calc) */
export const PEAK_POWER_RPM = 6500;

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
 * We use a simplified scalar to avoid full torque curves.
 */
export const ENGINE_TORQUE_BASE = 420; // Nm at peak

/** Vehicle mass in kg */
export const CAR_MASS = 1200;

/** Aerodynamic drag coefficient (simplified: dragForce = AERO_DRAG × v²) */
export const AERO_DRAG = 0.45;

/** Rolling resistance force (constant) */
export const ROLLING_RESISTANCE = 180;

/** How fast RPM climbs when throttle is open (RPM/s while stationary) */
export const STAGING_RPM_CLIMB = 3500;

/** How fast RPM drops when throttle released */
export const RPM_DROP_RATE = 4000;

// ─── Launch window ────────────────────────────────────────────────────────────

/** RPM range considered a perfect launch */
export const LAUNCH_RPM_PERFECT_LOW = 4800;
export const LAUNCH_RPM_PERFECT_HIGH = 5400;

/** RPM range considered a good launch */
export const LAUNCH_RPM_GOOD_LOW = 4200;
export const LAUNCH_RPM_GOOD_HIGH = 6000;

/** Below LAUNCH_RPM_GOOD_LOW → bog. Above LAUNCH_RPM_GOOD_HIGH → wheelspin. */

/** Speed penalty multiplier for wheelspin (e.g. 0.7 = 30% slower acceleration) */
export const WHEELSPIN_PENALTY = 0.55;
export const WHEELSPIN_DURATION = 1.2; // seconds

/** Acceleration multiplier for bog */
export const BOG_PENALTY = 0.60;
export const BOG_DURATION = 0.8; // seconds

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
  GOOD: 0.03,
  EARLY: 0.09,
  LATE: 0.12,
};

/** After upshift, RPM drops by this fraction of the post-shift gear ratio change */
export const SHIFT_RPM_DROP_FACTOR = 0.68; // RPM_new = RPM_old * (newRatio/oldRatio) * factor

// ─── Nitrous ─────────────────────────────────────────────────────────────────

/** Total nitro available (seconds) */
export const NITRO_DURATION = 3.0;

/** Extra force while nitro is active (Newtons) */
export const NITRO_FORCE = 2800;

/** Nitro also raises RPM */
export const NITRO_RPM_BOOST = 800; // RPM/s added to climb rate

// ─── AI opponent ──────────────────────────────────────────────────────────────

/** AI simulates a target ET (elapsed time in seconds for the quarter mile) */
export const AI_TARGET_ET = 11.4; // seconds – gives player a fair challenge

/** Small random variance added each race so AI isn't perfectly consistent */
export const AI_ET_VARIANCE = 0.3;

// ─── Countdown ────────────────────────────────────────────────────────────────

/** Duration each amber light stays on (seconds) */
export const COUNTDOWN_LIGHT_INTERVAL = 0.5;

/** Number of amber lights */
export const COUNTDOWN_AMBER_COUNT = 3;

// ─── localStorage ─────────────────────────────────────────────────────────────

export const BEST_TIME_KEY = "dragrace_best_time";
