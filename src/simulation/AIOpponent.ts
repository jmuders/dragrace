import { AI_TARGET_ET, AI_ET_VARIANCE, QUARTER_MILE_METERS } from "../constants";
import { CarState } from "../types";

/**
 * AI opponent is a pure kinematic model.
 * We don't run the full physics sim for it – instead we fit a smooth
 * acceleration curve that hits the target ET, then integrate position.
 * This keeps AI behaviour predictable and variance-controlled.
 */
export class AIOpponent {
  distance = 0;
  speed = 0;
  finished = false;
  finishTime = 0;

  private readonly targetET: number;
  private elapsed = 0;

  constructor() {
    // Randomise ET slightly each race so the AI isn't a metronome
    const variance = (Math.random() * 2 - 1) * AI_ET_VARIANCE;
    this.targetET = AI_TARGET_ET + variance;
  }

  /** Call every frame while race is active */
  update(dt: number): void {
    if (this.finished) return;

    this.elapsed += dt;

    // Model: distance = QUARTER_MILE * (t/ET)^1.8
    // This gives a slow start + fast finish shape typical of drag cars.
    const t = this.elapsed;
    const et = this.targetET;
    const distNext = QUARTER_MILE_METERS * Math.pow(Math.min(t, et) / et, 1.8);
    this.speed = Math.max(0, (distNext - this.distance) / dt);
    this.distance = distNext;

    if (this.distance >= QUARTER_MILE_METERS && !this.finished) {
      this.finished = true;
      this.finishTime = this.elapsed;
    }
  }

  getState(): CarState {
    return {
      rpm: 0,           // AI doesn't expose RPM
      speed: this.speed,
      distance: this.distance,
      gear: 0,
      nitroRemaining: 0,
      nitroActive: false,
      revLimiterActive: false,
      finished: this.finished,
      finishTime: this.finishTime,
    };
  }
}
