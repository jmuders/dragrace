extends Control

# Mirror Constants.gd values so this script has no external dependency
const MAX_RPM                  := 8500.0
const LAUNCH_RPM_PERFECT_LOW   := 4800.0
const LAUNCH_RPM_PERFECT_HIGH  := 5600.0
const LAUNCH_RPM_GOOD_LOW      := 4000.0
const LAUNCH_RPM_GOOD_HIGH     := 6200.0
const SHIFT_RPM_IDEAL          := 7200.0
const SHIFT_RPM_PERFECT_WINDOW := 200.0
const SHIFT_RPM_GOOD_WINDOW    := 600.0

# Gauge geometry — matches the TypeScript/Phaser web version
const G_START := deg_to_rad(150.0)   # 8-o'clock start
const G_SWEEP := deg_to_rad(240.0)   # 240° sweep
const ARC_R   := 40.0
const ARC_W   := 9.0

func _draw() -> void:
	var rpm: float       = get_meta("rpm",        0.0)
	var is_racing: bool  = get_meta("is_racing",  false)
	var rev_limiter: bool = get_meta("rev_limiter", false)
	var gear: int        = get_meta("gear",        1)
	var can_shift: bool  = gear < 4

	var cx     := size.x * 0.5
	var cy     := size.y * 0.50
	var center := Vector2(cx, cy)

	# ── Background arc ─────────────────────────────────────────────────────────
	draw_arc(center, ARC_R, G_START, G_START + G_SWEEP, 48,
		Color(0.11, 0.11, 0.11, 1.0), ARC_W)

	# ── Coloured zone bands ────────────────────────────────────────────────────
	_draw_zone(center, LAUNCH_RPM_GOOD_LOW    / MAX_RPM,
	                   LAUNCH_RPM_GOOD_HIGH   / MAX_RPM, Color(0.27, 0.53, 0.0, 0.45))
	_draw_zone(center, LAUNCH_RPM_PERFECT_LOW / MAX_RPM,
	                   LAUNCH_RPM_PERFECT_HIGH/ MAX_RPM, Color(0.0,  0.8,  0.27, 0.65))
	_draw_zone(center, (SHIFT_RPM_IDEAL - SHIFT_RPM_GOOD_WINDOW)    / MAX_RPM,
	                   (SHIFT_RPM_IDEAL + SHIFT_RPM_GOOD_WINDOW)    / MAX_RPM,
	                   Color(1.0, 0.67, 0.0, 0.30))
	_draw_zone(center, (SHIFT_RPM_IDEAL - SHIFT_RPM_PERFECT_WINDOW) / MAX_RPM,
	                   (SHIFT_RPM_IDEAL + SHIFT_RPM_PERFECT_WINDOW) / MAX_RPM,
	                   Color(0.0, 1.0, 0.8, 0.55))

	# ── Fill colour logic (matches TypeScript updateHUD) ───────────────────────
	var fill_color: Color
	if rev_limiter:
		var t := int(Time.get_ticks_msec() / 80)
		fill_color = Color.RED if t % 2 == 0 else Color.ORANGE
	elif is_racing:
		var shift_delta: float = abs(rpm - SHIFT_RPM_IDEAL)
		if can_shift and shift_delta <= SHIFT_RPM_PERFECT_WINDOW:
			fill_color = Color(0.0,  1.0, 0.8)       # cyan  – SHIFT NOW
		elif can_shift and shift_delta <= SHIFT_RPM_GOOD_WINDOW:
			fill_color = Color.YELLOW if rpm < SHIFT_RPM_IDEAL else Color.ORANGE
		elif can_shift and rpm > SHIFT_RPM_IDEAL + SHIFT_RPM_GOOD_WINDOW:
			fill_color = Color(1.0, 0.2, 0.0)         # red-orange – late
		else:
			fill_color = Color(0.27, 0.67, 1.0)       # blue – building RPM
	else:
		# Pre-launch: show launch window colour
		if rpm >= LAUNCH_RPM_PERFECT_LOW and rpm <= LAUNCH_RPM_PERFECT_HIGH:
			fill_color = Color(0.0,  0.87, 0.27)      # bright green – perfect
		elif rpm >= LAUNCH_RPM_GOOD_LOW and rpm <= LAUNCH_RPM_GOOD_HIGH:
			fill_color = Color(0.67, 0.87, 0.0)       # yellow-green – good
		elif rpm > LAUNCH_RPM_GOOD_HIGH:
			fill_color = Color.ORANGE                  # too high
		else:
			fill_color = Color(0.27, 0.53, 1.0)       # blue – too low

	# ── Animated fill arc ──────────────────────────────────────────────────────
	if rpm > 0.0:
		var frac      := minf(rpm / MAX_RPM, 1.0)
		var end_angle := G_START + frac * G_SWEEP
		# Soft glow ring
		draw_arc(center, ARC_R, G_START, end_angle, 48,
			Color(fill_color.r, fill_color.g, fill_color.b, 0.18), ARC_W + 5)
		# Main fill
		draw_arc(center, ARC_R, G_START, end_angle, 48, fill_color, ARC_W)

	# ── Centre pivot dot ───────────────────────────────────────────────────────
	draw_circle(center, 5.0, Color(0.27, 0.27, 0.27))
	draw_circle(center, 2.5, Color(0.53, 0.53, 0.53))

	# ── Text labels ────────────────────────────────────────────────────────────
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(cx, cy - 2.0),
		str(int(rpm)), HORIZONTAL_ALIGNMENT_CENTER, size.x, 11, fill_color)
	draw_string(font, Vector2(cx, cy + 15.0),
		"RPM", HORIZONTAL_ALIGNMENT_CENTER, size.x, 8, Color(0.33, 0.33, 0.33))
	draw_string(font, Vector2(cx, size.y - 4.0),
		"TACH", HORIZONTAL_ALIGNMENT_CENTER, size.x, 8, Color(0.4, 0.4, 0.4))

func _draw_zone(center: Vector2, low_frac: float, high_frac: float, color: Color) -> void:
	var a_low  := G_START + low_frac  * G_SWEEP
	var a_high := G_START + high_frac * G_SWEEP
	draw_arc(center, ARC_R, a_low, a_high, 16, color, ARC_W)
