extends GutTest


# ── Initial state ──────────────────────────────────────────────────────────────

func test_initial_distance_is_zero() -> void:
	var ai := AIOpponent.new("STREET")
	assert_almost_eq(ai.distance, 0.0, 0.001)

func test_initial_finished_is_false() -> void:
	var ai := AIOpponent.new("STREET")
	assert_false(ai.finished)

func test_initial_finish_time_is_zero() -> void:
	var ai := AIOpponent.new("STREET")
	assert_almost_eq(ai.finish_time, 0.0, 0.001)


# ── Kinematic model ────────────────────────────────────────────────────────────

func test_distance_at_target_et_equals_quarter_mile() -> void:
	var ai := AIOpponent.new("STREET")
	var et := ai._target_et
	# Simulate the full target ET in small steps
	var dt := 0.05
	var steps := int(ceil(et / dt)) + 10
	for _i in range(steps):
		ai.update(dt)
	assert_almost_eq(ai.distance, Constants.QUARTER_MILE_METERS, 1.0,
		"Distance should reach quarter mile at target ET")

func test_distance_monotonically_increases() -> void:
	var ai := AIOpponent.new("STREET")
	var prev := ai.distance
	var dt := 0.5
	for _i in range(30):
		ai.update(dt)
		if ai.finished:
			break
		assert_ge(ai.distance, prev, "Distance should not decrease")
		prev = ai.distance

func test_speed_non_negative() -> void:
	var ai := AIOpponent.new("STREET")
	var dt := 0.1
	for _i in range(200):
		ai.update(dt)
		assert_ge(ai.speed, 0.0, "Speed must never be negative")
		if ai.finished:
			break


# ── Finish detection ───────────────────────────────────────────────────────────

func test_finished_flag_set_after_crossing_quarter_mile() -> void:
	var ai := AIOpponent.new("STREET")
	var dt := 0.05
	var max_steps := 1000
	for _i in range(max_steps):
		ai.update(dt)
		if ai.finished:
			break
	assert_true(ai.finished, "AI should finish within reasonable time")
	assert_ge(ai.distance, Constants.QUARTER_MILE_METERS)

func test_finish_time_recorded_when_finished() -> void:
	var ai := AIOpponent.new("STREET")
	var dt := 0.05
	for _i in range(1000):
		ai.update(dt)
		if ai.finished:
			break
	assert_gt(ai.finish_time, 0.0, "Finish time should be positive after finishing")

func test_no_update_after_finished() -> void:
	var ai := AIOpponent.new("STREET")
	var dt := 0.05
	for _i in range(1000):
		ai.update(dt)
		if ai.finished:
			break
	var frozen_distance := ai.distance
	ai.update(dt)
	ai.update(dt)
	assert_almost_eq(ai.distance, frozen_distance, 0.001,
		"Distance should not change after finishing")


# ── Difficulty ET ranges ───────────────────────────────────────────────────────

func test_rookie_et_in_valid_range() -> void:
	for _i in range(10):
		var ai := AIOpponent.new("ROOKIE")
		assert_between(ai._target_et, 14.5, 16.5,
			"ROOKIE ET should be 15.5 ± 1.0")

func test_street_et_in_valid_range() -> void:
	for _i in range(10):
		var ai := AIOpponent.new("STREET")
		assert_between(ai._target_et, 12.0, 13.0,
			"STREET ET should be 12.5 ± 0.5")

func test_pro_et_in_valid_range() -> void:
	for _i in range(10):
		var ai := AIOpponent.new("PRO")
		assert_between(ai._target_et, 10.2, 10.8,
			"PRO ET should be 10.5 ± 0.3")

func test_elite_et_in_valid_range() -> void:
	for _i in range(10):
		var ai := AIOpponent.new("ELITE")
		assert_between(ai._target_et, 8.85, 9.15,
			"ELITE ET should be 9.0 ± 0.15")

func test_unknown_difficulty_uses_default() -> void:
	var ai := AIOpponent.new("NONEXISTENT")
	var default_cfg := Constants.DIFFICULTIES[Constants.DEFAULT_DIFFICULTY_INDEX]
	var variance := float(default_cfg["variance"])
	var target := float(default_cfg["targetET"])
	assert_between(ai._target_et, target - variance, target + variance,
		"Unknown difficulty should fall back to default")


# ── get_state ──────────────────────────────────────────────────────────────────

func test_get_state_has_required_keys() -> void:
	var ai := AIOpponent.new("STREET")
	var state := ai.get_state()
	assert_has(state, "distance")
	assert_has(state, "speed")
	assert_has(state, "finished")
	assert_has(state, "finish_time")
