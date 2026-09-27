/**
 * Lina — application controller
 * Wires state, data, intent, voice and UI together. Idle → Listening →
 * Thinking → Acting (→ Approval required / Error) all happen on one screen.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.App = (function () {
  const S = ZeroLina.State;
  const D = ZeroLina.Data;
  const UI = ZeroLina.UI;
  const V = ZeroLina.Voice;

  const cfg = Object.assign({ userName: 'Cem', speechLang: 'tr-TR', minThinkMs: 450, actMs: 520 }, window.ZeroLinaConfig || {});
  window.ZeroLinaConfig = cfg;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function greetingForHour(h) {
    if (h >= 5 && h < 11) return 'Günaydın';
    if (h >= 11 && h < 18) return 'İyi günler';
    if (h >= 18 && h < 23) return 'İyi akşamlar';
    return 'İyi geceler';
  }

  function userName() {
    try {
      const qp = new URLSearchParams(location.search).get('user');
      if (qp) return qp.slice(0, 40);
      const stored = localStorage.getItem('lina_user_name');
      if (stored) return stored;
    } catch (e) { /* ignore */ }
    return cfg.userName;
  }

  /** Data-driven summary lines for the idle screen. Never invents status. */
  function buildSummary(s) {
    const lines = [];
    const p = s.portfolio;
    if (p && p.errors.indexOf('yarn') === -1) {
      const c = D.approvalCounts(s.approvals);
      if (!c.blockers && !c.gates) lines.push('Şu anda bekleyen kritik iş yok.');
      else {
        const parts = [];
        parts.push(c.blockers ? '<strong>' + c.blockers + '</strong> satış engeli var' : 'Satış engeli yok');
        if (c.gates) parts.push('<strong>' + c.gates + '</strong> indirim işlemi onaya bağlı');
        lines.push(parts.join('; ') + '.');
      }
    } else if (p) {
      lines.push('Ürün verisi alınamadı.');
    }
    const known = s.nodes.filter(function (n) { return n.status !== 'checking'; });
    if (known.length === s.nodes.length && s.nodes.length) {
      const down = known.filter(function (n) { return n.status !== 'online'; });
      if (!down.length) lines.push('Bağlı sistemlerde sorun yok.');
      else lines.push(down.map(function (n) { return n.label; }).join(', ') + ' şu anda ulaşılamıyor.');
    } else if (s.nodes.length) {
      lines.push('Sistem bağlantıları kontrol ediliyor.');
    }
    if (p && !p.errors.length) {
      lines.push((p.fibres.length + p.fabrics.length + p.yarns.length) + ' ürün kaydı yüklü.');
    }
    return lines;
  }

  function refreshSummary() {
    S.set({ summary: buildSummary(S.get()) });
  }

  /* ---------------------------------------------------------------- boot */
  async function init() {
    UI.init(actions);
    S.subscribe(UI.render);
    S.set({ greeting: greetingForHour(new Date().getHours()), userName: userName(), summary: ['Sistem kontrol ediliyor.'] });

    D.probeNodes(function (nodes) { S.set({ nodes: nodes }); refreshSummary(); });

    try {
      const portfolio = await D.loadPortfolio();
      S.set({ portfolio: portfolio, approvals: D.computeApprovals(portfolio.yarns), memory: D.loadMemory() });
    } catch (e) {
      console.warn('[Lina] portfolio load failed', e);
      S.set({ portfolio: { fibres: [], fabrics: [], yarns: [], errors: ['fibre', 'fabric', 'yarn'] } });
    }
    refreshSummary();
    S.setLina('idle', '');
  }

  /* ---------------------------------------------------------------- flows */
  async function command(text) {
    const s = S.get();
    if (s.lina === 'thinking' || s.lina === 'acting') return;
    S.heard(text);
    S.setLina('thinking', 'Kontrol ediyorum...');
    try {
      const results = await Promise.all([ZeroLina.Intent.resolve(text), sleep(cfg.minThinkMs)]);
      await dispatch(results[0], text);
    } catch (e) {
      console.error('[Lina] command failed', e);
      S.setLina('error', 'Bir bağlantı sorunu var.');
      S.say('Tekrar deneyebilirim.');
    }
  }

  async function act(statusText, fn) {
    S.setLina('acting', statusText);
    await sleep(cfg.actMs);
    await fn();
    S.setLina('idle', '');
  }

  function openPanel(type, extra) {
    UI.resetPreview();
    S.setContext(type, extra);
    S.set({ panelOpen: true });
  }

  async function dispatch(intent, text) {
    const s = S.get();
    switch (intent.kind) {
      case 'context':
        return contextFlow(intent.type);
      case 'module':
        return actions.openModule(intent.key, true);
      case 'status':
        return act('Sistem durumunu kontrol ediyorum.', async function () {
          openPanel('general', { id: 'status', title: 'Sistem durumu' });
          const down = S.get().nodes.filter(function (n) { return n.status !== 'online'; });
          S.say(down.length ? down.map(function (n) { return n.label; }).join(', ') + ' ulaşılamıyor; diğer sistemler erişilebilir.' : 'Bağlı sistemlerin tümü erişilebilir.');
        });
      case 'approve':
        if (s.pendingApproval) return actions.approve('');
        S.say('Şu anda seçili bir onay işlemi yok.'); return S.setLina('idle', '');
      case 'reject':
        if (s.pendingApproval) return actions.reject();
        S.say('Şu anda seçili bir onay işlemi yok.'); return S.setLina('idle', '');
      case 'help':
        S.say('Şunları yapabilirim: bekleyen kararları göstermek, modülleri açmak, karar defterini getirmek, sistem durumunu kontrol etmek. Örnek: <strong>“Onay bekleyenler”</strong>, <strong>“Kumaş modülünü aç”</strong>, <strong>“Son kararlar”</strong>.');
        return S.setLina('idle', '');
      case 'greeting':
        S.say(S.get().greeting + ' ' + S.get().userName + '. ' + (S.get().summary || []).join(' '));
        return S.setLina('idle', '');
      case 'reset':
        return actions.nav('general');
      case 'empty':
        return S.setLina('idle', '');
      default:
        S.say('Bunu bu kurulumda yapamıyorum. Deneyebileceklerin: <strong>“Bugün ne kaldı?”</strong>, <strong>“Onay bekleyenler”</strong>, <strong>“Ekoten durumunu göster”</strong>.');
        return S.setLina('idle', '');
    }
  }

  async function contextFlow(type) {
    const s = S.get();
    switch (type) {
      case 'now':
        return act('Bekleyen kararları getiriyorum.', async function () {
          openPanel('now');
          const c = D.approvalCounts(S.get().approvals);
          if (!c.blockers && !c.gates) S.say('Şu anda bekleyen kritik iş yok.');
          else S.say((c.blockers ? '<strong>' + c.blockers + '</strong> satış engeli' : 'Satış engeli yok') + (c.gates ? (c.blockers ? ' ve ' : '; ') + '<strong>' + c.gates + '</strong> onaya bağlı işlem' : '') + ' seni bekliyor. Listeden inceleyebilirsin.');
        });
      case 'work':
        return act('Bugünkü işi topluyorum.', async function () {
          openPanel('work');
          const p = S.get().portfolio;
          const msg = p && p.yarns.length
            ? 'Görev sistemi bağlı değil; portföy ve ' + D.MODULES.length + ' modül sağda.'
            : 'Görev sistemi bağlı değil. Modüller sağda.';
          S.say(msg);
        });
      case 'memory':
        return act('Karar defterini açıyorum.', async function () {
          S.set({ memory: D.loadMemory() });
          openPanel('memory');
          const m = S.get().memory.length;
          S.say(m ? 'Yerel defterde <strong>' + m + '</strong> kayıt var.' : 'Henüz kayıtlı karar yok.');
        });
      case 'industrial':
        return act('Ekoten durumunu kontrol ediyorum.', async function () {
          openPanel('industrial');
          S.say('Canlı üretim telemetrisi bağlı değil. Atık su, enerji ve kimyasal modülleri erişilebilir.');
        });
      case 'home':
        openPanel('home'); S.say('Home henüz bağlı değil.'); return S.setLina('idle', '');
      case 'device':
        openPanel('device'); S.say('Cihaz telemetrisi bu kurulumda bağlı değil.'); return S.setLina('idle', '');
      case 'agent':
        openPanel('agent'); S.say('Ajan çalışma zamanı bu kurulumda bağlı değil.'); return S.setLina('idle', '');
      default:
        return actions.nav('general');
    }
  }

  /* ---------------------------------------------------------------- actions */
  const actions = {
    command: command,

    nav: function (type) {
      const s = S.get();
      if (s.lina === 'listening') V.abort();
      if (type === 'general') {
        UI.resetPreview();
        S.set({ thread: [], pendingApproval: null, panelOpen: false });
        S.setContext('general');
        S.setLina('idle', '');
        return;
      }
      if (s.lina === 'thinking' || s.lina === 'acting') return;
      S.set({ pendingApproval: null });
      return contextFlow(type);
    },

    openModule: function (key, viaCommand) {
      const m = D.moduleByKey(key);
      if (!m) { S.say('Bu modülü bulamadım.'); return S.setLina('idle', ''); }
      return act(m.label + ' modülünü açıyorum.', async function () {
        S.set({ pendingApproval: null });
        openPanel('module', { id: m.key, title: m.label });
        S.say('<strong>' + m.label + '</strong> bağlamı hazır. Sağdan açabilir veya önizleyebilirsin.');
      });
    },

    review: function (index) {
      const a = S.get().approvals[index];
      if (!a) return;
      S.set({ pendingApproval: a, thread: [] });
      S.setLina('approval_required', 'Onay gerekiyor.');
      UI.scrollStageTop();
    },

    approve: async function (justification) {
      const a = S.get().pendingApproval;
      if (!a) return;
      const G = window.ZeroGovernance;
      await act('Onayı orkestratöre iletiyorum.', async function () {
        let res = null;
        try { res = await G.approveOverride(a.itemId, a.ruleId, a.roleRequired, justification || 'Lina üzerinden onaylandı'); }
        catch (e) { res = { error: String(e), offline: true }; }
        const offline = !res || res.offline || res.error;
        if (window.ZeroAuditLog) {
          ZeroAuditLog.logEvent('OVERRIDE_APPROVED', { actor_role: a.roleRequired, item_id: a.itemId, rule_id: a.ruleId, reason: justification || null, details: { via: 'lina', delivered: !offline } });
        }
        const p = S.get().portfolio;
        S.set({ pendingApproval: null, approvals: D.computeApprovals(p ? p.yarns : []), memory: D.loadMemory() });
        refreshSummary();
        S.say(offline
          ? '<strong>' + a.name + '</strong> için onay yerel olarak kaydedildi; orkestratöre iletilemedi.'
          : '<strong>' + a.name + '</strong> için onay iletildi ve deftere yazıldı.');
        if (S.get().panelOpen && S.get().context.type === 'now') S.set({ panelOpen: true });
      });
    },

    reject: async function () {
      const a = S.get().pendingApproval;
      if (!a) return;
      await act('Kararı deftere yazıyorum.', async function () {
        if (window.ZeroAuditLog) {
          ZeroAuditLog.logEvent('OVERRIDE_REJECTED', { actor_role: a.roleRequired, item_id: a.itemId, rule_id: a.ruleId, details: { via: 'lina' } });
        }
        S.set({ pendingApproval: null, memory: D.loadMemory() });
        S.say('<strong>' + a.name + '</strong> için istek reddedildi; kayıt yerel deftere yazıldı.');
      });
    },

    closePanel: function () { S.set({ panelOpen: false }); },

    escape: function () {
      const s = S.get();
      if (s.lina === 'listening') { V.abort(); S.setLina('idle', ''); return; }
      if (s.lina === 'approval_required') { S.set({ pendingApproval: null }); S.setLina('idle', ''); return; }
      if (s.panelOpen) S.set({ panelOpen: false });
    },

    attach: function (files) {
      const list = S.get().attachments.concat(files.map(function (f) { return { name: f.name, size: f.size, type: f.type }; }));
      S.set({ attachments: list });
      S.say('<strong>' + files.map(function (f) { return f.name; }).join(', ') + '</strong> bağlama eklendi. Dosya içeriği bu kurulumda henüz işlenmiyor.');
    },

    toggleMic: function () {
      const s = S.get();
      if (s.lina === 'listening') { V.stop(); return; }
      if (s.lina === 'thinking' || s.lina === 'acting') return;
      if (!V.supported) { S.say('Bu tarayıcıda ses tanıma desteklenmiyor. Yazabilirsin.'); return; }
      V.start({
        onStart: function () { S.setLina('listening', 'Dinliyorum...'); },
        onInterim: function (t) { UI.setInputText(t); },
        onEnd: function (finalText) {
          UI.setInputText('');
          if (finalText) command(finalText);
          else if (S.get().lina === 'listening') S.setLina('idle', '');
        },
        onError: function (code) {
          UI.setInputText('');
          if (code === 'not-allowed' || code === 'service-not-allowed') { S.setLina('error', 'Mikrofon izni verilmedi.'); S.say('Tarayıcı ayarlarından mikrofon iznini açıp tekrar deneyebilirsin.'); }
          else if (code === 'no-speech') S.setLina('idle', 'Ses algılanmadı.');
          else if (code === 'aborted') S.setLina('idle', '');
          else { S.setLina('error', 'Ses tanıma başlatılamadı.'); S.say('Tekrar deneyebilirim; yazarak da devam edebilirsin.'); }
        }
      });
    }
  };

  return { init: init, actions: actions };
})();

document.addEventListener('DOMContentLoaded', function () { ZeroLina.App.init(); });
