extends GutTest

# Simulates a complete race from staging to finish.
# launch_rpm: RPM staged to at the moment the green light fires.
# shift_rpm:  RPM at which the player shifts gears (0 = never shift).
# Returns build_result() dictionary.
func _run_race(difficulty: String, launch_rpm: float, shift_rpm: float) -> Dictionary:
	var sim := RaceSimulation.new(difficulty, "silver")

	# Advance through countdown (RPM drops naturally during staging)
	sim.start_countdown()
	for _i in range(60):
		sim.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
		if sim.is_racing():
			break

	if not sim.is_racing():
		gut.p("WARNING: did not reach RACING phase in _run_race")
		return {}

	# Set desired RPM at the green light, just before the race loop
	sim._car.rpm = launch_rpm

	# Race loop
	for _i in range(4000):
		var do_shift := shift_rpm > 0.0 and sim._car.rpm >= shift_rpm and sim._car.gear < 4
		sim.update({
			"throttle": true,
			"shift": do_shift,
			"nitro": false,
		}, 0.05)
		if sim.is_finished():
			break

	return sim.build_result()


# ── Optimal run beats ROOKIE ───────────────────────────────────────────────────

func test_optimal_run_wins_vs_rookie() -> void:
	var result := _run_race("ROOKIE", 5200.0, 7200.0)
	assert_false(result.is_empty(), "Race should complete")
	assert_true(result["player_won"], "Perfect launch + shifts should beat ROOKIE AI")

func test_optimal_run_player_finishes() -> void:
	var result := _run_race("ROOKIE", 5200.0, 7200.0)
	assert_gt(result["player_time"], 0.0, "Player must actually finish the race")


# ── Launch grade comparisons ───────────────────────────────────────────────────

func test_wheelspin_is_slower_than_perfect_launch() -> void:
	var perfect  := _run_race("ROOKIE", 5200.0, 7200.0)
	var spin     := _run_race("ROOKIE", 8500.0, 7200.0)

	assert_gt(perfect["player_time"], 0.0)
	assert_gt(spin["player_time"], 0.0)
	assert_lt(perfect["player_time"], spin["player_time"],
		"Perfect launch should yield a faster ET than wheelspin")

func test_bog_is_slower_than_perfect_launch() -> void:
	var perfect := _run_race("ROOKIE", 5200.0, 7200.0)
	var bog     := _run_race("ROOKIE", 1000.0, 7200.0)

	assert_gt(perfect["player_time"], 0.0)
	assert_gt(bog["player_time"], 0.0)
	assert_lt(perfect["player_time"], bog["player_time"],
		"Perfect launch should yield a faster ET than bog")

func test_perfect_launch_grade_recorded() -> void:
	var result := _run_race("ROOKIE", 5200.0, 7200.0)
	assert_eq(result["launch_grade"], Car.LaunchGrade.PERFECT)

func test_wheelspin_launch_grade_recorded() -> void:
	var result := _run_race("ROOKIE", 8500.0, 0.0)
	assert_eq(result["launch_grade"], Car.LaunchGrade.WHEELSPIN)

func test_bog_launch_grade_recorded() -> void:
	var result := _run_race("ROOKIE", 1000.0, 0.0)
	assert_eq(result["launch_grade"], Car.LaunchGrade.BOG)


# ── Shift event recording ──────────────────────────────────────────────────────

func test_shift_events_recorded_when_shifting() -> void:
	var result := _run_race("ROOKIE", 5200.0, 7200.0)
	assert_true(result["shift_events"].size() > 0,
		"Gear shifts should be recorded during a race")

func test_no_shift_events_when_never_shifting() -> void:
	var result := _run_race("ROOKIE", 5200.0, 0.0)
	assert_eq(result["shift_events"].size(), 0,
		"No shift events when player never shifts")


# ── Difficulty scaling ─────────────────────────────────────────────────────────

func test_elite_opponent_is_faster_than_rookie_opponent() -> void:
	# Both races: player does nothing (no throttle after launch check)
	# so opponent time reflects pure AI performance
	var sim_rookie := RaceSimulation.new("ROOKIE", "silver")
	sim_rookie.start_countdown()
	for _i in range(4000):
		sim_rookie.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
		if sim_rookie.is_finished():
			break
	var rookie_result := sim_rookie.build_result()

	var sim_elite := RaceSimulation.new("ELITE", "silver")
	sim_elite.start_countdown()
	for _i in range(4000):
		sim_elite.update({"throttle": false, "shift": false, "nitro": false}, 0.05)
		if sim_elite.is_finished():
			break
	var elite_result := sim_elite.build_result()

	assert_gt(rookie_result["opponent_time"], 0.0)
	assert_gt(elite_result["opponent_time"], 0.0)
	assert_lt(elite_result["opponent_time"], rookie_result["opponent_time"],
		"ELITE opponent should finish faster than ROOKIE opponent")
