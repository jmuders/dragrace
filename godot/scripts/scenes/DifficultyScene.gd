extends Control

@onready var _desc_label: Label = $VBox/DescLabel
@onready var _buttons: Array[Button] = []

var _selected_index: int = Constants.DEFAULT_DIFFICULTY_INDEX

func _ready() -> void:
	var btns_container: VBoxContainer = $VBox/Buttons
	for i in range(Constants.DIFFICULTIES.size()):
		var d: Dictionary = Constants.DIFFICULTIES[i]
		var btn := Button.new()
		btn.text = d["label"] + "  (" + "%.1f" % d["targetET"] + "s ± " + "%.2f" % d["variance"] + ")"
		btn.add_theme_color_override("font_color", d["color"])
		btns_container.add_child(btn)
		_buttons.append(btn)
		var idx := i
		btn.pressed.connect(func(): _on_difficulty_pressed(idx))
		if d["key"] == GameState.selected_difficulty:
			_selected_index = i

	_refresh_selection()

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_up"):
		_selected_index = (_selected_index - 1 + Constants.DIFFICULTIES.size()) % Constants.DIFFICULTIES.size()
		_refresh_selection()
	elif event.is_action_pressed("ui_down"):
		_selected_index = (_selected_index + 1) % Constants.DIFFICULTIES.size()
		_refresh_selection()
	elif event.is_action_pressed("ui_accept"):
		_confirm()
	elif event.is_action_pressed("ui_cancel"):
		get_tree().change_scene_to_file("res://scenes/Menu.tscn")

func _refresh_selection() -> void:
	for i in range(_buttons.size()):
		var d := Constants.DIFFICULTIES[i]
		if i == _selected_index:
			_buttons[i].add_theme_color_override("font_color", Color(0.05, 0.05, 0.05))
			_buttons[i].add_theme_stylebox_override("normal",
				_colored_stylebox(d["color"]))
			_desc_label.text = d["description"]
		else:
			_buttons[i].add_theme_color_override("font_color", d["color"])
			_buttons[i].remove_theme_stylebox_override("normal")

func _colored_stylebox(color: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_left = 4
	sb.corner_radius_bottom_right = 4
	return sb

func _on_difficulty_pressed(idx: int) -> void:
	_selected_index = idx
	_refresh_selection()

func _on_race_btn_pressed() -> void:
	_confirm()

func _on_back_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Menu.tscn")

func _confirm() -> void:
	GameState.selected_difficulty = Constants.DIFFICULTIES[_selected_index]["key"]
	get_tree().change_scene_to_file("res://scenes/Menu.tscn")
