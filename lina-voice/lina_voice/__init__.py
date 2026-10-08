"""Lina voice engine — local Turkish speech for Zero@System.

Pipeline: audio in → VAD → STT → speaker gate → brain (Ollama / Chatty) → sentencer → TTS → audio out,
with barge-in while speaking and echo rejection so Lina never treats her own voice as a command.
"""

__version__ = "0.1.0"
