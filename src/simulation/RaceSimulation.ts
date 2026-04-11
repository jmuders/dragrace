import { Car } from "./Car";
import { AIOpponent } from "./AIOpponent";
import { CarState, PlayerInput, RacePhase, RaceResult, ShiftEvent } from "../types";
import {
  COUNTDOWN_LIGHT_INTERVAL, COUNTDOWN_AMBER_COUNT,
  BEST_TIME_KEY,
} from "../constants";

export interface CountdownState {
  ambersLit: number;   // 0-3
  greenLit: boolean;
}

export interface SimulationState {
  phase: RacePhase;
  countdown: CountdownState;
  player: CarState;
  opponent: CarState;
  elapsed: number;
}

export class RaceSimulation {
  private car = new Car();
  private ai: AIOpponent;

  private phase: RacePhase = RacePhase.Staging;
  private countdownTimer = 0;
  private ambersLit = 0;
  private greenLit = false;
  private elapsed = 0;

  constructor(difficultyKey?: string) {
    this.ai = new AIOpponent(difficultyKey);
  }

  // Last input snapshot used by scenes
  lastShiftEvent: ShiftEvent | null = null;

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Begin the countdown sequence */
  startCountdown(): void {
    if (this.phase !== RacePhase.Staging) return;
    this.phase = RacePhase.Countdown;
    this.countdownTimer = 0;
    this.ambersLit = 0;
    this.greenLit = false;
  }

  /**
   * Main update. Call every frame with delta-time in seconds.
   * Returns true if a shift happened this tick.
   */
  update(input: PlayerInput, dt: number): boolean {
    this.lastShiftEvent = null;
    let shiftHappened = false;

    switch (this.phase) {

      case RacePhase.Staging:
        // Player can stage RPM
        this.car.updateStaging(input.throttle, dt);
        break;

      case RacePhase.Countdown:
        // Player continues to hold RPM during countdown
        this.car.updateStaging(input.throttle, dt);

        this.countdownTimer += dt;
        const lightStep = COUNTDOWN_LIGHT_INTERVAL;

        // Ambers come on one at a time
        const expectedAmbers = Math.min(
          Math.floor(this.countdownTimer / lightStep),
          COUNTDOWN_AMBER_COUNT,
        );
        this.ambersLit = expectedAmbers;

        // Green after all ambers
        if (this.countdownTimer >= (COUNTDOWN_AMBER_COUNT + 1) * lightStep) {
          this.greenLit = true;
          this.phase = RacePhase.Racing;
          this.elapsed = 0;
        }
        break;

      case RacePhase.Racing:
        this.elapsed += dt;
        const shiftEvent = this.car.update(input, dt);
        if (shiftEvent) {
          this.lastShiftEvent = shiftEvent;
          shiftHappened = true;
        }
        this.ai.update(dt);

        if (this.car.finished && this.ai.finished) {
          this.phase = RacePhase.Finished;
        } else if (this.car.finished || this.ai.finished) {
          // Keep simulating until both finish or 30s timeout
          if (this.elapsed > 30) this.phase = RacePhase.Finished;
        }
        break;

      case RacePhase.Finished:
        break;
    }

    return shiftHappened;
  }

  getState(): SimulationState {
    return {
      phase: this.phase,
      countdown: { ambersLit: this.ambersLit, greenLit: this.greenLit },
      player: this.car.getState(),
      opponent: this.ai.getState(),
      elapsed: this.elapsed,
    };
  }

  buildResult(): RaceResult {
    const playerTime = this.car.finishTime;
    const opponentTime = this.ai.finishTime;
    const playerWon = playerTime > 0 && (opponentTime === 0 || playerTime < opponentTime);

    // localStorage best time
    const stored = localStorage.getItem(BEST_TIME_KEY);
    const prevBest = stored ? parseFloat(stored) : Infinity;
    const isNewBest = playerTime > 0 && playerTime < prevBest;
    const bestTime = isNewBest ? playerTime : (prevBest === Infinity ? playerTime : prevBest);

    if (isNewBest && playerTime > 0) {
      localStorage.setItem(BEST_TIME_KEY, playerTime.toFixed(3));
    }

    return {
      playerTime,
      opponentTime,
      playerWon,
      launchGrade: this.car.launchGrade,
      shiftEvents: this.car.shiftEvents,
      bestTime,
      isNewBest,
    };
  }

  isFinished(): boolean {
    return this.phase === RacePhase.Finished;
  }

  isRacing(): boolean {
    return this.phase === RacePhase.Racing;
  }

  isStaging(): boolean {
    return this.phase === RacePhase.Staging;
  }
}
