extends RefCounted
class_name Car

# ── Enums (mirror src/types.ts) ────────────────────────────────────────────────
enum LaunchGrade { PERFECT, GOOD, WHEELSPIN, BOG }
enum ShiftGrade  { PERFECT, GOOD, EARLY, LATE }

# ── Observable state ───────────────────────────────────────────────────────────
var rpm: float = 1000.0
var speed: float = 0.0
var distance: float = 0.0
var gear: int = 1
var nitro_remaining: float = 3.0
var nitro_active: bool = false
var rev_limiter_active: bool = false
var finished: bool = false
var finish_time: float = 0.0

# ── Launch / shift metadata ────────────────────────────────────────────────────
var launch_grade: int = LaunchGrade.GOOD
var shift_events: Array = []

# ── Internal penalty state ─────────────────────────────────────────────────────
var _penalty_timer: float = 0.0
var _penalty_duration: float = 0.0
var _penalty_base: float = 1.0
var _launch_multiplier: float = 1.0
var _launched: bool = false
var _target_rpm: float = 1000.0
var _elapsed_time: float = 0.0

# ── Per-car physics config ─────────────────────────────────────────────────────
var _cfg: Dictionary = {}

func _init(config: Dictionary) -> void:
	if config.is_empty():
		_cfg = {
			"torqueNm":           420.0,
			"massKg":             1200.0,
			"aeroDragCoeff":      0.28,
			"wheelspinPenalty":   0.65,
			"bogPenalty":         0.68,
			"launchPerfectLow":   4800.0,
			"launchPerfectHigh":  5600.0,
			"launchGoodLow":      4000.0,
			"launchGoodHigh":     6200.0,
			"shiftPerfectWindow": 200.0,
			"shiftGoodWindow":    600.0,
		}
	else:
		_cfg = config
	nitro_remaining = Constants.NITRO_DURATION

# ── Staging phase ──────────────────────────────────────────────────────────────

func update_staging(throttle: bool, dt: float) -> void:
	if throttle:
		rpm = minf(rpm + Constants.STAGING_RPM_CLIMB * dt, Constants.MAX_RPM)
	else:
		rpm = maxf(rpm - Constants.RPM_DROP_RATE * dt, Constants.IDLE_RPM)

# ── Race phase ─────────────────────────────────────────────────────────────────

# Returns a shift event Dictionary (or empty Dict if no shift this frame)
func update(input: Dictionary, dt: float) -> Dictionary:
	if finished:
		return {}

	_elapsed_time += dt
	var shift_event: Dictionary = {}

	# Handle launch (first throttle press after green)
	if not _launched and input["throttle"]:
		_launched = true
		launch_grade = _evaluate_launch(rpm)
		var mult := _launch_multiplier_for_grade(launch_grade)
		_launch_multiplier = mult
		_penalty_base = mult

		match launch_grade:
			LaunchGrade.WHEELSPIN:
				_penalty_timer = Constants.WHEELSPIN_DURATION
				_penalty_duration = Constants.WHEELSPIN_DURATION
			LaunchGrade.BOG:
				_penalty_timer = Constants.BOG_DURATION
				_penalty_duration = Constants.BOG_DURATION
			_:
				_penalty_timer = 0.0
				_penalty_duration = 0.0

	# Handle shift request (edge-triggered: caller ensures input["shift"] is true only once)
	if input["shift"] and _launched and gear < 4:
		shift_event = _do_shift()

	# Nitro
	nitro_active = false
	if input["nitro"] and nitro_remaining > 0.0 and _launched:
		nitro_active = true
		nitro_remaining = maxf(0.0, nitro_remaining - dt)

	# Physics step
	if _launched and input["throttle"]:
		_physics_step(dt)
	elif _launched:
		_coast_step(dt)

	# Smooth launch penalty ramp-out
	if _penalty_timer > 0.0:
		_penalty_timer = maxf(0.0, _penalty_timer - dt)
		if _penalty_timer == 0.0:
			_launch_multiplier = 1.0
		else:
			var progress := 1.0 - (_penalty_timer / _penalty_duration)
			var eased := pow(progress, 0.6)
			_launch_multiplier = _penalty_base + (1.0 - _penalty_base) * eased

	# Finish check
	if distance >= Constants.QUARTER_MILE_METERS and not finished:
		finished = true
		finish_time = _elapsed_time

	return shift_event

func is_launched() -> bool:
	return _launched

func get_state() -> Dictionary:
	return {
		"rpm": rpm,
		"speed": speed,
		"distance": distance,
		"gear": gear,
		"nitro_remaining": nitro_remaining,
		"nitro_active": nitro_active,
		"rev_limiter_active": rev_limiter_active,
		"finished": finished,
		"finish_time": finish_time,
	}

# ── Private helpers ────────────────────────────────────────────────────────────

func _evaluate_launch(r: float) -> int:
	if r >= float(_cfg["launchPerfectLow"]) and r <= float(_cfg["launchPerfectHigh"]):
		return LaunchGrade.PERFECT
	if r >= float(_cfg["launchGoodLow"]) and r <= float(_cfg["launchGoodHigh"]):
		return LaunchGrade.GOOD
	if r > float(_cfg["launchGoodHigh"]):
		return LaunchGrade.WHEELSPIN
	return LaunchGrade.BOG

