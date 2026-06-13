extends RefCounted
class_name AIOpponent

var distance: float = 0.0
var speed: float = 0.0
var finished: bool = false
var finish_time: float = 0.0

var _target_et: float
var _elapsed: float = 0.0

func _init(difficulty_key: String = "") -> void:
	var cfg: Dictionary = {}
	for d in Constants.DIFFICULTIES:
		if d["key"] == difficulty_key:
			cfg = d
			break
	if cfg.is_empty():
		cfg = Constants.DIFFICULTIES[Constants.DEFAULT_DIFFICULTY_INDEX]

	var variance := (randf() * 2.0 - 1.0) * float(cfg["variance"])
	_target_et = float(cfg["targetET"]) + variance

func update(dt: float) -> void:
	if finished:
		return

	_elapsed += dt
	var t := _elapsed
	var et := _target_et
	var dist_next := Constants.QUARTER_MILE_METERS * pow(minf(t, et) / et, 1.8)
	speed = maxf(0.0, (dist_next - distance) / dt)
	distance = dist_next

	if distance >= Constants.QUARTER_MILE_METERS and not finished:
		finished = true
		finish_time = _elapsed

func get_state() -> Dictionary:
	return {
		"rpm": 0.0,
		"speed": speed,
		"distance": distance,
		"gear": 0,
		"nitro_remaining": 0.0,
		"nitro_active": false,
		"rev_limiter_active": false,
		"finished": finished,
		"finish_time": finish_time,
	}
