/**
 * Lina — local intent resolution
 * Turns a typed or spoken sentence into a context change or an action.
 * Local rules only; a remote resolver can be attached later via `remoteResolver`.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.Intent = (function () {
  function norm(s) {
    return (s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[’'"“”.,!?;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasAny(text, words) {
    return words.some(function (w) { return text.indexOf(w) !== -1; });
  }

  const MODULE_WORDS = {
    fibre:      ['elyaf', 'fibre', 'fiber', 'lif '],
    yarn:       ['iplik', 'yarn'],
    fabric:     ['kumaş', 'kumas', 'fabric'],
    chemicals:  ['kimyasal', 'boya', 'chemical', 'dye'],
    finishing:  ['terbiye', 'apre', 'finishing'],
    garment:    ['konfeksiyon', 'giysi', 'garment'],
    packaging:  ['ambalaj', 'paket', 'packaging'],
    delivery:   ['teslimat', 'sipariş', 'siparis', 'delivery', 'order'],
    transport:  ['servis', 'ulaşım', 'ulasim', 'transport'],
    retail:     ['perakende', 'mağaza', 'magaza', 'retail'],
    energy:     ['enerji', 'elektrik', 'energy', 'kw'],
    wastewater: ['atık su', 'atik su', 'deşarj', 'desarj', 'wastewater', 'su '],
    office:     ['ofis', 'office'],
    it:         ['bilgi işlem', 'bilgi islem', ' it ', 'yapay zek', 'ai maliyet']
  };

  function resolveLocal(raw) {
    const t = ' ' + norm(raw) + ' ';
    if (!t.trim()) return { kind: 'empty' };

    if (hasAny(t, [' onayla ', ' onaylıyorum ', ' evet onayla '])) return { kind: 'approve' };
    if (hasAny(t, [' reddet ', ' reddediyorum ', ' iptal '])) return { kind: 'reject' };

    if (hasAny(t, ['yardım', 'yardim', 'neler yapabilir', 'help', 'ne yapabilirsin'])) return { kind: 'help' };
    if (hasAny(t, [' selam', ' merhaba', ' hello', ' hi ', 'günaydın', 'gunaydin', 'iyi akşamlar', 'iyi aksamlar'])) return { kind: 'greeting' };

    if (hasAny(t, ['onay', 'bekleyen', 'karar', 'blok', 'engel', 'approval', 'now', 'şimdi', 'simdi', 'acil'])) return { kind: 'context', type: 'now' };
    if (hasAny(t, ['hafıza', 'hafiza', 'memory', 'hatırl', 'hatirl', 'geçmiş', 'gecmis', 'son karar', 'kayıt', 'kayit', 'defter', 'ledger', 'log'])) return { kind: 'context', type: 'memory' };
    if (hasAny(t, [' ev ', 'evi ', 'evde', 'home', 'salon', 'ışık', 'isik', 'sıcaklık', 'sicaklik', 'termostat'])) return { kind: 'context', type: 'home' };
    if (hasAny(t, ['imac', 'macbook', 'iphone', 'cihaz', 'device', 'telemetri', 'node', 'düğüm', 'dugum', 'mesh', 'sunucu', 'server'])) return { kind: 'context', type: 'device' };
    if (hasAny(t, ['ajan', 'agent', 'coding', 'research', 'araştırma', 'arastirma', 'qa ', 'security', 'güvenlik', 'guvenlik'])) return { kind: 'context', type: 'agent' };
    if (hasAny(t, ['ekoten', 'üretim', 'uretim', 'production', 'fabrika', 'plc', 'tesis', 'endüstri', 'endustri', 'industrial', 'buhar', 'hat '])) {
      // A specific module inside the industrial context wins if named.
      const m = matchModule(t);
      if (m) return { kind: 'module', key: m };
      return { kind: 'context', type: 'industrial' };
    }

    const mod = matchModule(t);
    if (mod) return { kind: 'module', key: mod };

    if (hasAny(t, ['bugün', 'bugun', 'today', 'ne kaldı', 'ne kaldi', 'görev', 'gorev', 'task', 'iş ', 'is ', 'work', 'modül', 'modul', 'portföy', 'portfoy', 'çalış', 'calis'])) return { kind: 'context', type: 'work' };
    if (hasAny(t, ['durum', 'sistem', 'status', 'sağlık', 'saglik', 'bağlant', 'baglant', 'her şey', 'her sey'])) return { kind: 'status' };
    if (hasAny(t, ['kapat', 'close', 'temizle', 'ana ekran', 'başa dön', 'basa don'])) return { kind: 'reset' };

    return { kind: 'unknown' };
  }

  function matchModule(t) {
    const keys = Object.keys(MODULE_WORDS);
    for (let i = 0; i < keys.length; i++) {
      if (hasAny(t, MODULE_WORDS[keys[i]])) return keys[i];
    }
    return null;
  }

  return {
    /** Optional async function(text) → same intent shape, or null to fall back. */
    remoteResolver: null,
    resolve: async function (text) {
      if (typeof this.remoteResolver === 'function') {
        try {
          const r = await this.remoteResolver(text);
          if (r && r.kind) return r;
        } catch (e) { /* fall back to local rules */ }
      }
      return resolveLocal(text);
    },
    resolveLocal: resolveLocal
  };
})();