func _launch_multiplier_for_grade(grade: int) -> float:
	match grade:
		LaunchGrade.PERFECT:   return 1.08
		LaunchGrade.GOOD:      return 1.0
		LaunchGrade.WHEELSPIN: return float(_cfg["wheelspinPenalty"])
		LaunchGrade.BOG:       return float(_cfg["bogPenalty"])
	return 1.0

func _do_shift() -> Dictionary:
	var grade := _evaluate_shift(rpm)
	var grade_key: String = str(ShiftGrade.keys()[grade])
	var speed_loss := float(Constants.SHIFT_SPEED_LOSS.get(grade_key, 0.0))

	speed *= (1.0 - speed_loss)

	var old_ratio := float(Constants.GEAR_RATIOS[gear])
	gear = mini(gear + 1, 4)
	var new_ratio := float(Constants.GEAR_RATIOS[gear])
	rpm = maxf(
		Constants.IDLE_RPM,
		rpm * (new_ratio / old_ratio) * Constants.SHIFT_RPM_DROP_FACTOR
	)
	_target_rpm = rpm

	var event := {
		"gear": gear,
		"rpm": rpm,
		"grade": grade,
		"grade_key": grade_key,
		"speed_loss_fraction": speed_loss,
	}
	shift_events.append(event)
	return event

func _evaluate_shift(r: float) -> int:
	var delta := absf(r - Constants.SHIFT_RPM_IDEAL)
	if delta <= float(_cfg["shiftPerfectWindow"]): return ShiftGrade.PERFECT
	if delta <= float(_cfg["shiftGoodWindow"]):    return ShiftGrade.GOOD
	if r < Constants.SHIFT_RPM_IDEAL:              return ShiftGrade.EARLY
	return ShiftGrade.LATE

func _physics_step(dt: float) -> void:
	var ratio := float(Constants.GEAR_RATIOS[gear])
	var torque_factor := _torque_curve(rpm)

	var limiter_rpm_low := Constants.MAX_RPM - Constants.REV_LIMITER_WINDOW
	var limiter_factor := 1.0
	if rpm >= limiter_rpm_low:
		limiter_factor = 1.0 - (rpm - limiter_rpm_low) / Constants.REV_LIMITER_WINDOW
		limiter_factor = maxf(0.0, limiter_factor)
	rev_limiter_active = rpm >= limiter_rpm_low

	var drive_force := (float(_cfg["torqueNm"]) * torque_factor * ratio * Constants.FINAL_DRIVE) \
		/ Constants.TYRE_RADIUS \
		* _launch_multiplier \
		* limiter_factor

	var nitro_force := Constants.NITRO_FORCE if nitro_active else 0.0
	var nitro_rpm_boost := Constants.NITRO_RPM_BOOST if nitro_active else 0.0

	var drag := float(_cfg["aeroDragCoeff"]) * speed * speed
	var net_force := drive_force + nitro_force - drag - Constants.ROLLING_RESISTANCE

	var acceleration := net_force / float(_cfg["massKg"])
	speed = maxf(0.0, speed + acceleration * dt)
	distance += speed * dt

	var wheel_rpm := (speed / Constants.TYRE_RADIUS) * (60.0 / TAU)
	_target_rpm = minf(Constants.MAX_RPM, wheel_rpm * ratio * Constants.FINAL_DRIVE + nitro_rpm_boost * dt)

	var rpm_lag := 1.0 - exp(-dt / 0.08)
	rpm = minf(Constants.MAX_RPM, maxf(Constants.IDLE_RPM, rpm + (_target_rpm - rpm) * rpm_lag))

func _coast_step(dt: float) -> void:
	rev_limiter_active = false
	var aero_drag := float(_cfg["aeroDragCoeff"]) * speed * speed
	var gear_factor: float = float(Constants.GEAR_RATIOS[gear]) / float(Constants.GEAR_RATIOS[1])
	var engine_braking := Constants.ENGINE_BRAKING_FORCE * gear_factor if speed > 2.0 else 0.0
	var total_resistance := aero_drag + Constants.ROLLING_RESISTANCE + engine_braking
	var decel := float(total_resistance) / float(_cfg["massKg"])
	speed = maxf(0.0, speed - decel * dt)
	distance += speed * dt

	var wheel_rpm := (speed / Constants.TYRE_RADIUS) * (60.0 / TAU)
	var ratio := float(Constants.GEAR_RATIOS[gear])
	_target_rpm = maxf(Constants.IDLE_RPM, wheel_rpm * ratio * Constants.FINAL_DRIVE)
	var rpm_lag := 1.0 - exp(-dt / 0.12)
	rpm = maxf(Constants.IDLE_RPM, rpm + (_target_rpm - rpm) * rpm_lag)

func _torque_curve(r: float) -> float:
	if r <= Constants.PEAK_POWER_RPM:
		var t := r / Constants.PEAK_POWER_RPM
		return 0.42 + 0.58 * (t * t)
	var ratio := (r - Constants.PEAK_POWER_RPM) / (Constants.MAX_RPM - Constants.PEAK_POWER_RPM)
	return 1.0 - 0.55 * ratio
