extends GutTest

var car: Car

func before_each() -> void:
	car = Car.new({})


# ── _torque_curve ──────────────────────────────────────────────────────────────

func test_torque_curve_at_idle() -> void:
	assert_almost_eq(car._torque_curve(0.0), 0.42, 0.001)

func test_torque_curve_at_peak() -> void:
	assert_almost_eq(car._torque_curve(6500.0), 1.0, 0.001)

func test_torque_curve_at_redline() -> void:
	assert_almost_eq(car._torque_curve(8500.0), 0.45, 0.001)

func test_torque_curve_monotone_rising() -> void:
	var v0 := car._torque_curve(0.0)
	var v1 := car._torque_curve(2000.0)
	var v2 := car._torque_curve(4000.0)
	var v3 := car._torque_curve(6500.0)
	assert_true(v0 < v1 and v1 < v2 and v2 <= v3,
		"Torque should increase monotonically below peak RPM")

func test_torque_curve_monotone_falling() -> void:
	var v1 := car._torque_curve(6500.0)
	var v2 := car._torque_curve(7500.0)
	var v3 := car._torque_curve(8500.0)
	assert_true(v1 > v2 and v2 > v3,
		"Torque should decrease monotonically above peak RPM")


# ── _evaluate_launch ───────────────────────────────────────────────────────────

func test_evaluate_launch_perfect_center() -> void:
	assert_eq(car._evaluate_launch(5200.0), Car.LaunchGrade.PERFECT)

func test_evaluate_launch_perfect_lower_bound() -> void:
	assert_eq(car._evaluate_launch(4800.0), Car.LaunchGrade.PERFECT)

func test_evaluate_launch_perfect_upper_bound() -> void:
	assert_eq(car._evaluate_launch(5600.0), Car.LaunchGrade.PERFECT)

func test_evaluate_launch_good_lower_bound() -> void:
	assert_eq(car._evaluate_launch(4000.0), Car.LaunchGrade.GOOD)

func test_evaluate_launch_good_upper_bound() -> void:
	assert_eq(car._evaluate_launch(6200.0), Car.LaunchGrade.GOOD)

func test_evaluate_launch_bog() -> void:
	assert_eq(car._evaluate_launch(3999.0), Car.LaunchGrade.BOG)

func test_evaluate_launch_wheelspin() -> void:
	assert_eq(car._evaluate_launch(6201.0), Car.LaunchGrade.WHEELSPIN)


# ── _launch_multiplier_for_grade ───────────────────────────────────────────────

func test_launch_multiplier_perfect() -> void:
	assert_almost_eq(car._launch_multiplier_for_grade(Car.LaunchGrade.PERFECT), 1.08, 0.001)

func test_launch_multiplier_good() -> void:
	assert_almost_eq(car._launch_multiplier_for_grade(Car.LaunchGrade.GOOD), 1.0, 0.001)

func test_launch_multiplier_wheelspin() -> void:
	assert_almost_eq(car._launch_multiplier_for_grade(Car.LaunchGrade.WHEELSPIN), 0.65, 0.001)

func test_launch_multiplier_bog() -> void:
	assert_almost_eq(car._launch_multiplier_for_grade(Car.LaunchGrade.BOG), 0.68, 0.001)


# ── _evaluate_shift ────────────────────────────────────────────────────────────

func test_evaluate_shift_perfect_center() -> void:
	assert_eq(car._evaluate_shift(7200.0), Car.ShiftGrade.PERFECT)

func test_evaluate_shift_perfect_lower_bound() -> void:
	assert_eq(car._evaluate_shift(7000.0), Car.ShiftGrade.PERFECT)

func test_evaluate_shift_perfect_upper_bound() -> void:
	assert_eq(car._evaluate_shift(7400.0), Car.ShiftGrade.PERFECT)

func test_evaluate_shift_good_lower_bound() -> void:
	assert_eq(car._evaluate_shift(6600.0), Car.ShiftGrade.GOOD)

func test_evaluate_shift_good_upper_bound() -> void:
	assert_eq(car._evaluate_shift(7800.0), Car.ShiftGrade.GOOD)

func test_evaluate_shift_early() -> void:
	assert_eq(car._evaluate_shift(6599.0), Car.ShiftGrade.EARLY)

