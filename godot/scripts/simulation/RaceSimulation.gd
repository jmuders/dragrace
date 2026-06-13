extends RefCounted

enum RacePhase { STAGING, COUNTDOWN, RACING, FINISHED }

var _car: Car
var _ai: AIOpponent

var _phase: int = RacePhase.STAGING
var _countdown_timer: float = 0.0
var _ambers_lit: int = 0
var _green_lit: bool = false
var _elapsed: float = 0.0

var last_shift_event: Dictionary = {}

func _init(difficulty_key: String = "", car_type: String = "silver") -> void:
	_ai  = AIOpponent.new(difficulty_key)
	var physics := GameState.car_data.get_car_physics_config(car_type)
	_car = Car.new(physics)

func start_countdown() -> void:
	if _phase != RacePhase.STAGING:
		return
	_phase = RacePhase.COUNTDOWN
	_countdown_timer = 0.0
	_ambers_lit = 0
	_green_lit = false

# Returns true if a shift happened this tick
func update(input: Dictionary, dt: float) -> bool:
	last_shift_event = {}
	var shift_happened := false

	match _phase:
		RacePhase.STAGING:
			_car.update_staging(input["throttle"], dt)

		RacePhase.COUNTDOWN:
			_car.update_staging(input["throttle"], dt)
			_countdown_timer += dt
			var expected_ambers := mini(
				int(_countdown_timer / Constants.COUNTDOWN_LIGHT_INTERVAL),
				Constants.COUNTDOWN_AMBER_COUNT
			)
			_ambers_lit = expected_ambers
			if _countdown_timer >= (Constants.COUNTDOWN_AMBER_COUNT + 1) * Constants.COUNTDOWN_LIGHT_INTERVAL:
				_green_lit = true
				_phase = RacePhase.RACING
				_elapsed = 0.0

		RacePhase.RACING:
			_elapsed += dt
			var shift_event := _car.update(input, dt)
			if not shift_event.is_empty():
				last_shift_event = shift_event
				shift_happened = true
			_ai.update(dt)
			if _car.finished and _ai.finished:
				_phase = RacePhase.FINISHED
			elif (_car.finished or _ai.finished) and _elapsed > 30.0:
				_phase = RacePhase.FINISHED

		RacePhase.FINISHED:
			pass

	return shift_happened

func get_state() -> Dictionary:
	return {
		"phase": _phase,
		"countdown": { "ambers_lit": _ambers_lit, "green_lit": _green_lit },
		"player": _car.get_state(),
		"opponent": _ai.get_state(),
		"elapsed": _elapsed,
	}

func build_result() -> Dictionary:
	var player_time := _car.finish_time
	var opponent_time := _ai.finish_time
	var player_won := player_time > 0.0 and (opponent_time == 0.0 or player_time < opponent_time)

	# Persist best time via ConfigFile
	var cfg := ConfigFile.new()
	var prev_best := INF
	if cfg.load(Constants.SAVE_FILE) == OK:
		prev_best = cfg.get_value("times", Constants.BEST_TIME_KEY, INF)

	var is_new_best := player_time > 0.0 and player_time < prev_best
	var best_time: float
	if is_new_best:
		best_time = player_time
	elif prev_best == INF:
		best_time = player_time
	else:
		best_time = prev_best

	if is_new_best and player_time > 0.0:
		cfg.set_value("times", Constants.BEST_TIME_KEY, player_time)
		cfg.save(Constants.SAVE_FILE)

	return {
		"player_time": player_time,
		"opponent_time": opponent_time,
		"player_won": player_won,
		"launch_grade": _car.launch_grade,
		"shift_events": _car.shift_events,
		"best_time": best_time,
		"is_new_best": is_new_best,
	}

func is_finished() -> bool:
	return _phase == RacePhase.FINISHED

func is_racing() -> bool:
	return _phase == RacePhase.RACING

func is_staging() -> bool:
	return _phase == RacePhase.STAGING
