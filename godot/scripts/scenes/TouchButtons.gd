extends Control

const _THROTTLE_RECT := Rect2(3, 302, 155, 135)
const _SHIFT_RECT    := Rect2(643, 284, 155, 72)
const _NITRO_RECT    := Rect2(643, 365, 155, 72)

const _COL_THROTTLE := Color(0.2, 0.4, 1.0)
const _COL_SHIFT    := Color(1.0, 0.67, 0.0)
const _COL_NITRO    := Color(0.0, 0.8, 1.0)

func _draw() -> void:
	var throttle: bool = get_meta("throttle_active", false)
	var shift: bool    = get_meta("shift_active",    false)
	var nitro: bool    = get_meta("nitro_active",    false)

	_draw_btn(_THROTTLE_RECT, _COL_THROTTLE, "▲", "THROTTLE", "HOLD", throttle)
	_draw_btn(_SHIFT_RECT,    _COL_SHIFT,    "◆", "SHIFT",    "TAP",  shift)
	_draw_btn(_NITRO_RECT,    _COL_NITRO,    "★", "NITRO",    "HOLD", nitro)

func _draw_btn(rect: Rect2, col: Color, icon: String, label: String, sub: String, active: bool) -> void:
	var fill_a   := 0.72 if active else 0.28
	var border_a := 1.00 if active else 0.55

	draw_rect(rect, Color(col.r, col.g, col.b, fill_a))
	draw_rect(rect, Color(col.r, col.g, col.b, border_a), false, 2.0)

	var font      := ThemeDB.fallback_font
	var lx        := rect.position.x
	var w         := rect.size.x
	var cy        := rect.position.y + rect.size.y * 0.5
	var txt_color := Color(1.0, 1.0, 1.0, 0.95 if active else 0.80)
	var sub_color := Color(0.8, 0.9, 1.0, 0.75 if active else 0.55)

	draw_string(font, Vector2(lx, cy - 14), icon,  HORIZONTAL_ALIGNMENT_CENTER, w, 18, txt_color)
	draw_string(font, Vector2(lx, cy +  5), label, HORIZONTAL_ALIGNMENT_CENTER, w, 12, txt_color)
	draw_string(font, Vector2(lx, cy + 18), sub,   HORIZONTAL_ALIGNMENT_CENTER, w,  9, sub_color)
