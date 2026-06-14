extends RefCounted
class_name EngineSound

# Procedural engine synthesizer using AudioStreamGenerator.
# Replicates the Web Audio API oscillator graph from EngineSound.ts:
#   main sawtooth + sub (½ freq) + harmonic (2× freq) + LFO AM + optional turbo sine
# All mixed into PCM frames at 44100 Hz.

const SAMPLE_RATE := 44100.0

# Engine profiles (mirrors EngineSound.ts PROFILES)
const PROFILES := {
	"rotary":    { "firing_per_rev": 3.0, "volume": 0.38, "filter_min": 900.0,  "filter_max": 6500.0, "filter_q": 1.5, "pulse_depth": 0.10, "sub_bass_gain": 0.12, "harm_gain": 0.60, "turbo_whistle": false },
	"inline4":   { "firing_per_rev": 2.0, "volume": 0.33, "filter_min": 350.0,  "filter_max": 2900.0, "filter_q": 1.2, "pulse_depth": 0.48, "sub_bass_gain": 0.38, "harm_gain": 0.22, "turbo_whistle": false },
	"inline6":   { "firing_per_rev": 3.0, "volume": 0.38, "filter_min": 560.0,  "filter_max": 3900.0, "filter_q": 0.9, "pulse_depth": 0.22, "sub_bass_gain": 0.42, "harm_gain": 0.20, "turbo_whistle": false },
	"flat6":     { "firing_per_rev": 3.0, "volume": 0.38, "filter_min": 480.0,  "filter_max": 3300.0, "filter_q": 2.8, "pulse_depth": 0.40, "sub_bass_gain": 0.52, "harm_gain": 0.18, "turbo_whistle": false },
	"v8":        { "firing_per_rev": 4.0, "volume": 0.46, "filter_min": 300.0,  "filter_max": 2500.0, "filter_q": 1.4, "pulse_depth": 0.42, "sub_bass_gain": 0.58, "harm_gain": 0.16, "turbo_whistle": false },
	"v8_muscle": { "firing_per_rev": 4.0, "volume": 0.52, "filter_min": 190.0,  "filter_max": 1900.0, "filter_q": 2.3, "pulse_depth": 0.60, "sub_bass_gain": 0.72, "harm_gain": 0.09, "turbo_whistle": false },
	"v8_turbo":  { "firing_per_rev": 4.0, "volume": 0.44, "filter_min": 430.0,  "filter_max": 3600.0, "filter_q": 1.0, "pulse_depth": 0.26, "sub_bass_gain": 0.40, "harm_gain": 0.24, "turbo_whistle": true  },
	"v10":       { "firing_per_rev": 5.0, "volume": 0.48, "filter_min": 410.0,  "filter_max": 4400.0, "filter_q": 1.3, "pulse_depth": 0.26, "sub_bass_gain": 0.32, "harm_gain": 0.40, "turbo_whistle": false },
	"v12":       { "firing_per_rev": 6.0, "volume": 0.48, "filter_min": 510.0,  "filter_max": 5500.0, "filter_q": 0.7, "pulse_depth": 0.13, "sub_bass_gain": 0.26, "harm_gain": 0.50, "turbo_whistle": false },
	"w16":       { "firing_per_rev": 8.0, "volume": 0.50, "filter_min": 290.0,  "filter_max": 2900.0, "filter_q": 1.1, "pulse_depth": 0.17, "sub_bass_gain": 0.54, "harm_gain": 0.28, "turbo_whistle": true  },
	"hybrid":    { "firing_per_rev": 3.0, "volume": 0.34, "filter_min": 620.0,  "filter_max": 4800.0, "filter_q": 0.8, "pulse_depth": 0.15, "sub_bass_gain": 0.18, "harm_gain": 0.44, "turbo_whistle": true  },
}

var _profile: Dictionary
var _player: AudioStreamGeneratorPlayback
var _stream_player: AudioStreamPlayer
var _vol_scale: float
var _master_volume: float = 0.0
var _target_volume: float = 0.0
var _running: bool = false

# Oscillator phases (radians)
var _main_phase: float = 0.0
var _sub_phase: float = 0.0
var _harm_phase: float = 0.0
var _lfo_phase: float = 0.0
var _turbo_phase: float = 0.0

# One-pole IIR low-pass filter state
var _filter_state: float = 0.0
var _filter_coef: float = 0.5

var _current_rpm: float = 1000.0
var _nitro_active: bool = false
var _turbo_freq: float = 1800.0

func _init(engine_type: String = "inline6", pan: float = 0.0, vol_scale: float = 1.0) -> void:
	_profile = PROFILES.get(engine_type, PROFILES["inline6"]).duplicate()
	_profile["volume"] *= vol_scale
	_vol_scale = vol_scale

