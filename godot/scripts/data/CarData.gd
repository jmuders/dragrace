extends Node

# ── Stat → physics lookup tables ───────────────────────────────────────────────

const POWER_TORQUE := [280.0, 350.0, 420.0, 520.0, 640.0]
const WEIGHT_MASS  := [1600.0, 1450.0, 1200.0, 980.0, 780.0]
const AERO_DRAG_COEFF := [0.50, 0.38, 0.28, 0.20, 0.13]

const GRIP_MAP := [
	{ "perfectLow": 5000.0, "perfectHigh": 5200.0, "goodLow": 4600.0, "goodHigh": 5800.0, "wheelspinPenalty": 0.50, "bogPenalty": 0.57 },
	{ "perfectLow": 4900.0, "perfectHigh": 5400.0, "goodLow": 4300.0, "goodHigh": 6000.0, "wheelspinPenalty": 0.58, "bogPenalty": 0.63 },
	{ "perfectLow": 4800.0, "perfectHigh": 5600.0, "goodLow": 4000.0, "goodHigh": 6200.0, "wheelspinPenalty": 0.65, "bogPenalty": 0.68 },
	{ "perfectLow": 4600.0, "perfectHigh": 5800.0, "goodLow": 3800.0, "goodHigh": 6400.0, "wheelspinPenalty": 0.73, "bogPenalty": 0.74 },
	{ "perfectLow": 4400.0, "perfectHigh": 6000.0, "goodLow": 3600.0, "goodHigh": 6600.0, "wheelspinPenalty": 0.80, "bogPenalty": 0.82 },
]

const SHIFT_MAP := [
	{ "perfectWindow":  80.0, "goodWindow":  280.0 },
	{ "perfectWindow": 140.0, "goodWindow":  440.0 },
	{ "perfectWindow": 200.0, "goodWindow":  600.0 },
	{ "perfectWindow": 300.0, "goodWindow":  800.0 },
	{ "perfectWindow": 400.0, "goodWindow": 1050.0 },
]

# ── Car definitions ────────────────────────────────────────────────────────────
# Each entry: { type, name, tagline, stats: {power,weight,grip,shift,aero}, physics: {...} }

const RAW_CARS := [
	# Balanced / Beginner-friendly
	{ "type": "silver",        "name": "SILBER DREIER",      "tagline": "The Bavarian sport sedan",        "stats": { "power": 3, "weight": 3, "grip": 3, "shift": 4, "aero": 3 } },
	{ "type": "gray_roadster", "name": "PEWTER SPYDER",      "tagline": "Open-air Stuttgart precision",    "stats": { "power": 3, "weight": 4, "grip": 4, "shift": 5, "aero": 3 } },
	{ "type": "orange_supra",  "name": "TANGERINE SHOGUN",   "tagline": "Inline-six JDM warrior",         "stats": { "power": 3, "weight": 3, "grip": 3, "shift": 5, "aero": 3 } },
	{ "type": "red_rx7",       "name": "CRIMSON HELIX 7",    "tagline": "Rotary-spinning JDM icon",       "stats": { "power": 3, "weight": 4, "grip": 3, "shift": 5, "aero": 3 } },
	# Lightweight specialists
	{ "type": "yellow_lotus",  "name": "CITRINE ELARA",      "tagline": "Featherweight corner scalpel",   "stats": { "power": 2, "weight": 5, "grip": 5, "shift": 5, "aero": 2 } },
	{ "type": "red_roadster",  "name": "CRIMSON BARCHETTA",  "tagline": "Italian open-top elegance",      "stats": { "power": 2, "weight": 5, "grip": 3, "shift": 4, "aero": 3 } },
	# Mid-engine GT
	{ "type": "red",           "name": "SCARLET ACHT",       "tagline": "Mid-engine Germanic fury",       "stats": { "power": 4, "weight": 3, "grip": 4, "shift": 4, "aero": 3 } },
	{ "type": "red_hyper",     "name": "ROSSO CAVALLO HY",   "tagline": "Hybrid prancing horse",          "stats": { "power": 5, "weight": 3, "grip": 4, "shift": 4, "aero": 4 } },
	{ "type": "blue_gt40",     "name": "INDIGO APEX 40",     "tagline": "Le Mans endurance legend",       "stats": { "power": 4, "weight": 4, "grip": 3, "shift": 3, "aero": 4 } },
	{ "type": "blue_porsche",  "name": "COBALT BOXER GT",    "tagline": "Flat-six Stuttgart hypercar",    "stats": { "power": 4, "weight": 4, "grip": 5, "shift": 5, "aero": 4 } },
	# Supercars
	{ "type": "green",         "name": "VERDE GALLETTO",     "tagline": "Baby bull with a big bite",      "stats": { "power": 5, "weight": 3, "grip": 3, "shift": 3, "aero": 4 } },
	{ "type": "orange",        "name": "AMBER EXTREMA",      "tagline": "Track weapon, zero compromise",  "stats": { "power": 5, "weight": 3, "grip": 4, "shift": 3, "aero": 4 } },
	{ "type": "red_f40",       "name": "ROSSO QUARANTA",     "tagline": "Twin-turbo Italian legend",      "stats": { "power": 5, "weight": 3, "grip": 2, "shift": 3, "aero": 3 } },
	{ "type": "lime_super",    "name": "ACID TORO",          "tagline": "Raging V12 Italian bull",        "stats": { "power": 5, "weight": 2, "grip": 3, "shift": 2, "aero": 4 } },
	# American muscle
	{ "type": "blue_cobra",    "name": "AZURE MAMBA",        "tagline": "Classic American serpent",       "stats": { "power": 4, "weight": 2, "grip": 1, "shift": 2, "aero": 2 } },
	{ "type": "blue_viper",    "name": "COBALT ANACONDA",    "tagline": "V10 American predator",          "stats": { "power": 5, "weight": 2, "grip": 2, "shift": 2, "aero": 3 } },
	{ "type": "yellow_muscle", "name": "SOLAR PONY",         "tagline": "American V8 pony car",           "stats": { "power": 4, "weight": 2, "grip": 1, "shift": 3, "aero": 2 } },
	# Hypercars
	{ "type": "black_hyper",   "name": "PHANTOM SEIZE",      "tagline": "W16 French hypermachine",        "stats": { "power": 5, "weight": 2, "grip": 3, "shift": 4, "aero": 5 } },
	{ "type": "dark_hyper",    "name": "NORDIC WRAITH",      "tagline": "Scandinavian speed phantom",     "stats": { "power": 5, "weight": 3, "grip": 3, "shift": 3, "aero": 5 } },
	{ "type": "orange_mclaren","name": "COPPER APEX ONE",    "tagline": "F1-derived speed icon",          "stats": { "power": 5, "weight": 4, "grip": 3, "shift": 4, "aero": 5 } },
	{ "type": "white_proto",   "name": "IVORY VALKYRE",      "tagline": "Aero-sculpted track demon",      "stats": { "power": 4, "weight": 5, "grip": 4, "shift": 4, "aero": 5 } },
]

