/**
 * Lina — voice.
 * Uses the browser's real SpeechRecognition (Safari/Chrome) for transcripts and,
 * when permitted, a real microphone level via Web Audio for the activity bars.
 * If neither is available, the mic button says so; nothing is simulated.
 */
(function () {
  'use strict';

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const supported = !!Recognition;

  let rec = null;
  let active = false;
  let onTranscript = null;
  let onLevel = null;
  let onEnd = null;
  let audio = { ctx: null, stream: null, analyser: null, raf: 0 };

  const ERROR_TEXT = {
    'not-allowed': 'Mikrofon izni verilmedi.',
    'service-not-allowed': 'Mikrofon bu ortamda kullanılamıyor.',
    'audio-capture': 'Mikrofon bulunamadı.',
    'network': 'Bir bağlantı sorunu var.',
    'aborted': null,
    'no-speech': null
  };

  async function startLevelMeter() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      audio = { ctx, stream, analyser, raf: 0 };
      const tick = () => {
        if (!active) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        if (onLevel) onLevel(Math.min(1, rms * 4));
        audio.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      /* No level meter: listening state still shown by text + echo ring. */
    }
  }

  function stopLevelMeter() {
    if (audio.raf) cancelAnimationFrame(audio.raf);
    if (audio.stream) audio.stream.getTracks().forEach(t => t.stop());
    if (audio.ctx && audio.ctx.state !== 'closed') { try { audio.ctx.close(); } catch (e) {} }
    audio = { ctx: null, stream: null, analyser: null, raf: 0 };
    if (onLevel) onLevel(0);
  }

  function start() {
    if (!supported || active) return false;
    const L = window.Lina;
    rec = new Recognition();
    rec.lang = (L.data && L.data.cfg.locale) || 'tr-TR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onstart = () => { active = true; L.state.set('listening'); startLevelMeter(); };
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      if (L.state.is('listening')) L.state.set('listening', { detail: (finalText || interim).trim() });
    };
    rec.onerror = (ev) => {
      const text = ERROR_TEXT.hasOwnProperty(ev.error) ? ERROR_TEXT[ev.error] : 'Ses tanıma çalışmadı.';
      if (text) L.state.set('error', { message: text, detail: 'Tekrar deneyebilirim.' });
      else if (ev.error === 'no-speech') L.state.set('idle', { message: 'Bir şey duyamadım.' });
    };
    rec.onend = () => {
      active = false;
      stopLevelMeter();
      const t = finalText.trim();
      if (t && onTranscript) onTranscript(t);
      else if (L.state.is('listening')) L.state.set('idle');
      if (onEnd) onEnd();
    };
    try { rec.start(); return true; }
    catch (e) { active = false; L.state.set('error', { message: 'Mikrofon başlatılamadı.', detail: 'Tekrar deneyebilirim.' }); return false; }
  }

  function stop() { if (rec && active) { try { rec.stop(); } catch (e) {} } }
  function toggle() { return active ? (stop(), false) : start(); }

  window.Lina = window.Lina || {};
  window.Lina.voice = {
    supported,
    isActive: () => active,
    start, stop, toggle,
    onTranscript: (fn) => { onTranscript = fn; },
    onLevel: (fn) => { onLevel = fn; },
    onEnd: (fn) => { onEnd = fn; }
  };
})();
