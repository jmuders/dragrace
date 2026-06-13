extends GutTest

# CarData is a Node that populates CAR_DATA in _ready().
# We use GameState.car_data (autoload) for instance methods,
# and call CarData.build_physics() as a static function directly.

const VALID_STAT_RANGE_MIN := 1
const VALID_STAT_RANGE_MAX := 5


# ── build_physics (static) ─────────────────────────────────────────────────────

func test_build_physics_returns_required_keys() -> void:
	var stats := { "power": 3, "weight": 3, "grip": 3, "shift": 3, "aero": 3 }
	var physics := CarData.build_physics(stats)
	assert_has(physics, "torqueNm")
	assert_has(physics, "massKg")
	assert_has(physics, "aeroDragCoeff")
	assert_has(physics, "wheelspinPenalty")
	assert_has(physics, "bogPenalty")
	assert_has(physics, "launchPerfectLow")
	assert_has(physics, "launchPerfectHigh")
	assert_has(physics, "launchGoodLow")
	assert_has(physics, "launchGoodHigh")
	assert_has(physics, "shiftPerfectWindow")
	assert_has(physics, "shiftGoodWindow")

func test_build_physics_torque_positive() -> void:
	var physics := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 3, "aero": 3 })
	assert_gt(physics["torqueNm"], 0.0)

func test_build_physics_mass_positive() -> void:
	var physics := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 3, "aero": 3 })
	assert_gt(physics["massKg"], 0.0)

func test_build_physics_torque_increases_with_power() -> void:
	var low  := CarData.build_physics({ "power": 1, "weight": 3, "grip": 3, "shift": 3, "aero": 3 })
	var high := CarData.build_physics({ "power": 5, "weight": 3, "grip": 3, "shift": 3, "aero": 3 })
	assert_gt(high["torqueNm"], low["torqueNm"],
		"Higher power stat should produce more torque")

func test_build_physics_mass_decreases_with_weight_stat() -> void:
	# Confusingly, weight stat 5 = lightest (featherweight)
	var heavy := CarData.build_physics({ "power": 3, "weight": 1, "grip": 3, "shift": 3, "aero": 3 })
	var light := CarData.build_physics({ "power": 3, "weight": 5, "grip": 3, "shift": 3, "aero": 3 })
	assert_lt(light["massKg"], heavy["massKg"],
		"Weight stat 5 should give lower mass than weight stat 1")

func test_build_physics_aero_drag_decreases_with_aero_stat() -> void:
	var low  := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 3, "aero": 1 })
	var high := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 3, "aero": 5 })
	assert_lt(high["aeroDragCoeff"], low["aeroDragCoeff"],
		"Higher aero stat should give lower drag coefficient")

func test_build_physics_shift_window_increases_with_shift_stat() -> void:
	var low  := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 1, "aero": 3 })
	var high := CarData.build_physics({ "power": 3, "weight": 3, "grip": 3, "shift": 5, "aero": 3 })
	assert_gt(high["shiftPerfectWindow"], low["shiftPerfectWindow"],
		"Higher shift stat should give a wider perfect-shift window")


# ── CAR_DATA contents (via GameState.car_data autoload) ───────────────────────

func test_all_21_cars_present() -> void:
	assert_eq(GameState.car_data.CAR_DATA.size(), 21,
		"Should have exactly 21 cars defined")

func test_all_cars_have_required_keys() -> void:
	for entry in GameState.car_data.CAR_DATA:
		assert_has(entry, "type")
		assert_has(entry, "name")
		assert_has(entry, "stats")
		assert_has(entry, "physics")

func test_all_stat_values_in_valid_range() -> void:
	for entry in GameState.car_data.CAR_DATA:
		var stats: Dictionary = entry["stats"]
		for key in ["power", "weight", "grip", "shift", "aero"]:
			var val: int = stats[key]
			assert_between(val, VALID_STAT_RANGE_MIN, VALID_STAT_RANGE_MAX,
				"Stat '%s' on car '%s' must be 1-5" % [key, entry["type"]])


# ── get_car_entry ──────────────────────────────────────────────────────────────

func test_get_car_entry_returns_correct_type() -> void:
	var entry := GameState.car_data.get_car_entry("silver")
	assert_eq(entry["type"], "silver")

func test_get_car_entry_fallback_for_unknown_type() -> void:
	var entry := GameState.car_data.get_car_entry("DOES_NOT_EXIST")
	assert_eq(entry, GameState.car_data.CAR_DATA[0],
		"Unknown car type should fall back to first car")


# ── get_car_physics_config ─────────────────────────────────────────────────────

func test_get_car_physics_config_returns_physics_dict() -> void:
	var physics := GameState.car_data.get_car_physics_config("silver")
	assert_has(physics, "torqueNm")
	assert_has(physics, "massKg")
	assert_has(physics, "aeroDragCoeff")


# ── get_engine_type ────────────────────────────────────────────────────────────

func test_get_engine_type_returns_known_type() -> void:
	var engine := GameState.car_data.get_engine_type("silver")
	assert_eq(engine, "inline6")

func test_get_engine_type_default_for_unknown() -> void:
	var engine := GameState.car_data.get_engine_type("UNKNOWN_CAR")
	assert_eq(engine, "inline6",
		"Unknown car type should default to inline6 engine")