# Maps engine type per car (matches EngineSound.gd CAR_ENGINE_TYPE)
const CAR_ENGINE_TYPE := {
	"silver":         "inline6",
	"gray_roadster":  "flat6",
	"orange_supra":   "inline6",
	"red_rx7":        "rotary",
	"yellow_lotus":   "inline4",
	"red_roadster":   "v8",
	"red":            "v8",
	"red_hyper":      "hybrid",
	"blue_gt40":      "v8",
	"blue_porsche":   "flat6",
	"green":          "v10",
	"orange":         "v10",
	"red_f40":        "v8_turbo",
	"lime_super":     "v12",
	"blue_cobra":     "v8_muscle",
	"blue_viper":     "v10",
	"yellow_muscle":  "v8_muscle",
	"black_hyper":    "w16",
	"dark_hyper":     "v8_turbo",
	"orange_mclaren": "v8_turbo",
	"white_proto":    "hybrid",
}

var CAR_DATA: Array = []

func _ready() -> void:
	for raw in RAW_CARS:
		var entry = raw.duplicate(true)
		entry["physics"] = build_physics(raw["stats"])
		CAR_DATA.append(entry)

static func build_physics(stats: Dictionary) -> Dictionary:
	var g = GRIP_MAP[stats["grip"] - 1]
	var h = SHIFT_MAP[stats["shift"] - 1]
	return {
		"torqueNm":           POWER_TORQUE[stats["power"] - 1],
		"massKg":             WEIGHT_MASS[stats["weight"] - 1],
		"aeroDragCoeff":      AERO_DRAG_COEFF[stats["aero"] - 1],
		"wheelspinPenalty":   g["wheelspinPenalty"],
		"bogPenalty":         g["bogPenalty"],
		"launchPerfectLow":   g["perfectLow"],
		"launchPerfectHigh":  g["perfectHigh"],
		"launchGoodLow":      g["goodLow"],
		"launchGoodHigh":     g["goodHigh"],
		"shiftPerfectWindow": h["perfectWindow"],
		"shiftGoodWindow":    h["goodWindow"],
	}

func get_car_entry(type: String) -> Dictionary:
	for entry in CAR_DATA:
		if entry["type"] == type:
			return entry
	return CAR_DATA[0]

func get_car_physics_config(type: String) -> Dictionary:
	return get_car_entry(type)["physics"]

func get_engine_type(type: String) -> String:
	return CAR_ENGINE_TYPE.get(type, "inline6")