func setup(parent: Node) -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = SAMPLE_RATE
	gen.buffer_length = 0.1

	_stream_player = AudioStreamPlayer.new()
	_stream_player.stream = gen
	if _profile.get("pan", 0.0) != 0.0:
		_stream_player.bus = "Master"
	parent.add_child(_stream_player)

func engine_start() -> void:
	if _running:
		return
	_running = true
	_stream_player.play()
	_player = _stream_player.get_stream_playback()
	_target_volume = _profile["volume"]

func engine_stop() -> void:
	if not _running:
		return
	_running = false
	_target_volume = 0.0

func update_rpm(rpm: float, nitro: bool) -> void:
	_current_rpm = rpm
	_nitro_active = nitro
	if nitro:
		_target_volume = _profile["volume"] * 1.18
	elif _running:
		_target_volume = _profile["volume"]

func shift_cut() -> void:
	_master_volume = _profile["volume"] * 0.20
	# Will recover naturally via volume smoothing

func fill_buffer() -> void:
	if not _running or _player == null:
		return

	# Smooth volume
	_master_volume = lerp(_master_volume, _target_volume, 0.05)

	var p := _profile
	var freq: float = float(p["firing_per_rev"]) * maxf(_current_rpm, 50.0) / 60.0
	var sub_freq := freq * 0.5
	var harm_freq := freq * 2.0
	var lfo_freq := freq

	# Filter coefficient: one-pole low-pass (approximation)
	var rpm_frac := clampf((_current_rpm - 1000.0) / (8500.0 - 1000.0), 0.0, 1.0)
	var filter_cutoff: float = float(p["filter_min"]) + (float(p["filter_max"]) - float(p["filter_min"])) * pow(rpm_frac, 0.55)
	# IIR coefficient from cutoff: α = 1 - exp(-2π*fc/fs)
	_filter_coef = 1.0 - exp(-TAU * filter_cutoff / SAMPLE_RATE)

	var turbo_freq := 1400.0 + rpm_frac * 8000.0
	var turbo_gain := rpm_frac * (0.11 if _nitro_active else 0.07)
	_turbo_freq = turbo_freq

	var available := _player.get_frames_available()
	var frames_to_fill := mini(available, 512)

	var main_base_gain: float = 1.0 - float(p["pulse_depth"]) * 0.5
	var sub_gain: float = p["sub_bass_gain"]
	var harm_gain: float = p["harm_gain"]
	var pulse_depth: float = p["pulse_depth"]
	var has_turbo: bool = p["turbo_whistle"]

	var inv_sr := 1.0 / SAMPLE_RATE

	for _i in range(frames_to_fill):
		# Main sawtooth (approximated as linear ramp −1→1)
		var main_saw := fposmod(_main_phase / TAU, 1.0) * 2.0 - 1.0
		# Sub sine
		var sub_sin := sin(_sub_phase)
		# Harmonic sine (acts as a triangle substitute)
		var harm_sin := sin(_harm_phase)
		# LFO modulates main gain → cylinder pulse
		var lfo_val := sin(_lfo_phase)
		var main_gain_mod := main_base_gain + pulse_depth * lfo_val

		var raw := main_saw * main_gain_mod + sub_sin * sub_gain + harm_sin * harm_gain

		# Turbo whistle
		if has_turbo:
			raw += sin(_turbo_phase) * turbo_gain

		# One-pole IIR low-pass filter
		_filter_state += _filter_coef * (raw - _filter_state)
		var filtered := _filter_state * _master_volume

		_player.push_frame(Vector2(filtered, filtered))

		# Advance phases
		_main_phase  = fposmod(_main_phase  + TAU * freq        * inv_sr, TAU)
		_sub_phase   = fposmod(_sub_phase   + TAU * sub_freq    * inv_sr, TAU)
		_harm_phase  = fposmod(_harm_phase  + TAU * harm_freq   * inv_sr, TAU)
		_lfo_phase   = fposmod(_lfo_phase   + TAU * lfo_freq    * inv_sr, TAU)
		_turbo_phase = fposmod(_turbo_phase + TAU * turbo_freq  * inv_sr, TAU)

func destroy() -> void:
	_running = false
	if _stream_player and is_instance_valid(_stream_player):
		_stream_player.stop()
		_stream_player.queue_free()


static func estimate_cpu_rpm(speed_ms: float) -> float:
	const MAX_SPEED_MS := 90.0
	const RPM_LOW := 2500.0
	const RPM_HIGH := 7800.0
	const GEARS := 4.0
	var frac := clampf(speed_ms / MAX_SPEED_MS, 0.0, 1.0)
	var gear_frac := fmod(frac * GEARS, 1.0)
	return RPM_LOW + (RPM_HIGH - RPM_LOW) * pow(gear_frac, 0.7)
