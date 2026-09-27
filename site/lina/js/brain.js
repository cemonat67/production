/**
 * Lina — intent resolver.
 * Product model: Lina = visible assistant, Chatty = conversational capability, ZeroOS = orchestration.
 * If a Chatty resolver is present on the page (window.ZeroChatty.resolve), it is asked first.
 * Otherwise this local, rule-based resolver handles a small, honest set of intents and
 * says plainly when it cannot do something. It never invents a capability.
 */
(function () {
  'use strict';

  function norm(s) {
    return String(s || '').toLocaleLowerCase('tr-TR')
      .replace(/^\s*(lina|lına)[,!.\s]+/i, '')
      .replace(/[?!.]+$/g, '')
      .trim();
  }
  function has(t, words) { return words.some(w => t.indexOf(w) >= 0); }

  async function resolve(rawText) {
    const L = window.Lina;
    const text = norm(rawText);
    if (!text) return { type: 'noop' };

    // Future seam: conversational capability (Chatty) if the host provides it.
    if (window.ZeroChatty && typeof window.ZeroChatty.resolve === 'function') {
      try {
        const r = await window.ZeroChatty.resolve(rawText, { source: 'lina' });
        if (r && r.type) return r;
      } catch (e) { console.warn('[lina.brain] Chatty resolver failed, using local rules', e); }
    }

    // Approval-gated real action: clear the local audit log (ZeroAuditLog.clearLogs exists).
    if (has(text, ['temizle', 'sil']) && has(text, ['hafıza', 'hafiza', 'kayıt', 'kayit', 'denetim', 'log'])) {
      const count = (L.data.auditLog().rows || []).length;
      if (!count) return { type: 'reply', message: 'Silinecek kayıt yok.', detail: 'Bu tarayıcıda denetim kaydı bulunmuyor.' };
      return {
        type: 'approval',
        title: 'Denetim kayıtları silinecek',
        detail: `Bu tarayıcıdaki ${count} denetim kaydı kalıcı olarak silinecek.`,
        run: async () => { window.ZeroAuditLog.clearLogs(); },
        done: 'Denetim kayıtları silindi.'
      };
    }

    // Modules that really exist (real routes).
    for (const m of L.data.MODULES) {
      if (has(text, m.words) && has(text, ['aç', 'ac', 'göster', 'goster', 'git', 'modül', 'modul', 'pasaport', 'dpp'])) {
        return { type: 'open_module', module: m };
      }
    }
    if (has(text, ['modül', 'modul', 'modüller', 'sayfalar'])) return { type: 'modules' };

    // Surfaces
    if (has(text, ['hafıza', 'hafiza', 'memory', 'karar', 'geçmiş', 'gecmis', 'kayıt', 'kayit', 'denetim'])) return { type: 'surface', surface: 'memory' };
    if (has(text, ['bekleyen', 'onay', 'dikkat', 'acil', 'kritik', 'şimdi', 'simdi', 'now', 'sorun'])) return { type: 'surface', surface: 'now' };
    if (has(text, ['ne kaldı', 'ne kaldi', 'bugün', 'bugun', 'iş', 'is ', 'işler', 'isler', 'work', 'görev', 'gorev', 'pasaport'])) return { type: 'surface', surface: 'work' };

    // Contexts that are not connected in this deployment: say so, never fake.
    if (has(text, ['imac', 'i mac'])) return { type: 'reply', message: 'iMac durumu henüz bağlı değil.', detail: 'Cihaz bağlantısı kurulduğunda buradan göreceksin.' };
    if (has(text, ['macbook', 'mac book', 'laptop'])) return { type: 'reply', message: 'MacBook durumu henüz bağlı değil.', detail: 'Cihaz bağlantısı kurulduğunda buradan göreceksin.' };
    if (has(text, ['cihaz', 'device', 'bilgisayar'])) return { type: 'reply', message: 'Henüz bağlı bir cihaz yok.', detail: 'Cihaz bağlantısı kurulduğunda buradan göreceksin.' };
    if (has(text, [' ev', 'ev ', 'evde', 'home', 'evi']) || text === 'ev') return { type: 'reply', message: 'Home henüz bağlı değil.' };
    if (has(text, ['agent', 'ajan', 'ekip'])) return { type: 'reply', message: 'Aktif agent bilgisi mevcut değil.' };
    if (has(text, ['fabrika', 'industrial', 'endüstri', 'endustri', 'makine'])) return { type: 'reply', message: 'Endüstriyel bağlam henüz bağlı değil.' };

    // Conversation basics
    if (has(text, ['merhaba', 'selam', 'günaydın', 'gunaydin', 'iyi akşamlar', 'iyi aksamlar', 'nasılsın', 'nasilsin'])) {
      return { type: 'reply', message: L.data.greeting(), detail: 'Buradayım.' };
    }
    if (has(text, ['yardım', 'yardim', 'neler yapabilirsin', 'ne yapabilirsin', 'help'])) {
      return { type: 'reply', message: 'Şunları yapabilirim.', detail: '“Bugün ne kaldı”, “Bekleyen ne var”, “Hafıza”, ya da bir modül adı söyle: “Garment pasaportunu aç”.' };
    }
    if (has(text, ['teşekkür', 'tesekkur', 'sağ ol', 'sag ol', 'eyvallah'])) return { type: 'reply', message: 'Rica ederim.' };

    return { type: 'unknown', text: rawText };
  }

  window.Lina = window.Lina || {};
  window.Lina.brain = { resolve, norm };
})();
