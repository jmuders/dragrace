extends Control

@onready var _banner: Label      = $VBox/Banner
@onready var _player_time: Label = $VBox/PlayerTime
@onready var _cpu_time: Label    = $VBox/CPUTime
@onready var _best_time: Label   = $VBox/BestTime
@onready var _launch: Label      = $VBox/Launch
@onready var _shifts: VBoxContainer = $VBox/Shifts

func _ready() -> void:
	Music.set_volume(0.45)
	var result := GameState.last_result
	if result.is_empty():
		return

	# Banner
	if result["player_won"]:
		_banner.text = "YOU WIN!"
		_banner.add_theme_color_override("font_color", Color(1, 0.53, 0))
	else:
		_banner.text = "YOU LOSE"
		_banner.add_theme_color_override("font_color", Color(0.6, 0.1, 0.1))

	# Times
	_player_time.text = "YOUR TIME:  " + ("%.3f" % result["player_time"]) + "s"
	_cpu_time.text    = "CPU TIME:   " + ("%.3f" % result["opponent_time"]) + "s"

	if result["is_new_best"]:
		_best_time.text = "★ NEW BEST: " + ("%.3f" % result["best_time"]) + "s ★"
		_best_time.add_theme_color_override("font_color", Color(1, 0.8, 0))
		var tween := create_tween().set_loops()
		tween.tween_property(_best_time, "modulate:a", 0.3, 0.5)
		tween.tween_property(_best_time, "modulate:a", 1.0, 0.5)
	else:
		var best := result["best_time"]
		_best_time.text = "BEST: " + ("%.3f" % best) + "s" if best > 0.0 else ""

	# Launch grade
	var launch_names := ["PERFECT", "GOOD", "WHEELSPIN", "BOG"]
	var lgrade := int(result["launch_grade"])
	var lkey := launch_names[lgrade]
	_launch.text = "LAUNCH: " + lkey
	_launch.add_theme_color_override("font_color", _grade_color(lkey))

	# Shift events
	for ev in result["shift_events"]:
		var lbl := Label.new()
		var gk: String = ev.get("grade_key", "")
		lbl.text = "  G%d → %s (%.0f RPM)" % [ev["gear"], gk, ev["rpm"]]
		lbl.add_theme_color_override("font_color", _grade_color(gk))
		_shifts.add_child(lbl)

func _grade_color(key: String) -> Color:
	match key:
		"PERFECT": return Color(0, 1, 0.53)
		"GOOD":    return Color(0.67, 1, 0)
		"EARLY", "BOG":      return Color(1, 0.67, 0)
		"LATE", "WHEELSPIN": return Color(1, 0.2, 0)
	return Color.WHITE

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_tree().change_scene_to_file("res://scenes/Menu.tscn")

func _on_retry_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Difficulty.tscn")

func _on_menu_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Menu.tscn")
