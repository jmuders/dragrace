import {
  IDLE_RPM, MAX_RPM, PEAK_POWER_RPM,
  GEAR_RATIOS, FINAL_DRIVE, TYRE_RADIUS,
  ENGINE_TORQUE_BASE, CAR_MASS, AERO_DRAG, ROLLING_RESISTANCE,
  STAGING_RPM_CLIMB, RPM_DROP_RATE,
  LAUNCH_RPM_PERFECT_LOW, LAUNCH_RPM_PERFECT_HIGH,
  LAUNCH_RPM_GOOD_LOW, LAUNCH_RPM_GOOD_HIGH,
  WHEELSPIN_PENALTY, WHEELSPIN_DURATION,
  BOG_PENALTY, BOG_DURATION,
  SHIFT_RPM_IDEAL, SHIFT_RPM_PERFECT_WINDOW, SHIFT_RPM_GOOD_WINDOW,
  SHIFT_SPEED_LOSS, SHIFT_RPM_DROP_FACTOR,
  NITRO_DURATION, NITRO_FORCE, NITRO_RPM_BOOST,
  QUARTER_MILE_METERS,
} from "../constants";
import {
  CarState, PlayerInput, LaunchGrade, ShiftGrade, ShiftEvent,
} from "../types";

export class Car {
  // ── observable state ──────────────────────────────────────────────────────
  rpm = IDLE_RPM;
  speed = 0;            // m/s
  distance = 0;         // metres
  gear = 1;
  nitroRemaining = NITRO_DURATION;
  nitroActive = false;
  finished = false;
  finishTime = 0;

  // ── launch / shift metadata ───────────────────────────────────────────────
  launchGrade: LaunchGrade = LaunchGrade.Good;
  shiftEvents: ShiftEvent[] = [];

  // ── internal penalty state ────────────────────────────────────────────────
  private penaltyTimer = 0;      // seconds remaining on launch penalty
  private launchMultiplier = 1;  // active force multiplier from launch grade
  private launched = false;      // true once throttle hit on green

  // ── race clock ────────────────────────────────────────────────────────────
  private elapsedTime = 0;       // seconds since green light

  // ─── Staging phase: player revs engine ───────────────────────────────────

  /** Call every frame during staging (before green). throttle = held key */
  updateStaging(throttle: boolean, dt: number): void {
    if (throttle) {
      this.rpm = Math.min(this.rpm + STAGING_RPM_CLIMB * dt, MAX_RPM);
    } else {
      this.rpm = Math.max(this.rpm - RPM_DROP_RATE * dt, IDLE_RPM);
    }
  }

  // ─── Race phase ───────────────────────────────────────────────────────────

  /**
   * Advance simulation by dt seconds.
   * Returns a ShiftEvent if a shift happened this frame, or null.
   */
  update(input: PlayerInput, dt: number): ShiftEvent | null {
    if (this.finished) return null;

    this.elapsedTime += dt;
    let shiftEvent: ShiftEvent | null = null;

    // ── Handle launch (first throttle press after green) ──────────────────
    if (!this.launched && input.throttle) {
      this.launched = true;
      this.launchGrade = this.evaluateLaunch(this.rpm);
      this.launchMultiplier = this.launchMultiplierForGrade(this.launchGrade);
      if (this.launchGrade !== LaunchGrade.Perfect && this.launchGrade !== LaunchGrade.Good) {
        this.penaltyTimer = this.launchGrade === LaunchGrade.Wheelspin
          ? WHEELSPIN_DURATION
          : BOG_DURATION;
      }
    }

    // ── Handle shift request ──────────────────────────────────────────────
    if (input.shift && this.launched && this.gear < 4) {
      shiftEvent = this.doShift();
    }

    // ── Nitro ─────────────────────────────────────────────────────────────
    this.nitroActive = false;
    if (input.nitro && this.nitroRemaining > 0 && this.launched) {
      this.nitroActive = true;
      this.nitroRemaining = Math.max(0, this.nitroRemaining - dt);
    }

    // ── Physics step ─────────────────────────────────────────────────────
    if (this.launched && input.throttle) {
      this.physicsStep(dt);
    } else if (this.launched) {
      // Coasting (lifted throttle) – just apply drag
      this.coastStep(dt);
    }

    // ── Tick down launch penalty timer ───────────────────────────────────
    if (this.penaltyTimer > 0) {
      this.penaltyTimer = Math.max(0, this.penaltyTimer - dt);
      if (this.penaltyTimer === 0) this.launchMultiplier = 1;
    }

    // ── Finish check ─────────────────────────────────────────────────────
    if (this.distance >= QUARTER_MILE_METERS && !this.finished) {
      this.finished = true;
      this.finishTime = this.elapsedTime;
    }

    return shiftEvent;
  }

