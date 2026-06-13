extends Node2D

const TRACK_START_X := 60.0
const TRACK_END_X   := 740.0
const TRACK_WIDTH   := TRACK_END_X - TRACK_START_X
const PLAYER_LANE_Y := 155.0
const CPU_LANE_Y    := 275.0
const VIEWPORT_W    := 800.0
const VIEWPORT_H    := 450.0

# Simulation
var _sim: RaceSimulation
var _shift_edge := false

# Input state
var _touch_throttle := false
var _touch_nitro    := false
var _touch_shift_edge := false
var _touch_ids: Dictionary = {}  # zone -> touch id

# Car sprites
@onready var _player_sprite: Sprite2D = $PlayerCar
@onready var _cpu_sprite: Sprite2D    = $CPUCar
@onready var _finish_line: Line2D     = $FinishLine

# HUD nodes
@onready var _rpm_gauge: Control      = $HUD/RPMGauge
@onready var _speed_gauge: Control    = $HUD/SpeedGauge
@onready var _gear_label: Label       = $HUD/GearLabel
@onready var _timer_label: Label      = $HUD/TimerLabel
@onready var _nitro_fill: ColorRect   = $HUD/NitroBar/Fill
@onready var _feedback_label: Label   = $HUD/FeedbackLabel
@onready var _start_btn: Button       = $HUD/StartBtn

# Countdown
@onready var _amber1: ColorRect = $HUD/Countdown/Amber1
@onready var _amber2: ColorRect = $HUD/Countdown/Amber2
@onready var _amber3: ColorRect = $HUD/Countdown/Amber3
@onready var _green:  ColorRect = $HUD/Countdown/Green
@onready var _red_light: ColorRect = $HUD/Countdown/Red

# Touch zones (defined in _ready)
var _throttle_zone: Rect2
var _shift_zone: Rect2
var _nitro_zone: Rect2

# Feedback timer
var _feedback_timer := 0.0

# Audio
var _player_engine: EngineSound
var _cpu_engine: EngineSound

# Tree hide
var _elapsed_race := 0.0
var _trees_hidden := false
var _race_ending := false
@onready var _trees: Node2D = $Track/Trees

func _ready() -> void:
	_sim = RaceSimulation.new(GameState.selected_difficulty, GameState.selected_car_type)

	# Load car textures
	_load_car_texture(_player_sprite, GameState.selected_car_type)
	_load_car_texture(_cpu_sprite, "orange")  # CPU uses a random car visually

	# Touch input zones (landscape 800×450, buttons at bottom)
	_throttle_zone = Rect2(0, 280, 400, 170)
	_shift_zone    = Rect2(400, 170, 400, 140)
	_nitro_zone    = Rect2(400, 310, 400, 140)

	# Engine sounds
	var player_engine_type := GameState.car_data.get_engine_type(GameState.selected_car_type)
	_player_engine = EngineSound.new(player_engine_type, 0.0, 1.0)
	_player_engine.setup(self)
	_cpu_engine = EngineSound.new("v8", 0.15, 0.45)
	_cpu_engine.setup(self)

	Music.set_volume(0.15)
	_player_engine.engine_start()
	_cpu_engine.engine_start()

	_start_btn.show()
	_red_light.modulate = Color.RED

func _load_car_texture(sprite: Sprite2D, car_type: String) -> void:
	var path := "res://assets/cars/car_%s.png" % car_type
	if ResourceLoader.exists(path):
		sprite.texture = load(path)

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_touch(event.position, event.pressed, event.index)
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_S or event.keycode == KEY_ENTER:
			_shift_edge = true

func _handle_touch(pos: Vector2, pressed: bool, idx: int) -> void:
	if pressed:
		if _throttle_zone.has_point(pos):
			_touch_throttle = true
			_touch_ids["throttle"] = idx
		if _shift_zone.has_point(pos):
			_touch_shift_edge = true
			_touch_ids["shift"] = idx
		if _nitro_zone.has_point(pos):
			_touch_nitro = true
			_touch_ids["nitro"] = idx
	else:
		if _touch_ids.get("throttle") == idx:
			_touch_throttle = false
			_touch_ids.erase("throttle")
		if _touch_ids.get("nitro") == idx:
			_touch_nitro = false
			_touch_ids.erase("nitro")

