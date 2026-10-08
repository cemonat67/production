/**
 * lina-voice-client.js — browser client for the Lina voice engine (ws://127.0.0.1:8765).
 *
 * Captures the mic with echo cancellation enabled, streams 16 kHz PCM16 to /audio, plays returned
 * 24 kHz PCM16 through Web Audio, and flushes playback on {"type":"stop"} (barge-in). Events from
 * /events are forwarded to `onEvent`. Written against the engine protocol; not executed in the
 * environment where it was written. Review in the real app.
 */
export class LinaVoiceClient {
  constructor({ base = "ws://127.0.0.1:8765", onEvent = () => {} } = {}) {
    this.base = base;
    this.onEvent = onEvent;
    this.ctx = null;
    this.playhead = 0;
    this.scheduled = [];
  }

  async start() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.audioWs = new WebSocket(`${this.base}/audio`);
    this.audioWs.binaryType = "arraybuffer";
    this.eventsWs = new WebSocket(`${this.base}/events`);
    this.eventsWs.onmessage = (m) => { try { this.onEvent(JSON.parse(m.data)); } catch {} };
    this.audioWs.onmessage = (m) => {
      if (typeof m.data === "string") { try { if (JSON.parse(m.data).type === "stop") this.flush(); } catch {} return; }
      this.play(new Int16Array(m.data));
    };

    const src = this.ctx.createMediaStreamSource(stream);
    const proc = this.ctx.createScriptProcessor(2048, 1, 1);      // simple; swap for AudioWorklet in production
    src.connect(proc); proc.connect(this.ctx.destination);
    const ratio = this.ctx.sampleRate / 16000;
    proc.onaudioprocess = (e) => {
      if (this.audioWs.readyState !== WebSocket.OPEN) return;
      const inp = e.inputBuffer.getChannelData(0);
      const n = Math.floor(inp.length / ratio);
      const out = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        const v = Math.max(-1, Math.min(1, inp[Math.floor(i * ratio)]));
        out[i] = v < 0 ? v * 32768 : v * 32767;
      }
      this.audioWs.send(out.buffer);
    };
  }

  play(pcm16) {
    const buf = this.ctx.createBuffer(1, pcm16.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm16.length; i++) ch[i] = pcm16[i] / 32768;
    const node = this.ctx.createBufferSource();
    node.buffer = buf; node.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.02, this.playhead);
    node.start(at);
    this.playhead = at + buf.duration;
    this.scheduled.push(node);
    node.onended = () => { this.scheduled = this.scheduled.filter((n) => n !== node); };
  }

  flush() {
    for (const n of this.scheduled) { try { n.stop(); } catch {} }
    this.scheduled = []; this.playhead = 0;
  }

  interrupt() { this.eventsWs?.send(JSON.stringify({ type: "interrupt" })); }
  submitText(text) { this.eventsWs?.send(JSON.stringify({ type: "text", text })); }
  say(text) { this.eventsWs?.send(JSON.stringify({ type: "say", text })); }

  stop() { this.audioWs?.close(); this.eventsWs?.close(); this.ctx?.close(); }
}
