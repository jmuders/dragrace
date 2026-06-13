extends Control

const STAT_COLORS := [
	Color(0.9, 0.1, 0.1),   # 1 - red
	Color(1.0, 0.6, 0.0),   # 2 - orange
	Color(0.9, 0.9, 0.0),   # 3 - yellow
	Color(0.6, 1.0, 0.0),   # 4 - lime
	Color(0.0, 1.0, 0.3),   # 5 - green
]

@onready var _car_texture: TextureRect = $Layout/Center/CarPanel/CarVBox/CarTexture
@onready var _car_name: Label = $Layout/Center/CarPanel/CarVBox/CarName
@onready var _car_tagline: Label = $Layout/Center/CarPanel/CarVBox/CarTagline
@onready var _car_counter: Label = $Layout/Center/CarPanel/CarVBox/Counter
@onready var _stat_bars: Array = [
	$Layout/Center/StatsPanel/Power/Bar,
	$Layout/Center/StatsPanel/Weight/Bar,
	$Layout/Center/StatsPanel/Grip/Bar,
	$Layout/Center/StatsPanel/Shift/Bar,
	$Layout/Center/StatsPanel/Aero/Bar,
]

var _index: int = 0
var _cars: Array = []

func _ready() -> void:
	_cars = GameState.car_data.CAR_DATA
	# Restore previous selection
	for i in range(_cars.size()):
		if _cars[i]["type"] == GameState.selected_car_type:
			_index = i
			break
	_refresh()

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_left"):
		_index = (_index - 1 + _cars.size()) % _cars.size()
		_refresh()
	elif event.is_action_pressed("ui_right"):
		_index = (_index + 1) % _cars.size()
		_refresh()
	elif event.is_action_pressed("ui_accept"):
		_select()
	elif event.is_action_pressed("ui_cancel"):
		get_tree().change_scene_to_file("res://scenes/Menu.tscn")

func _refresh() -> void:
	var car: Dictionary = _cars[_index]
	_car_name.text = car["name"]
	_car_tagline.text = car["tagline"]
	_car_counter.text = "%d / %d" % [_index + 1, _cars.size()]

	var tex_path := "res://assets/cars/car_%s.png" % car["type"]
	if ResourceLoader.exists(tex_path):
		_car_texture.texture = load(tex_path)

	var stats: Dictionary = car["stats"]
	var stat_keys := ["power", "weight", "grip", "shift", "aero"]
	for i in range(stat_keys.size()):
		var val: int = stats[stat_keys[i]]
		var bar: ProgressBar = _stat_bars[i]
		bar.value = val
		bar.add_theme_color_override("fill_color", STAT_COLORS[val - 1])

func _select() -> void:
	GameState.selected_car_type = _cars[_index]["type"]
	get_tree().change_scene_to_file("res://scenes/Menu.tscn")

func _on_left_btn_pressed() -> void:
	_index = (_index - 1 + _cars.size()) % _cars.size()
	_refresh()

func _on_right_btn_pressed() -> void:
	_index = (_index + 1) % _cars.size()
	_refresh()

func _on_select_btn_pressed() -> void:
	_select()

func _on_back_btn_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/Menu.tscn")
