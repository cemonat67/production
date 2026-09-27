/**
 * Lina — UI renderer
 * Derives the whole screen from ZeroLina.State. One shell, content changes by context.
 * Components (by DOM region): LinaPresence, LinaStatus, LinaSummary, NodeStatusBar,
 * ContextPanel (Now/Work/Memory/Module/Industrial surfaces), ApprovalCard, LinaInput.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.UI = (function () {
  const D = ZeroLina.Data;
  let el = {};
  let actions = {};
  let previewKey = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function q(id) { return document.getElementById(id); }

  const STATE_LABELS = {
    listening: 'Dinliyor',
    thinking: 'Düşünüyor',
    acting: 'İşliyor',
    approval_required: 'Onay',
    idle: 'Hazır',
    error: 'Hata'
  };

  const NODE_STATUS_TEXT = {
    checking: 'kontrol ediliyor',
    online: 'çevrimiçi',
    unavailable: 'ulaşılamıyor',
    attention: 'dikkat gerekiyor',
    critical: 'kritik'
  };

  const PANEL_TITLES = {
    now: 'Şimdi', work: 'İş', memory: 'Hafıza', industrial: 'Ekoten',
    device: 'Cihazlar', home: 'Home', agent: 'Ajanlar', general: 'Sistem durumu'
  };

  function init(a) {
    actions = a;
    el = {
      shell: q('lina-shell'),
      presence: q('lina-presence'),
      greeting: q('lina-greeting'),
      status: q('lina-status'),
      statusText: q('lina-status-text'),
      summary: q('lina-summary'),
      thread: q('lina-thread'),
      states: q('lina-states'),
      suggest: q('lina-suggest'),
      approval: q('lina-approval'),
      nodes: q('lina-nodes'),
      nav: q('lina-nav'),
      railToday: q('lina-today'),
      railModules: q('lina-rail-modules'),
      panel: q('lina-panel'),
      panelTitle: q('lina-panel-title'),
      panelBody: q('lina-panel-body'),
      panelClose: q('lina-panel-close'),
      scrim: q('lina-scrim'),
      form: q('lina-form'),
      input: q('lina-text'),
      mic: q('lina-mic'),
      file: q('lina-file')
    };

    // Nav (Chatty / Now / Work / Memory)
    el.nav.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-context]');
      if (b) actions.nav(b.getAttribute('data-context'));
    });

    // Suggestions
    el.suggest.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-say]');
      if (b) actions.command(b.getAttribute('data-say'));
    });

    // Rail
    el.railToday.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-context]');
      if (b) actions.nav(b.getAttribute('data-context'));
    });
    el.railModules.innerHTML = D.MODULES.map(function (m) {
      return '<li><button type="button" data-open-module="' + esc(m.key) + '">' + esc(m.label) + '</button></li>';
    }).join('');
    el.railModules.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-open-module]');
      if (b) actions.openModule(b.getAttribute('data-open-module'));
    });

    // Panel delegation
    el.panelBody.addEventListener('click', function (ev) {
      const t = ev.target.closest('[data-open-module],[data-review],[data-preview],[data-export],[data-context]');
      if (!t) return;
      if (t.hasAttribute('data-open-module')) actions.openModule(t.getAttribute('data-open-module'));
      else if (t.hasAttribute('data-review')) actions.review(Number(t.getAttribute('data-review')));
      else if (t.hasAttribute('data-preview')) { previewKey = t.getAttribute('data-preview'); renderPanel(ZeroLina.State.get()); }
      else if (t.hasAttribute('data-export')) { if (window.ZeroAuditLog && ZeroAuditLog.exportJSON) ZeroAuditLog.exportJSON(); }
      else if (t.hasAttribute('data-context')) actions.nav(t.getAttribute('data-context'));
    });
    el.panelClose.addEventListener('click', function () { actions.closePanel(); });
    el.scrim.addEventListener('click', function () { actions.closePanel(); });

    // Approval card
    el.approval.addEventListener('click', function (ev) {
      const b = ev.target.closest('button[data-decision]');
      if (!b) return;
      const ta = el.approval.querySelector('textarea');
      if (b.getAttribute('data-decision') === 'approve') actions.approve(ta ? ta.value.trim() : '');
      else actions.reject();
    });

    // Input
    el.form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const v = el.input.value.trim();
      if (!v) return;
      el.input.value = '';
      actions.command(v);
    });
    el.mic.addEventListener('click', function () { actions.toggleMic(); });
    el.file.addEventListener('change', function () {
      if (el.file.files && el.file.files.length) actions.attach(Array.prototype.slice.call(el.file.files));
      el.file.value = '';
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') actions.escape();
      if (ev.key === '/' && document.activeElement !== el.input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        ev.preventDefault();
        el.input.focus();
      }
    });

    if (!ZeroLina.Voice.supported) {
      el.mic.disabled = true;
      el.mic.title = 'Bu tarayıcıda ses tanıma desteklenmiyor';
      el.mic.setAttribute('aria-label', 'Mikrofon (bu tarayıcıda desteklenmiyor)');
    }
  }

  /* ---------------------------------------------------------------- render */
  function render(s, changed) {
    el.presence.setAttribute('data-state', s.lina);
    el.status.setAttribute('data-state', s.lina);
    el.statusText.textContent = s.statusText || (s.lina === 'idle' ? 'Ne yapalım?' : '');
    el.mic.setAttribute('aria-pressed', s.lina === 'listening' ? 'true' : 'false');

    renderStates(s);
    renderGreeting(s);
    renderSummary(s);
    renderThread(s);
    renderApproval(s);
    renderNodes(s);
    renderNav(s);
    renderRail(s);

    el.shell.setAttribute('data-panel', s.panelOpen ? 'open' : 'closed');
    el.shell.setAttribute('data-lina', s.lina);
    if (s.panelOpen) renderPanel(s);
    el.suggest.hidden = s.lina === 'approval_required';
  }

  function renderStates(s) {
    const order = ['listening', 'thinking', 'acting', 'approval_required', 'idle'];
    el.states.innerHTML = order.map(function (k) {
      const isErr = k === 'idle' && s.lina === 'error';
      const key = isErr ? 'error' : k;
      const cur = s.lina === key ? ' aria-current="step"' : '';
      return '<li data-state="' + key + '"' + cur + '>' + esc(STATE_LABELS[key]) + '</li>';
    }).join('');
  }

  function renderGreeting(s) {
    el.greeting.innerHTML = esc(s.greeting || 'Merhaba') + (s.userName ? ' <strong>' + esc(s.userName) + '.</strong>' : '');
  }

  function renderSummary(s) {
    const showSummary = s.context.type === 'general' && s.thread.length === 0 && s.lina !== 'approval_required';
    el.summary.hidden = !showSummary;
    el.summary.innerHTML = (s.summary || []).map(function (line) { return '<li>' + line + '</li>'; }).join('');
  }

  function renderThread(s) {
    if (s.lina === 'approval_required') { el.thread.innerHTML = ''; return; }
    let last = [];
    for (let i = s.thread.length - 1; i >= 0; i--) {
      if (s.thread[i].who === 'lina') { last = s.thread.slice(Math.max(0, i - 1), i + 1); break; }
    }
    if (last.length === 2 && last[0].who !== 'you') last = last.slice(1);
    el.thread.innerHTML = last.map(function (m) {
      return '<div class="' + (m.who === 'you' ? 'you' : 'lina') + '">' + (m.who === 'you' ? esc(m.text) : m.text) + '</div>';
    }).join('');
  }

  function renderApproval(s) {
    const a = s.pendingApproval;
    if (s.lina !== 'approval_required' || !a) { el.approval.hidden = true; el.approval.innerHTML = ''; return; }
    el.approval.hidden = false;
    el.approval.innerHTML =
      '<h3>Onay gerekiyor</h3>' +
      '<div class="item">' + esc(a.name) + ' <span class="meta">' + esc(a.itemId) + '</span></div>' +
      '<dl>' +
        '<dt>Kural</dt><dd>' + esc(a.ruleLabel) + '</dd>' +
        '<dt>Gerekçe</dt><dd>' + esc(a.reason) + '</dd>' +
        (a.currentValue != null ? '<dt>Mevcut</dt><dd>' + esc(a.currentValue) + '</dd>' : '') +
        (a.threshold != null ? '<dt>Eşik</dt><dd>' + esc(a.threshold) + '</dd>' : '') +
        '<dt>Onaylayan rol</dt><dd>' + esc(a.roleRequired) + '</dd>' +
      '</dl>' +
      '<label class="sr-only" for="lina-justification">Onay gerekçesi</label>' +
      '<textarea id="lina-justification" placeholder="Gerekçe (kayda geçer)"></textarea>' +
      '<div class="actions">' +
        '<button type="button" class="lina-btn lina-btn--accent" data-decision="approve">Onayla</button>' +
        '<button type="button" class="lina-btn" data-decision="reject">Reddet</button>' +
      '</div>';
    const ta = el.approval.querySelector('textarea');
    if (ta) ta.focus();
  }

  function renderNodes(s) {
    el.nodes.innerHTML = s.nodes.map(function (n) {
      return '<li title="' + esc(n.label + ' · ' + (n.detail || '')) + '">' +
        '<span class="dot dot--' + esc(n.status) + '" aria-hidden="true"></span>' +
        '<span class="label">' + esc(n.label) + '</span>' +
        '<span class="sr-only">: ' + esc(NODE_STATUS_TEXT[n.status] || n.status) + '</span>' +
      '</li>';
    }).join('');
  }

  function renderNav(s) {
    const active = s.context.type === 'general' ? 'general' : s.context.type;
    Array.prototype.forEach.call(el.nav.querySelectorAll('button[data-context]'), function (b) {
      const k = b.getAttribute('data-context');
      const on = k === active || (k === 'general' && ['module', 'industrial', 'device', 'home', 'agent'].indexOf(active) !== -1);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderRail(s) {
    const c = D.approvalCounts(s.approvals);
    el.railToday.innerHTML =
      '<li><button type="button" data-context="now">Satış engeli <span class="count">' + c.blockers + '</span></button></li>' +
      '<li><button type="button" data-context="now">Onaya bağlı <span class="count">' + c.gates + '</span></button></li>' +
      '<li><button type="button" data-context="memory">Kayıtlı karar <span class="count">' + s.memory.length + '</span></button></li>';
  }

  /* ---------------------------------------------------------------- panel */
  function renderPanel(s) {
    const c = s.context;
    let title = PANEL_TITLES[c.type] || 'Bağlam';
    let html = '';
    if (c.type === 'now') html = panelNow(s);
    else if (c.type === 'work') html = panelWork(s);
    else if (c.type === 'memory') html = panelMemory(s);
    else if (c.type === 'module') { const m = D.moduleByKey(c.id); title = m ? m.label : 'Modül'; html = panelModule(m); }
    else if (c.type === 'industrial') html = panelIndustrial(s);
    else if (c.type === 'device') html = panelDevice(s);
    else if (c.type === 'home') html = '<div class="lina-empty">Home henüz bağlı değil.</div>';
    else if (c.type === 'agent') html = '<div class="lina-empty">Ajan çalışma zamanı bu kurulumda bağlı değil.</div>';
    else html = panelStatus(s);
    el.panelTitle.textContent = title;
    el.panelBody.innerHTML = html;
  }

  function panelNow(s) {
    const p = s.portfolio;
    if (p && p.errors.indexOf('yarn') !== -1) {
      return '<div class="lina-empty">Ürün verisi alınamadı; karar listesi oluşturulamadı.</div>';
    }
    if (!s.approvals.length) return '<div class="lina-empty">Şu anda bekleyen kritik iş yok.</div>';
    function row(a, i, tagClass) {
      return '<li>' +
        '<span class="title">' + esc(a.name) + ' <span class="meta">' + esc(a.itemId) + '</span></span>' +
        '<span class="tag ' + tagClass + '">' + esc(a.ruleLabel) + '</span>' +
        '<button type="button" data-review="' + i + '">İncele</button>' +
        '<span class="sub">' + esc(a.roleRequired) + ' onayı · ' + esc(a.reason) + '</span>' +
      '</li>';
    }
    const blockers = [], gates = [];
    s.approvals.forEach(function (a, i) { (a.kind === 'blocker' ? blockers : gates).push(row(a, i, a.kind === 'blocker' ? 'tag--critical' : 'tag--attention')); });
    let html = '<p class="note">Kaynak: yönetişim motoru · data/yarns.json</p>';
    html += '<h3>Satış engelleri</h3>';
    html += blockers.length ? '<ul class="lina-list">' + blockers.join('') + '</ul>' : '<div class="lina-empty">Satış engeli yok.</div>';
    if (gates.length) {
      html += '<h3>Onaya bağlı işlemler</h3><p class="note">İndirim yalnızca ilgili rolün onayıyla uygulanabilir.</p>';
      html += '<ul class="lina-list">' + gates.join('') + '</ul>';
    }
    return html;
  }

  function panelWork(s) {
    const p = s.portfolio;
    let html = '<h3>Bugünkü iş</h3><div class="lina-empty">Görev sistemi bu kurulumda bağlı değil.</div>';
    if (p && p.yarns.length) {
      const c = D.portfolioStatus(p.yarns);
      html += '<h3>Portföy durumu</h3><p class="note">Kaynak: data/yarns.json · ' + p.yarns.length + ' iplik</p>' +
        '<div class="lina-kv">' +
          '<div><div class="k">HERO</div><div class="v">' + c.HERO + '</div></div>' +
          '<div><div class="k">TRANSFORM</div><div class="v">' + c.TRANSFORM + '</div></div>' +
          '<div><div class="k">EXIT</div><div class="v">' + c.EXIT + '</div></div>' +
        '</div>';
    } else if (p) {
      html += '<h3>Portföy durumu</h3><p class="note">Ürün verisi alınamadı.</p>';
    }
    const groups = [];
    D.MODULES.forEach(function (m) { if (groups.indexOf(m.group) === -1) groups.push(m.group); });
    html += '<h3>Modüller</h3>';
    groups.forEach(function (g) {
      html += '<p class="meta">' + esc(g) + '</p><ul class="lina-list">' +
        D.MODULES.filter(function (m) { return m.group === g; }).map(function (m) {
          return '<li><span class="title">' + esc(m.label) + '</span><button type="button" data-open-module="' + esc(m.key) + '">Aç</button></li>';
        }).join('') + '</ul>';
    });
    return html;
  }

  function panelMemory(s) {
    let html = '<h3>Karar defteri</h3><p class="note">Kaynak: tarayıcı yerel defteri (localStorage)</p>';
    if (!s.memory.length) html += '<div class="lina-empty">Henüz kayıtlı karar yok.</div>';
    else {
      html += '<ul class="lina-list">' + s.memory.slice(0, 20).map(function (e) {
        let when = e.ts || '';
        try { when = new Date(e.ts).toLocaleString('tr-TR'); } catch (x) { /* keep raw */ }
        const bits = [when, e.actor_role, e.item_id, e.reason].filter(Boolean).map(esc).join(' · ');
        return '<li><span class="title">' + esc(e.event_type) + '</span><span class="sub">' + bits + '</span></li>';
      }).join('') + '</ul>';
      if (window.ZeroAuditLog && ZeroAuditLog.exportJSON) html += '<p><button type="button" class="lina-btn" data-export="1">JSON dışa aktar</button></p>';
    }
    html += '<h3>Proje belleği</h3><p class="note">Kaynak: site/strategy</p><ul class="lina-list">' +
      D.STRATEGY_DOCS.map(function (d) {
        return '<li><span class="title">' + esc(d.title) + '</span><a class="action" href="' + esc(d.file) + '" target="_blank" rel="noopener">Aç</a></li>';
      }).join('') + '</ul>';
    return html;
  }

  function panelModule(m) {
    if (!m) return '<div class="lina-empty">Modül bulunamadı.</div>';
    let html = '<h3>' + esc(m.label) + '</h3><p>' + esc(m.desc) + '</p><p class="meta">' + esc(m.group) + ' · ' + esc(m.file) + '</p>' +
      '<p><a class="lina-btn lina-btn--primary" href="' + esc(m.file) + '" target="_blank" rel="noopener">Modülü aç</a> ' +
      (previewKey === m.key ? '' : '<button type="button" class="lina-btn" data-preview="' + esc(m.key) + '">Burada önizle</button>') + '</p>';
    if (previewKey === m.key) {
      html += '<div class="lina-preview"><iframe src="' + esc(m.file) + '" title="' + esc(m.label) + ' önizleme" loading="lazy"></iframe></div>';
    }
    return html;
  }

  function panelIndustrial(s) {
    const keys = ['wastewater', 'energy', 'chemicals', 'finishing'];
    return '<h3>Ekoten</h3>' +
      '<p>Canlı üretim telemetrisi bu kurulumda bağlı değil.</p>' +
      '<p class="note">Bağlı modüller aşağıda. Atık su verisi Supabase üzerinden okunur.</p>' +
      '<ul class="lina-list">' + keys.map(function (k) {
        const m = D.moduleByKey(k);
        return '<li><span class="title">' + esc(m.label) + '</span><button type="button" data-open-module="' + esc(k) + '">Aç</button></li>';
      }).join('') + '</ul>';
  }

  function nodesList(s) {
    return '<ul class="lina-list">' + s.nodes.map(function (n) {
      const tag = n.status === 'online' ? 'tag--ok' : n.status === 'critical' ? 'tag--critical' : n.status === 'attention' ? 'tag--attention' : '';
      return '<li><span class="title">' + esc(n.label) + '</span><span class="tag ' + tag + '">' + esc(NODE_STATUS_TEXT[n.status] || n.status) + '</span>' +
        '<span class="sub">' + esc(n.detail || '') + '</span></li>';
    }).join('') + '</ul>';
  }

  function panelDevice(s) {
    return '<div class="lina-empty">Cihaz telemetrisi bu kurulumda bağlı değil.</div>' +
      '<h3>Bağlı sistemler</h3>' + nodesList(s);
  }

  function panelStatus(s) {
    let html = '<h3>Bağlı sistemler</h3>' + nodesList(s);
    const p = s.portfolio;
    if (p) {
      html += '<h3>Ürün verisi</h3><div class="lina-kv">' +
        '<div><div class="k">Elyaf</div><div class="v">' + p.fibres.length + '</div></div>' +
        '<div><div class="k">Kumaş</div><div class="v">' + p.fabrics.length + '</div></div>' +
        '<div><div class="k">İplik</div><div class="v">' + p.yarns.length + '</div></div>' +
      '</div>';
      if (p.errors.length) html += '<p class="note">Alınamayan: ' + esc(p.errors.join(', ')) + '</p>';
    }
    if (s.attachments.length) {
      html += '<h3>Bağlamdaki dosyalar</h3><ul class="lina-list">' + s.attachments.map(function (f) {
        return '<li><span class="title">' + esc(f.name) + '</span><span class="sub">' + Math.round(f.size / 1024) + ' KB · içerik henüz işlenmiyor</span></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  return {
    init: init,
    render: render,
    setInputText: function (t) { el.input.value = t; },
    focusInput: function () { el.input.focus(); },
    resetPreview: function () { previewKey = null; },
    scrollStageTop: function () { const st = document.querySelector('.lina-stage'); if (st) st.scrollTop = 0; }
  };
})();