  getState(): CarState {
    return {
      rpm: this.rpm,
      speed: this.speed,
      distance: this.distance,
      gear: this.gear,
      nitroRemaining: this.nitroRemaining,
      nitroActive: this.nitroActive,
      finished: this.finished,
      finishTime: this.finishTime,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private evaluateLaunch(rpm: number): LaunchGrade {
    if (rpm >= LAUNCH_RPM_PERFECT_LOW && rpm <= LAUNCH_RPM_PERFECT_HIGH) {
      return LaunchGrade.Perfect;
    }
    if (rpm >= LAUNCH_RPM_GOOD_LOW && rpm <= LAUNCH_RPM_GOOD_HIGH) {
      return LaunchGrade.Good;
    }
    if (rpm > LAUNCH_RPM_GOOD_HIGH) return LaunchGrade.Wheelspin;
    return LaunchGrade.Bog;
  }

  private launchMultiplierForGrade(grade: LaunchGrade): number {
    switch (grade) {
      case LaunchGrade.Perfect: return 1.05; // slight reward
      case LaunchGrade.Good:    return 1.0;
      case LaunchGrade.Wheelspin: return WHEELSPIN_PENALTY;
      case LaunchGrade.Bog:     return BOG_PENALTY;
    }
  }

  private doShift(): ShiftEvent {
    const grade = this.evaluateShift(this.rpm);
    const speedLoss = SHIFT_SPEED_LOSS[grade];

    // Speed drops slightly on a bad shift
    this.speed *= (1 - speedLoss);

    // RPM drops to match the new gear's ratio
    const oldRatio = GEAR_RATIOS[this.gear];
    this.gear = Math.min(this.gear + 1, 4);
    const newRatio = GEAR_RATIOS[this.gear];
    this.rpm = Math.max(
      IDLE_RPM,
      this.rpm * (newRatio / oldRatio) * SHIFT_RPM_DROP_FACTOR,
    );

    const event: ShiftEvent = {
      gear: this.gear,
      rpm: this.rpm,
      grade,
      speedLossFraction: speedLoss,
    };
    this.shiftEvents.push(event);
    return event;
  }

  private evaluateShift(rpm: number): ShiftGrade {
    const delta = Math.abs(rpm - SHIFT_RPM_IDEAL);
    if (delta <= SHIFT_RPM_PERFECT_WINDOW) return ShiftGrade.Perfect;
    if (delta <= SHIFT_RPM_GOOD_WINDOW)    return ShiftGrade.Good;
    if (rpm < SHIFT_RPM_IDEAL)             return ShiftGrade.Early;
    return ShiftGrade.Late;
  }

  private physicsStep(dt: number): void {
    const ratio = GEAR_RATIOS[this.gear];

    // Torque curve: peak at PEAK_POWER_RPM, falls off above/below
    const torqueFactor = this.torqueCurve(this.rpm);
    const driveForce = (ENGINE_TORQUE_BASE * torqueFactor * ratio * FINAL_DRIVE)
      / TYRE_RADIUS
      * this.launchMultiplier;

    const nitroForce = this.nitroActive ? NITRO_FORCE : 0;
    const nitroRpmBoost = this.nitroActive ? NITRO_RPM_BOOST : 0;

    const drag = AERO_DRAG * this.speed * this.speed;
    const netForce = driveForce + nitroForce - drag - ROLLING_RESISTANCE;

    const acceleration = netForce / CAR_MASS;
    this.speed = Math.max(0, this.speed + acceleration * dt);
    this.distance += this.speed * dt;

    // Update RPM based on current wheel speed & gear ratio
    const wheelRPM = (this.speed / TYRE_RADIUS) * (60 / (2 * Math.PI));
    const targetRPM = wheelRPM * ratio * FINAL_DRIVE + nitroRpmBoost * dt;
    // Blend toward wheel-derived RPM with a short lag for feel
    this.rpm = Math.min(MAX_RPM, Math.max(IDLE_RPM, targetRPM));
  }

  private coastStep(dt: number): void {
    const drag = AERO_DRAG * this.speed * this.speed + ROLLING_RESISTANCE;
    const decel = drag / CAR_MASS;
    this.speed = Math.max(0, this.speed - decel * dt);
    this.distance += this.speed * dt;

    // RPM follows wheel speed
    const wheelRPM = (this.speed / TYRE_RADIUS) * (60 / (2 * Math.PI));
    const ratio = GEAR_RATIOS[this.gear];
    this.rpm = Math.max(IDLE_RPM, wheelRPM * ratio * FINAL_DRIVE);
  }

  /**
   * Simplified torque curve:
   * Rises linearly to PEAK_POWER_RPM, then falls off.
   * Returns a factor in [0.5, 1.0].
   */
  private torqueCurve(rpm: number): number {
    if (rpm <= PEAK_POWER_RPM) {
      return 0.55 + 0.45 * (rpm / PEAK_POWER_RPM);
    }
    // Above peak: falls linearly to 0.6 at MAX_RPM
    const ratio = (rpm - PEAK_POWER_RPM) / (MAX_RPM - PEAK_POWER_RPM);
    return 1.0 - 0.40 * ratio;
  }
}
