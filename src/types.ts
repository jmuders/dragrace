// ─── Core enums ───────────────────────────────────────────────────────────────

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
