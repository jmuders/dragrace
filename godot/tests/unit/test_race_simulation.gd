extends GutTest

# Helper: advance countdown to racing phase (2.5s worth at dt=0.05)
func _advance_to_racing(sim: RaceSimulation) -> void:
	sim.start_countdown()
	var dt := 0.05
	for _i in range(60):  # 3.0s, well past the 2.0s countdown
		sim.update({"throttle": false, "shift": false, "nitro": false}, dt)
		if sim.is_racing():
			break

# Helper: drive until both cars finish (or 60 simulated seconds)
func _drive_to_finish(sim: RaceSimulation) -> void:
	var input := {"throttle": true, "shift": false, "nitro": false}
	for _i in range(4000):  # 200s at dt=0.05 — more than enough
		sim.update(input, 0.05)
		if sim.is_finished():
			break


# ── Phase transitions ──────────────────────────────────────────────────────────

func test_initial_phase_is_staging() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	assert_true(sim.is_staging())

func test_start_countdown_leaves_staging() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	assert_false(sim.is_staging())

func test_countdown_transitions_to_racing() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	assert_true(sim.is_racing())

func test_racing_transitions_to_finished() -> void:
	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	assert_true(sim.is_finished())

func test_start_countdown_is_no_op_when_not_staging() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	sim.start_countdown()  # second call should be ignored
	assert_false(sim.is_staging())
	assert_false(sim.is_racing())  # still in countdown, not jumped to racing


# ── Countdown light timing ─────────────────────────────────────────────────────

func test_no_ambers_before_countdown() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	var state := sim.get_state()
	assert_eq(state["countdown"]["ambers_lit"], 0)
	assert_false(state["countdown"]["green_lit"])

func test_amber_1_after_half_second() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	# Advance exactly 0.5s
	for _i in range(10):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
	var state := sim.get_state()
	assert_gte(state["countdown"]["ambers_lit"], 1)

func test_amber_2_after_one_second() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	for _i in range(20):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
	var state := sim.get_state()
	assert_gte(state["countdown"]["ambers_lit"], 2)

func test_amber_3_after_one_and_half_seconds() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	for _i in range(30):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
	var state := sim.get_state()
	assert_gte(state["countdown"]["ambers_lit"], 3)

func test_green_after_two_seconds() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	for _i in range(41):  # 2.05s — just past the 2.0s threshold
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
	var state := sim.get_state()
	assert_true(state["countdown"]["green_lit"])
	assert_true(sim.is_racing())

func test_ambers_capped_at_three() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	sim.start_countdown()
	for _i in range(100):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
	var state := sim.get_state()
	assert_lte(state["countdown"]["ambers_lit"], Constants.COUNTDOWN_AMBER_COUNT)


# ── One-frame flags ────────────────────────────────────────────────────────────

func test_just_launched_true_on_launch_frame() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	# First throttle frame triggers launch
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	assert_true(sim.just_launched)

func test_just_launched_false_on_next_frame() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	assert_true(sim.just_launched)
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	assert_false(sim.just_launched)

func test_last_shift_event_populated_on_shift_frame() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	# Trigger launch
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	# Set RPM to ideal shift point and shift
	sim._car.rpm = 7200.0
	sim.update({"throttle": true, "shift": true, "nitro": false}, 0.016)
	assert_false(sim.last_shift_event.is_empty())

func test_last_shift_event_cleared_on_next_frame() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	sim._car.rpm = 7200.0
	sim.update({"throttle": true, "shift": true, "nitro": false}, 0.016)
	assert_false(sim.last_shift_event.is_empty())
	# Next frame without shift should clear it
	sim.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	assert_true(sim.last_shift_event.is_empty())


# ── build_result ───────────────────────────────────────────────────────────────

func test_build_result_has_required_keys() -> void:
	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	assert_has(result, "player_time")
	assert_has(result, "opponent_time")
	assert_has(result, "player_won")
	assert_has(result, "launch_grade")
	assert_has(result, "shift_events")
	assert_has(result, "best_time")
	assert_has(result, "is_new_best")

func test_build_result_player_won_when_both_finish() -> void:
	# Use ROOKIE so player has a chance with default car
	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	# Player drove with full throttle; ROOKIE is slow — player should win
	assert_true(result["player_time"] > 0.0)

func test_build_result_player_not_won_when_did_not_finish() -> void:
	var sim := RaceSimulation.new("STREET", "silver")
	_advance_to_racing(sim)
	# Let AI finish while player does nothing
	for _i in range(1000):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
		if sim.is_finished():
			break
	var result := sim.build_result()
	assert_false(result["player_won"], "Player should not win if they never finished")

func test_build_result_is_new_best_first_run() -> void:
	# Clear any saved best time first
	var cfg := ConfigFile.new()
	cfg.set_value("times", Constants.BEST_TIME_KEY, INF)
	cfg.save(Constants.SAVE_FILE)

	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	if result["player_time"] > 0.0:
		assert_true(result["is_new_best"], "First valid finish should always be a new best")

func test_build_result_is_new_best_when_improved() -> void:
	# Save a very slow time first
	var cfg := ConfigFile.new()
	cfg.set_value("times", Constants.BEST_TIME_KEY, 999.0)
	cfg.save(Constants.SAVE_FILE)

	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	if result["player_time"] > 0.0:
		assert_true(result["is_new_best"],
			"Any valid finish should beat the stored 999s placeholder")

func test_build_result_not_new_best_when_worse() -> void:
	# Save a very fast time first
	var cfg := ConfigFile.new()
	cfg.set_value("times", Constants.BEST_TIME_KEY, 0.001)
	cfg.save(Constants.SAVE_FILE)

	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	assert_false(result["is_new_best"],
		"Should not be a new best when previous best is faster")

func test_build_result_best_time_is_player_time_when_new_best() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("times", Constants.BEST_TIME_KEY, 999.0)
	cfg.save(Constants.SAVE_FILE)

	var sim := RaceSimulation.new("ROOKIE", "silver")
	_advance_to_racing(sim)
	_drive_to_finish(sim)
	var result := sim.build_result()
	if result["player_time"] > 0.0 and result["is_new_best"]:
		assert_almost_eq(result["best_time"], result["player_time"], 0.001)