func _process(delta: float) -> void:
	if _sim == null:
		return

	# Build input
	var throttle := Input.is_action_pressed("throttle") or _touch_throttle
	var nitro    := Input.is_action_pressed("nitro") or _touch_nitro
	var shift    := _shift_edge or _touch_shift_edge
	_shift_edge = false
	_touch_shift_edge = false

	var input := { "throttle": throttle, "shift": shift, "nitro": nitro }
	var shifted := _sim.update(input, delta)

	var state := _sim.get_state()
	var player := state["player"]
	var opponent := state["opponent"]

	# Update HUD
	_update_car_positions(player, opponent)
	_update_gauges(player)
	_update_countdown(state["countdown"])
	_update_nitro_bar(player["nitro_remaining"])

	var elapsed: float = state["elapsed"]
	if _sim.is_racing() or _sim.is_finished():
		_timer_label.text = "%.3f" % elapsed

	# Engine audio
	_player_engine.update_rpm(player["rpm"], player["nitro_active"])
	_player_engine.fill_buffer()
	var cpu_rpm := EngineSound.estimate_cpu_rpm(opponent["speed"])
	_cpu_engine.update_rpm(cpu_rpm, false)
	_cpu_engine.fill_buffer()

	if _sim.just_launched:
		_show_launch_feedback(_sim.last_launch_grade)

	if shifted and not _sim.last_shift_event.is_empty():
		_player_engine.shift_cut()
		_show_feedback(_sim.last_shift_event)

	# Race timing visual cues
	if _sim.is_racing():
		_elapsed_race += delta
		if _elapsed_race > 2.5 and not _trees_hidden:
			_trees_hidden = true
			var tween := create_tween()
			tween.tween_property(_trees, "modulate:a", 0.0, 0.6)

	if _sim.is_finished() and not _race_ending:
		_race_ending = true
		await get_tree().create_timer(2.0).timeout
		GameState.last_result = _sim.build_result()
		_player_engine.destroy()
		_cpu_engine.destroy()
		Music.set_volume(0.45)
		get_tree().change_scene_to_file("res://scenes/Results.tscn")

	# Feedback timer
	if _feedback_timer > 0.0:
		_feedback_timer -= delta
		if _feedback_timer <= 0.0:
			_feedback_label.hide()

func _update_car_positions(player: Dictionary, opponent: Dictionary) -> void:
	var p_frac := clampf(player["distance"] / Constants.QUARTER_MILE_METERS, 0.0, 1.0)
	var o_frac := clampf(opponent["distance"] / Constants.QUARTER_MILE_METERS, 0.0, 1.0)
	_player_sprite.position.x = TRACK_START_X + p_frac * TRACK_WIDTH
	_cpu_sprite.position.x    = TRACK_START_X + o_frac * TRACK_WIDTH

func _update_gauges(player: Dictionary) -> void:
	_rpm_gauge.queue_redraw()
	_speed_gauge.queue_redraw()
	_gear_label.text = str(player["gear"]) if player["gear"] > 0 else "-"
	# Pass values via metadata so gauge _draw() can read them
	_rpm_gauge.set_meta("rpm", player["rpm"])
	_rpm_gauge.set_meta("rev_limiter", player["rev_limiter_active"])
	_speed_gauge.set_meta("speed_ms", player["speed"])

func _update_countdown(cd: Dictionary) -> void:
	var ambers := int(cd["ambers_lit"])
	_amber1.modulate.a = 1.0 if ambers >= 1 else 0.2
	_amber2.modulate.a = 1.0 if ambers >= 2 else 0.2
	_amber3.modulate.a = 1.0 if ambers >= 3 else 0.2
	_green.modulate.a  = 1.0 if cd["green_lit"] else 0.2

func _update_nitro_bar(remaining: float) -> void:
	var frac := remaining / Constants.NITRO_DURATION
	_nitro_fill.size.x = 120.0 * frac

func _show_feedback(event: Dictionary) -> void:
	var grade_key: String = event.get("grade_key", "")
	var color := _grade_color(grade_key)
	if event.has("gear"):
		_feedback_label.text = "SHIFT " + grade_key
	else:
		_feedback_label.text = "LAUNCH " + grade_key
	_feedback_label.add_theme_color_override("font_color", color)
	_feedback_label.show()
	_feedback_timer = 1.2
	var tween := create_tween()
	_feedback_label.scale = Vector2(1.4, 1.4)
	tween.tween_property(_feedback_label, "scale", Vector2(1.0, 1.0), 0.15)

func _show_launch_feedback(launch_grade: int) -> void:
	var grade_names := ["PERFECT", "GOOD", "WHEELSPIN", "BOG"]
	var grade_key := grade_names[launch_grade]
	var color := _grade_color(grade_key)
	_feedback_label.text = "LAUNCH " + grade_key
	_feedback_label.add_theme_color_override("font_color", color)
	_feedback_label.show()
	_feedback_timer = 1.2

func _grade_color(key: String) -> Color:
	match key:
		"PERFECT": return Color(0, 1, 0.53)
		"GOOD":    return Color(0.67, 1, 0)
		"EARLY", "BOG":       return Color(1, 0.67, 0)
		"LATE", "WHEELSPIN":  return Color(1, 0.2, 0)
	return Color.WHITE

func _on_start_btn_pressed() -> void:
	_start_btn.hide()
	_sim.start_countdown()
