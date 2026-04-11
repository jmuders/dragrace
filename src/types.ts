// ─── Core enums ───────────────────────────────────────────────────────────────

export const enum Difficulty {
  Rookie = "ROOKIE",
  Street = "STREET",
  Pro    = "PRO",
  Elite  = "ELITE",
}

// ─── Car characteristics ───────────────────────────────────────────────────────

/** Visible stat ratings shown on the car selection screen (each 1–5). */
export interface CarStats {
  power:  number; // engine output → raw acceleration
  weight: number; // 5 = lightest → best power-to-weight
  grip:   number; // launch traction + wheelspin resistance
  shift:  number; // gear-shift timing forgiveness
  aero:   number; // aerodynamic efficiency → top-end speed
}

/**
 * Per-car physics override values derived from CarStats.
 * Passed to Car's constructor; replaces the global constants
 * that were identical for every car before this system.
 */
export interface CarPhysicsConfig {
  torqueNm:           number; // Engine torque (Nm)
  massKg:             number; // Car mass (kg)
  aeroDragCoeff:      number; // Aero drag coefficient
  wheelspinPenalty:   number; // Force multiplier on wheelspin launch
  bogPenalty:         number; // Force multiplier on bog launch
  launchPerfectLow:   number; // Perfect launch window RPM low
  launchPerfectHigh:  number; // Perfect launch window RPM high
  launchGoodLow:      number; // Good launch window RPM low
  launchGoodHigh:     number; // Good launch window RPM high
  shiftPerfectWindow: number; // ±RPM around ideal for perfect shift
  shiftGoodWindow:    number; // ±RPM around ideal for good shift
}

export const enum RacePhase {
  Staging = "staging",    // pre-countdown, engines revving
  Countdown = "countdown",
  Racing = "racing",
  Finished = "finished",
}

export const enum LaunchGrade {
  Perfect = "PERFECT",
  Good = "GOOD",
  Wheelspin = "WHEELSPIN",
  Bog = "BOG",
}

export const enum ShiftGrade {
  Perfect = "PERFECT",
  Good = "GOOD",
  Early = "EARLY",
  Late = "LATE",
}

// ─── Per-gear shift event ──────────────────────────────────────────────────────

export interface ShiftEvent {
  gear: number;          // gear shifted INTO
  rpm: number;           // RPM at moment of shift
  grade: ShiftGrade;
  speedLossFraction: number; // 0 = no loss, 1 = full penalty
}

// ─── Snapshot of car state every simulation tick ──────────────────────────────

export interface CarState {
  rpm: number;
  speed: number;       // m/s
  distance: number;    // metres travelled
  gear: number;        // 1-4
  nitroRemaining: number; // seconds of nitro left
  nitroActive: boolean;
  revLimiterActive: boolean;
  finished: boolean;
  finishTime: number;  // seconds since lights green, 0 if not finished
}

// ─── Player input for one simulation step ─────────────────────────────────────

export interface PlayerInput {
  throttle: boolean;
  shift: boolean;       // edge: true only on the frame the key was pressed
  nitro: boolean;
}

// ─── Full race result handed to the results screen ────────────────────────────

export interface RaceResult {
  playerTime: number;
  opponentTime: number;
  playerWon: boolean;
  launchGrade: LaunchGrade;
  shiftEvents: ShiftEvent[];
  bestTime: number;    // pulled from / updated in localStorage
  isNewBest: boolean;
}
