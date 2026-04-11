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
  ENGINE_BRAKING_FORCE,
  REV_LIMITER_WINDOW,
} from "../constants";
import {
  CarState, PlayerInput, LaunchGrade, ShiftGrade, ShiftEvent, CarPhysicsConfig,
} from "../types";

export class Car {
  // ── observable state ──────────────────────────────────────────────────────
  rpm = IDLE_RPM;
  speed = 0;            // m/s
  distance = 0;         // metres
  gear = 1;
  nitroRemaining = NITRO_DURATION;
  nitroActive = false;
  revLimiterActive = false;
  finished = false;
  finishTime = 0;

  // ── launch / shift metadata ───────────────────────────────────────────────
  launchGrade: LaunchGrade = LaunchGrade.Good;
  shiftEvents: ShiftEvent[] = [];

  // ── internal penalty state ────────────────────────────────────────────────
  private penaltyTimer = 0;       // seconds remaining on launch penalty
  private penaltyDuration = 0;    // total duration of this penalty (for ramp)
  private penaltyBase = 1;        // initial multiplier when penalty started (for ramp)
  private launchMultiplier = 1;   // active force multiplier from launch grade
  private launched = false;       // true once throttle hit on green

  // ── RPM smoothing ─────────────────────────────────────────────────────────
  private targetRpm = IDLE_RPM;   // wheel-speed-derived target RPM

  // ── race clock ────────────────────────────────────────────────────────────
  private elapsedTime = 0;        // seconds since green light

  // ── per-car physics config ────────────────────────────────────────────────
  private readonly cfg: CarPhysicsConfig;

  constructor(config?: CarPhysicsConfig) {
    this.cfg = config ?? {
      torqueNm:           ENGINE_TORQUE_BASE,
      massKg:             CAR_MASS,
      aeroDragCoeff:      AERO_DRAG,
      wheelspinPenalty:   WHEELSPIN_PENALTY,
      bogPenalty:         BOG_PENALTY,
      launchPerfectLow:   LAUNCH_RPM_PERFECT_LOW,
      launchPerfectHigh:  LAUNCH_RPM_PERFECT_HIGH,
      launchGoodLow:      LAUNCH_RPM_GOOD_LOW,
      launchGoodHigh:     LAUNCH_RPM_GOOD_HIGH,
      shiftPerfectWindow: SHIFT_RPM_PERFECT_WINDOW,
      shiftGoodWindow:    SHIFT_RPM_GOOD_WINDOW,
    };
  }
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
      const mult = this.launchMultiplierForGrade(this.launchGrade);
      this.launchMultiplier = mult;
      this.penaltyBase = mult;

      if (this.launchGrade === LaunchGrade.Wheelspin) {
        this.penaltyTimer = WHEELSPIN_DURATION;
        this.penaltyDuration = WHEELSPIN_DURATION;
      } else if (this.launchGrade === LaunchGrade.Bog) {
        this.penaltyTimer = BOG_DURATION;
        this.penaltyDuration = BOG_DURATION;
      } else {
        this.penaltyTimer = 0;
        this.penaltyDuration = 0;
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
      // Coasting – apply drag + gentle engine braking
      this.coastStep(dt);
    }

