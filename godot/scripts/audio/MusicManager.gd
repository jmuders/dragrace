extends Node
# Autoload singleton: Music

# Procedural 80s synthwave music using AudioStreamGenerator.
# Mirrors MusicManager.ts: 148 BPM, 4-chord loop (Am-F-C-Em), 32-step pattern.
# Instruments: bass, lead (detuned), pad, kick, snare, hi-hat.

const SAMPLE_RATE := 44100.0
const BPM := 148.0
const STEP_SECONDS := 60.0 / BPM / 2.0  # 16th note duration

# Chord root frequencies (A3=220, F3=174.6, C4=261.6, E3=164.8)
const CHORD_ROOTS := [220.0, 174.614, 261.626, 164.814]
const CHORD_FIFTHS := [330.0, 261.626, 392.0, 246.942]

var _stream_player: AudioStreamPlayer
var _player: AudioStreamGeneratorPlayback
var _playing: bool = false
var _master_volume: float = 0.0
var _target_volume: float = 0.55

# Sequencer state
var _step: int = 0
var _step_time: float = 0.0
var _chord_index: int = 0

# Oscillator phases
var _bass_phase: float = 0.0
var _lead1_phase: float = 0.0
var _lead2_phase: float = 0.0
var _pad_phase: float = 0.0
var _kick_env: float = 0.0
var _snare_env: float = 0.0
var _hihat_env: float = 0.0
var _kick_freq: float = 150.0

func _ready() -> void:
	_setup()

func _setup() -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = SAMPLE_RATE
	gen.buffer_length = 0.15
	_stream_player = AudioStreamPlayer.new()
	_stream_player.stream = gen
	add_child(_stream_player)

func play_music() -> void:
	if _playing:
		return
	_playing = true
	_stream_player.play()
	_player = _stream_player.get_stream_playback()
	_target_volume = 0.55

func stop_music() -> void:
	_playing = false
	_target_volume = 0.0

func set_volume(vol: float) -> void:
	_target_volume = vol

func _process(_delta: float) -> void:
	fill_buffer()

func fill_buffer() -> void:
	if not _playing or _player == null:
		return

	_master_volume = lerp(_master_volume, _target_volume, 0.02)

	var available := _player.get_frames_available()
	var inv_sr := 1.0 / SAMPLE_RATE

	for _i in range(mini(available, 512)):
		# Advance sequencer
		_step_time += inv_sr
		if _step_time >= STEP_SECONDS:
			_step_time -= STEP_SECONDS
			_advance_step()

		var root := CHORD_ROOTS[_chord_index]
		var fifth := CHORD_FIFTHS[_chord_index]

		# Bass (sawtooth arpeggio alternating root/fifth per step)
		var bass_freq := root * 0.5 if (_step % 2 == 0) else fifth * 0.5
		var bass_saw := fposmod(_bass_phase / TAU, 1.0) * 2.0 - 1.0
		_bass_phase = fposmod(_bass_phase + TAU * bass_freq * inv_sr, TAU)

		# Lead (detuned pair, square-wave approximation via sign of sine)
		var lead_freq := root * 2.0
		var lead1 := sign(sin(_lead1_phase)) * 0.5
		var lead2 := sign(sin(_lead2_phase)) * 0.5
		_lead1_phase = fposmod(_lead1_phase + TAU * lead_freq * inv_sr, TAU)
		_lead2_phase = fposmod(_lead2_phase + TAU * (lead_freq * 1.005) * inv_sr, TAU)
		var lead := (lead1 + lead2) * 0.15

		# Pad (triangle approximation)
		var pad_freq := root
		var pad_tri := (2.0 * absf(fposmod(_pad_phase / TAU, 1.0) - 0.5) - 0.5) * 2.0
		_pad_phase = fposmod(_pad_phase + TAU * pad_freq * inv_sr, TAU)
		var pad := pad_tri * 0.12

		# Kick (sine sweep)
		var kick := sin(_kick_phase_val()) * _kick_env * 0.5
		_kick_env *= 0.9997

		# Snare (noise burst)
		var snare := (randf() * 2.0 - 1.0) * _snare_env * 0.3
		_snare_env *= 0.998

		# Hi-hat (high-freq noise burst)
		var hihat := (randf() * 2.0 - 1.0) * _hihat_env * 0.15
		_hihat_env *= 0.9985

		var sample := (bass_saw * 0.4 + lead + pad + kick + snare + hihat) * _master_volume
		sample = clampf(sample, -1.0, 1.0)
		_player.push_frame(Vector2(sample, sample))

var _kick_phase_acc: float = 0.0
func _kick_phase_val() -> float:
	_kick_freq = lerp(_kick_freq, 0.01, 0.003)
	_kick_phase_acc = fposmod(_kick_phase_acc + TAU * _kick_freq / SAMPLE_RATE, TAU)
	return _kick_phase_acc

func _advance_step() -> void:
	_step = (_step + 1) % 32
	_chord_index = (_step / 8) % 4

	# Bass plays on most steps
	# Kick: steps 0, 8, 16, 24 (quarter notes)
	if _step % 8 == 0:
		_kick_env = 1.0
		_kick_freq = 150.0
		_kick_phase_acc = 0.0

	# Snare: steps 4, 12, 20, 28
	if (_step + 4) % 8 == 0:
		_snare_env = 1.0

	# Hi-hat: every other 16th
	if _step % 2 == 0:
		_hihat_env = 0.6
