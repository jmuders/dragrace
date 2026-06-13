extends Control

@onready var _car_label: Label = $VBox/CarLabel
@onready var _diff_label: Label = $VBox/DiffLabel
@onready var _best_label: Label = $VBox/BestLabel
@onready var _start_btn: Button = $VBox/StartBtn

func _ready() -> void:
	Music.play_music()
	Music.set_volume(0.55)
	_refresh_labels()
	_start_btn.grab_focus()
	var tween := create_tween().set_loops()
	tween.tween_property(_start_btn, "modulate:a", 0.5, 0.6)
	tween.tween_property(_start_btn, "modulate:a", 1.0, 0.6)

func _refresh_labels() -> void:
	var entry := GameState.car_data.get_car_entry(GameState.selected_car_type)
	_car_label.text = "CAR: " + entry.get("name", "?")
	_diff_label.text = "DIFFICULTY: " + GameState.selected_difficulty
	var best := GameState.get_best_time()
	_best_label.text = ("BEST: " + "%.3f" % best + "s") if best > 0.0 else "BEST: --"

func _on_car_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/CarSelection.tscn")

func _on_diff_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Difficulty.tscn")

func _on_start_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Race.tscn")