    // ── Smooth launch penalty ramp-out ────────────────────────────────────
    // Ramp launchMultiplier from penaltyBase back to 1.0 as timer counts down
    if (this.penaltyTimer > 0) {
      this.penaltyTimer = Math.max(0, this.penaltyTimer - dt);
      if (this.penaltyTimer === 0) {
        this.launchMultiplier = 1;
      } else {
        const progress = 1 - (this.penaltyTimer / this.penaltyDuration);
        // Ease-out: slow start, fast finish – feels like traction being found
        const eased = Math.pow(progress, 0.6);
        this.launchMultiplier = this.penaltyBase + (1 - this.penaltyBase) * eased;
      }
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
      revLimiterActive: this.revLimiterActive,
      finished: this.finished,
      finishTime: this.finishTime,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private evaluateLaunch(rpm: number): LaunchGrade {
    if (rpm >= this.cfg.launchPerfectLow && rpm <= this.cfg.launchPerfectHigh) {
      return LaunchGrade.Perfect;
    }
    if (rpm >= this.cfg.launchGoodLow && rpm <= this.cfg.launchGoodHigh) {
      return LaunchGrade.Good;
    }
    if (rpm > this.cfg.launchGoodHigh) return LaunchGrade.Wheelspin;
    return LaunchGrade.Bog;
  }

  private launchMultiplierForGrade(grade: LaunchGrade): number {
    switch (grade) {
      case LaunchGrade.Perfect:   return 1.08;
      case LaunchGrade.Good:      return 1.0;
      case LaunchGrade.Wheelspin: return this.cfg.wheelspinPenalty;
      case LaunchGrade.Bog:       return this.cfg.bogPenalty;
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
    this.targetRpm = this.rpm;

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
    if (delta <= this.cfg.shiftPerfectWindow) return ShiftGrade.Perfect;
    if (delta <= this.cfg.shiftGoodWindow)    return ShiftGrade.Good;
    if (rpm < SHIFT_RPM_IDEAL)                return ShiftGrade.Early;
    return ShiftGrade.Late;
  }

  private physicsStep(dt: number): void {
    const ratio = GEAR_RATIOS[this.gear];

    // Torque curve: smooth bell – rises steeply into the power band, steeper falloff
    // encourages shifting before redline
    const torqueFactor = this.torqueCurve(this.rpm);

    // Rev limiter: progressively cuts drive force as RPM approaches MAX_RPM
    const limiterRpmLow = MAX_RPM - REV_LIMITER_WINDOW;
    let limiterFactor = 1.0;
    if (this.rpm >= limiterRpmLow) {
      limiterFactor = 1.0 - (this.rpm - limiterRpmLow) / REV_LIMITER_WINDOW;
      limiterFactor = Math.max(0, limiterFactor);
    }
    this.revLimiterActive = this.rpm >= limiterRpmLow;

    const driveForce = (this.cfg.torqueNm * torqueFactor * ratio * FINAL_DRIVE)
      / TYRE_RADIUS
      * this.launchMultiplier
      * limiterFactor;

    const nitroForce = this.nitroActive ? NITRO_FORCE : 0;
    const nitroRpmBoost = this.nitroActive ? NITRO_RPM_BOOST : 0;

    const drag = this.cfg.aeroDragCoeff * this.speed * this.speed;
    const netForce = driveForce + nitroForce - drag - ROLLING_RESISTANCE;

    const acceleration = netForce / this.cfg.massKg;
    this.speed = Math.max(0, this.speed + acceleration * dt);
    this.distance += this.speed * dt;

    // Target RPM from wheel speed; blend toward it with a short lag for feel
    const wheelRPM = (this.speed / TYRE_RADIUS) * (60 / (2 * Math.PI));
    this.targetRpm = Math.min(MAX_RPM, wheelRPM * ratio * FINAL_DRIVE + nitroRpmBoost * dt);

    // Smooth RPM transition (80 ms lag) – prevents instant needle jumps on shifts
    const rpmLag = 1 - Math.exp(-dt / 0.08);
    this.rpm = Math.min(MAX_RPM, Math.max(IDLE_RPM, this.rpm + (this.targetRpm - this.rpm) * rpmLag));
  }

  private coastStep(dt: number): void {
    this.revLimiterActive = false;

    // Aerodynamic drag (quadratic) + rolling resistance
    const aeroDrag = this.cfg.aeroDragCoeff * this.speed * this.speed;
    // Gentle engine braking: less than full drag, scaled down in higher gears
    const gearFactor = GEAR_RATIOS[this.gear] / GEAR_RATIOS[1];
    const engineBraking = this.speed > 2 ? ENGINE_BRAKING_FORCE * gearFactor : 0;

    const totalResistance = aeroDrag + ROLLING_RESISTANCE + engineBraking;
    const decel = totalResistance / this.cfg.massKg;
    this.speed = Math.max(0, this.speed - decel * dt);
    this.distance += this.speed * dt;

    // RPM follows wheel speed (engine braking provides drag, RPM stays elevated slightly)
    const wheelRPM = (this.speed / TYRE_RADIUS) * (60 / (2 * Math.PI));
    const ratio = GEAR_RATIOS[this.gear];
    this.targetRpm = Math.max(IDLE_RPM, wheelRPM * ratio * FINAL_DRIVE);
    const rpmLag = 1 - Math.exp(-dt / 0.12);
    this.rpm = Math.max(IDLE_RPM, this.rpm + (this.targetRpm - this.rpm) * rpmLag);
  }

  /**
   * Improved torque curve with a pronounced power band.
   * - Rises on a quadratic curve to PEAK_POWER_RPM (steeper than linear)
   * - Steeper falloff above peak to reward shifting at the right time
   * Returns a factor in [0.42, 1.0].
   */
  private torqueCurve(rpm: number): number {
    if (rpm <= PEAK_POWER_RPM) {
      // Quadratic rise: starts sluggish at idle, accelerates quickly in the mid/upper band
      const t = rpm / PEAK_POWER_RPM;
      return 0.42 + 0.58 * (t * t);
    }
    // Above peak: steeper falloff — falls to 0.45 at redline (was 0.60)
    // This makes the "shift zone" feel much more meaningful
    const ratio = (rpm - PEAK_POWER_RPM) / (MAX_RPM - PEAK_POWER_RPM);
    return 1.0 - 0.55 * ratio;
  }
}
