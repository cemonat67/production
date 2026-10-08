# Lina Voice Engine

Local Turkish speech for Zero@System. One process, no cloud, no API keys:

```
mic ─▶ VAD (Silero) ─▶ STT (Whisper) ─▶ speaker gate (Cem?) ─▶ brain (Ollama / Chatty route)
                                                                       │
speaker ◀─ playback ◀─ TTS (Pocket TTS Türkçe → Yelda → Piper) ◀─ sentencer ◀┘
```

* **Barge-in**: Lina stops within one audio frame when the enrolled speaker talks over her.
* **No self-triggering**: her own voice leaking back into the mic is rejected twice, by the speaker
  gate (her cloned voice is not Cem's) and by a text echo guard against what she just said.
* **Second turn is automatic**: after playback drains the engine is listening again.
* **One system**: every verified utterance goes to one brain. Point `brain.backend: http` at the app's
  `/api/chatty/local` route so `lina-task-router` runs the real actions and the result is spoken.

## Components and licenses

| Part | Choice | License |
|---|---|---|
| TTS primary | Kyutai Pocket TTS runtime + `kaanhgunay/pocket-tts-tr` Turkish weights (24 layers) | MIT / CC BY 4.0 |
| TTS fallback | Apple `say` with Yelda (install the Premium voice) | Apple |
| TTS emergency | Piper `tr_TR-fahrettin-medium` via sherpa-onnx (optional) | MIT |
| STT | faster-whisper (`small` by default here, `large-v3-turbo` recommended on a Mac); optional mlx-whisper | MIT |
| VAD | Silero VAD via sherpa-onnx | MIT / Apache-2.0 |
| Speaker gate | 3D-Speaker ERes2Net embeddings via sherpa-onnx, cosine threshold | Apache-2.0 |
| Brain | Ollama (local) or the app's own HTTP route | — |

## Install (macOS)

```bash
cd lina-voice
bash scripts/install-mac.sh          # venv, models (~1.4 GB), config, launchd service on 127.0.0.1:8765
.venv/bin/lina-voice doctor          # what is available, which Turkish voices are installed, Ollama up?
```

Reversible: `bash scripts/uninstall-mac.sh` removes the service. The app's existing
`~/Library/Application Support/ZeroRelationship/voice/profile.json` is read at most, never written;
the engine keeps its own state in `…/ZeroRelationship/voice-engine/`.

## First run

```bash
# 1. hear Lina (Pocket TTS Turkish; falls back to Yelda automatically)
.venv/bin/lina-voice say "İyi akşamlar Cem. Bugün açık kalan üç iş var." --play
.venv/bin/lina-voice bench                       # first-audio latency + RTF on three sentences

# 2. give Lina her voice: a clean 10–20 s Turkish clip (NOT Cem's voice)
cp /path/to/lina-voice-sample.wav models/voices/lina-ref.wav

# 3. enroll Cem (3–5 clips of 3–10 s, normal speaking voice, same mic as daily use)
.venv/bin/lina-voice enroll cem cem-1.wav cem-2.wav cem-3.wav
.venv/bin/lina-voice verify cem-4.wav someone-else.wav   # tune speaker.threshold until both are right

# 4. run (foreground) with the Mac mic/speaker, talk to her
bash scripts/run-mac.sh --audio local
```

## Talking to the engine from the app

The launchd service runs in `--audio ws` mode: the app owns the microphone and speaker (so it can
use Apple's voice-processing I/O with echo cancellation) and streams audio:

* `ws://127.0.0.1:8765/audio` — send 16 kHz mono PCM16 frames; receive 24 kHz PCM16 chunks to play
  and `{"type":"stop"}` when playback must be cut immediately.
* `ws://127.0.0.1:8765/events` — JSON events: `state`, `vad_start/vad_end`, `transcript`, `speaker_ok`,
  `rejected_speaker`, `echo_rejected`, `barge_in`, `sentence`, `reply_done` (with latency metrics), `error`.
  Send `{"type":"text","text":"…"}` to run a typed command, `{"type":"interrupt"}` to stop.
* HTTP: `GET /health`, `GET /state`, `POST /say {text}`, `POST /text {text}`, `POST /interrupt`, `POST /mic {enabled}`.

`clients/LinaVoiceClient.swift` and `clients/lina-voice-client.js` are minimal reference clients.
They were written against this protocol but could not be executed here (no macOS); treat them as a
starting point, not as tested code.

## Tests

```bash
.venv/bin/python -m pytest -q                      # offline suite (engine, server, VAD, speaker gate)
.venv/bin/python -m pytest -q -m slow tests/test_roundtrip.py -s   # real models: TTS → VAD → STT
```

What the offline suite proves (fake STT/TTS/brain, real VAD and speaker models):
full turn and automatic second turn; barge-in by the verified speaker cuts playback and the new command
is handled; another speaker cannot interrupt and is rejected; Lina's own words are dropped as echo;
brain failure is spoken as a short error and the engine recovers; HTTP/WebSocket API round trips;
Silero VAD detects real speech and ignores silence/noise; the speaker model accepts an unseen clip of
the enrolled voice and rejects a different voice.

## Known limits (honest)

* Pocket TTS Turkish v0.1 can put a short artifact on the very first syllable and reads foreign words
  with Turkish phonetics. Numbers/dates/times are expanded by `textnorm.py` before synthesis.
* Speed depends entirely on the CPU. Measured in a 4-vCPU Linux container without Apple Silicon:
  see the report in the session; on an M-series Mac expect several times faster, but measure with
  `lina-voice bench` before trusting any number.
* Without hardware echo cancellation (the app's VPIO path) the engine relies on the speaker gate and
  the echo guard; a headset makes barge-in cleanest.
* The speaker model is trained on English VoxCeleb; speaker embeddings are language-independent in
  practice, but the threshold must be tuned on Cem's own recordings.
