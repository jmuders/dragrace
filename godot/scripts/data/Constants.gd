extends Node

# ── Track ──────────────────────────────────────────────────────────────────────
const QUARTER_MILE_METERS := 402.336

# ── Engine / gear model ────────────────────────────────────────────────────────
const IDLE_RPM := 1000.0
const MAX_RPM := 8500.0
const PEAK_POWER_RPM := 6500.0
const REV_LIMITER_WINDOW := 200.0

const GEAR_RATIOS := [0.0, 3.5, 2.2, 1.5, 1.1]
const FINAL_DRIVE := 3.9
const TYRE_RADIUS := 0.33
const ENGINE_TORQUE_BASE := 420.0
const CAR_MASS := 1200.0
const AERO_DRAG := 0.28
const ROLLING_RESISTANCE := 70.0
const ENGINE_BRAKING_FORCE := 220.0
const STAGING_RPM_CLIMB := 3500.0
const RPM_DROP_RATE := 4000.0

# ── Launch window ──────────────────────────────────────────────────────────────
const LAUNCH_RPM_PERFECT_LOW := 4800.0
const LAUNCH_RPM_PERFECT_HIGH := 5600.0
const LAUNCH_RPM_GOOD_LOW := 4000.0
const LAUNCH_RPM_GOOD_HIGH := 6200.0

const WHEELSPIN_PENALTY := 0.65
const WHEELSPIN_DURATION := 0.8
const BOG_PENALTY := 0.68
const BOG_DURATION := 0.55

# ── Shifting ───────────────────────────────────────────────────────────────────
const SHIFT_RPM_IDEAL := 7200.0
const SHIFT_RPM_PERFECT_WINDOW := 200.0
const SHIFT_RPM_GOOD_WINDOW := 600.0

const SHIFT_SPEED_LOSS := {
	"PERFECT": 0.00,
	"GOOD":    0.02,
	"EARLY":   0.07,
	"LATE":    0.10,
}

const SHIFT_RPM_DROP_FACTOR := 0.76

# ── Nitrous ────────────────────────────────────────────────────────────────────
const NITRO_DURATION := 3.0
const NITRO_FORCE := 2800.0
const NITRO_RPM_BOOST := 800.0

# ── Countdown ─────────────────────────────────────────────────────────────────
const COUNTDOWN_LIGHT_INTERVAL := 0.5
const COUNTDOWN_AMBER_COUNT := 3

# ── Persistence ────────────────────────────────────────────────────────────────
const BEST_TIME_KEY := "dragrace_best_time"
const SAVE_FILE := "user://dragrace_save.cfg"

# ── AI Difficulties ────────────────────────────────────────────────────────────
const DIFFICULTIES := [
	{
		"key": "ROOKIE", "label": "ROOKIE",
		"description": "Slow opponent — good for learning the ropes",
		"color": Color(0, 0.8, 0.267),
		"targetET": 15.5, "variance": 1.0,
	},
	{
		"key": "STREET", "label": "STREET",
		"description": "Average street racer — solid execution needed",
		"color": Color(1.0, 0.8, 0),
		"targetET": 12.5, "variance": 0.5,
	},
	{
		"key": "PRO", "label": "PRO",
		"description": "Seasoned competitor — near-perfect runs required",
		"color": Color(1.0, 0.533, 0),
		"targetET": 10.5, "variance": 0.3,
	},
	{
		"key": "ELITE", "label": "ELITE",
		"description": "Machine precision — only perfection wins",
		"color": Color(1.0, 0.133, 0),
		"targetET": 9.0, "variance": 0.15,
	},
]
const DEFAULT_DIFFICULTY_INDEX := 1
