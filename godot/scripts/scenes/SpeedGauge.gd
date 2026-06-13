extends Control

const MPH_PER_MS := 2.23694

const G_START := deg_to_rad(150.0)
const G_SWEEP := deg_to_rad(240.0)
const ARC_R   := 40.0
const ARC_W   := 9.0
const MAX_MPH := 200.0

func _draw() -> void:
	var speed_ms: float = get_meta("speed_ms", 0.0)
	var mph := speed_ms * MPH_PER_MS

	var cx     := size.x * 0.5
	var cy     := size.y * 0.50
	var center := Vector2(cx, cy)

	# ── Background arc ─────────────────────────────────────────────────────────
	draw_arc(center, ARC_R, G_START, G_START + G_SWEEP, 48,
		Color(0.11, 0.11, 0.11, 1.0), ARC_W)

	# ── Fill colour ─────────────────────────────────────────────────────────────
	var fill_color: Color
	if mph >= 150.0:
		fill_color = Color.WHITE
	elif mph >= 80.0:
		fill_color = Color(0.0, 1.0, 0.9)
	else:
		fill_color = Color(0.0, 0.6, 0.7)

	# ── Animated fill arc ──────────────────────────────────────────────────────
	if mph > 0.0:
		var frac      := minf(mph / MAX_MPH, 1.0)
		var end_angle := G_START + frac * G_SWEEP
		draw_arc(center, ARC_R, G_START, end_angle, 48,
			Color(fill_color.r, fill_color.g, fill_color.b, 0.18), ARC_W + 5)
		draw_arc(center, ARC_R, G_START, end_angle, 48, fill_color, ARC_W)

	# ── Centre pivot dot ───────────────────────────────────────────────────────
	draw_circle(center, 5.0, Color(0.27, 0.27, 0.27))
	draw_circle(center, 2.5, Color(0.53, 0.53, 0.53))

	# ── Text labels ────────────────────────────────────────────────────────────
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(cx, cy - 2.0),
		str(int(mph)), HORIZONTAL_ALIGNMENT_CENTER, size.x, 11, fill_color)
	draw_string(font, Vector2(cx, cy + 15.0),
		"MPH", HORIZONTAL_ALIGNMENT_CENTER, size.x, 8, Color(0.33, 0.33, 0.33))
	draw_string(font, Vector2(cx, size.y - 4.0),
		"SPEED", HORIZONTAL_ALIGNMENT_CENTER, size.x, 8, Color(0.4, 0.4, 0.4))
