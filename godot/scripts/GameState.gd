extends Node

var selected_car_type: String = "silver"
var selected_difficulty: String = "STREET"
var last_result: Dictionary = {}

# Shared references so scenes don't reload data
var car_data: CarData

func _ready() -> void:
	car_data = CarData.new()
	car_data.name = "CarData"
	add_child(car_data)

func get_best_time() -> float:
	var cfg := ConfigFile.new()
	if cfg.load(Constants.SAVE_FILE) == OK:
		return cfg.get_value("times", Constants.BEST_TIME_KEY, 0.0)
	return 0.0
