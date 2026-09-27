/**
 * Lina — voice input
 * No native speech bridge exists in this repository, so this adapter uses the
 * browser Web Speech API when present. Unsupported browsers get an honest
 * disabled microphone; text input always works.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.Voice = (function () {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null;
  let active = false;

  function start(handlers) {
    if (!Recognition) { handlers.onError && handlers.onError('unsupported'); return false; }
    if (active) return true;
    rec = new Recognition();
    rec.lang = (window.ZeroLinaConfig && window.ZeroLinaConfig.speechLang) || 'tr-TR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onstart = function () { active = true; handlers.onStart && handlers.onStart(); };
    rec.onresult = function (ev) {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      handlers.onInterim && handlers.onInterim(finalText + interim);
    };
    rec.onerror = function (ev) {
      active = false;
      handlers.onError && handlers.onError(ev.error || 'error');
    };
    rec.onend = function () {
      const wasActive = active;
      active = false;
      handlers.onEnd && handlers.onEnd(wasActive ? finalText.trim() : '');
    };
    try { rec.start(); } catch (e) { active = false; handlers.onError && handlers.onError('start-failed'); return false; }
    return true;
  }

  function stop() {
    if (rec && active) { try { rec.stop(); } catch (e) { /* ignore */ } }
  }

  function abort() {
    if (rec) { active = false; try { rec.abort(); } catch (e) { /* ignore */ } }
  }

  return {
    supported: !!Recognition,
    isActive: function () { return active; },
    start: start,
    stop: stop,
    abort: abort
  };
})();