func test_evaluate_shift_late() -> void:
	assert_eq(car._evaluate_shift(7801.0), Car.ShiftGrade.LATE)


# ── update_staging ─────────────────────────────────────────────────────────────

func test_staging_rpm_climbs_with_throttle() -> void:
	var initial := car.rpm
	car.update_staging(true, 1.0)
	assert_gt(car.rpm, initial)

func test_staging_rpm_drops_without_throttle() -> void:
	car.rpm = 5000.0
	car.update_staging(false, 1.5)
	assert_lt(car.rpm, 5000.0)

func test_staging_rpm_clamps_at_idle() -> void:
	car.rpm = 1100.0
	for _i in range(20):
		car.update_staging(false, 1.0)
	assert_almost_eq(car.rpm, Constants.IDLE_RPM, 1.0)

func test_staging_rpm_clamps_at_max() -> void:
	car.rpm = 8000.0
	for _i in range(20):
		car.update_staging(true, 1.0)
	assert_almost_eq(car.rpm, Constants.MAX_RPM, 1.0)


# ── update (race physics) ──────────────────────────────────────────────────────

func test_distance_increases_with_throttle() -> void:
	var input := {"throttle": true, "shift": false, "nitro": false}
	for _i in range(120):
		car.update(input, 0.016)
	assert_gt(car.distance, 0.0)

func test_speed_decreases_on_coast() -> void:
	# Build up speed first
	var input_throttle := {"throttle": true, "shift": false, "nitro": false}
	for _i in range(60):
		car.update(input_throttle, 0.016)
	var peak_speed := car.speed
	# Coast for 1 second
	var input_coast := {"throttle": false, "shift": false, "nitro": false}
	for _i in range(60):
		car.update(input_coast, 0.016)
	assert_lt(car.speed, peak_speed)

func test_shift_event_returned_on_gear_change() -> void:
	# Trigger launch
	car.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	# Set RPM to ideal shift point and trigger shift
	car.rpm = 7200.0
	var event := car.update({"throttle": true, "shift": true, "nitro": false}, 0.016)
	assert_false(event.is_empty(), "Shift event should be returned when shifting")

func test_shift_grade_is_perfect_at_ideal_rpm() -> void:
	car.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	car.rpm = 7200.0
	var event := car.update({"throttle": true, "shift": true, "nitro": false}, 0.016)
	assert_false(event.is_empty())
	assert_eq(event["grade"], Car.ShiftGrade.PERFECT)

func test_no_shift_beyond_gear_4() -> void:
	car.update({"throttle": true, "shift": false, "nitro": false}, 0.016)
	car.gear = 4
	var event := car.update({"throttle": true, "shift": true, "nitro": false}, 0.016)
	assert_true(event.is_empty(), "No shift event when already at gear 4")
	assert_eq(car.gear, 4)

func test_nitro_increases_acceleration() -> void:
	# Car without nitro
	var car_no_nitro := Car.new({})
	var input_plain := {"throttle": true, "shift": false, "nitro": false}
	for _i in range(100):
		car_no_nitro.update(input_plain, 0.016)

	# Car with nitro
	var car_nitro := Car.new({})
	var input_nitro := {"throttle": true, "shift": false, "nitro": true}
	for _i in range(100):
		car_nitro.update(input_nitro, 0.016)

	assert_gt(car_nitro.distance, car_no_nitro.distance,
		"Nitro should result in greater distance")

func test_finished_flag_set_at_quarter_mile() -> void:
	var input := {"throttle": true, "shift": false, "nitro": false}
	# Simulate up to 60 seconds at 60fps (more than enough to finish)
	for _i in range(3600):
		car.update(input, 0.016)
		if car.finished:
			break
	assert_true(car.finished, "Car should finish within 60 seconds")
	assert_ge(car.distance, Constants.QUARTER_MILE_METERS)

func test_finish_time_set_and_stable() -> void:
	var input := {"throttle": true, "shift": false, "nitro": false}
	for _i in range(3600):
		car.update(input, 0.016)
		if car.finished:
			break
	var recorded_time := car.finish_time
	assert_gt(recorded_time, 0.0, "Finish time should be positive")
	# Extra frames should not change finish_time
	for _i in range(60):
		car.update(input, 0.016)
	assert_almost_eq(car.finish_time, recorded_time, 0.001,
		"Finish time should not change after finishing")
