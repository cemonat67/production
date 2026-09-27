/**
 * Lina — surfaces and the context panel.
 * NowSurface, WorkSurface, MemorySurface render into the centre column;
 * ContextPanel opens for details and closes easily; ApprovalCard sits in the surface slot.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function empty(text, sub) {
    return h('div', { class: 'lina-empty', role: 'status' }, [text, sub ? h('small', { text: sub }) : null]);
  }

  function head(title, meta) {
    return h('div', { class: 'lina-surface-head' }, [
      h('h2', { class: 'lina-surface-title', text: title }),
      meta ? h('span', { class: 'lina-surface-meta', text: meta }) : null
    ]);
  }

  function riskTag(risk) {
    const r = String(risk || '').toUpperCase();
    if (!r) return null;
    const cls = r === 'HIGH' ? 'danger' : r === 'LOW' ? 'ok' : '';
    return h('span', { class: 'lina-tag ' + cls, text: r === 'HIGH' ? 'Yüksek risk' : r === 'LOW' ? 'Düşük risk' : 'Orta risk' });
  }

  /* ---------------- Context panel ---------------- */
  let lastFocus = null;
  function openPanel(title, bodyNodes) {
    const shell = $('linaShell'), panel = $('linaPanel'), body = $('linaPanelBody'), backdrop = $('linaPanelBackdrop');
    lastFocus = document.activeElement;
    $('linaPanelTitle').textContent = title;
    body.innerHTML = '';
    (Array.isArray(bodyNodes) ? bodyNodes : [bodyNodes]).forEach(n => n && body.appendChild(n));
    panel.hidden = false; backdrop.hidden = false;
    requestAnimationFrame(() => shell.setAttribute('data-panel', 'open'));
    $('linaPanelClose').focus();
  }
  function closePanel() {
    const shell = $('linaShell'), panel = $('linaPanel'), backdrop = $('linaPanelBackdrop');
    if (panel.hidden) return;
    shell.setAttribute('data-panel', 'closed');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => { panel.hidden = true; backdrop.hidden = true; }, reduce ? 0 : 240);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function kv(pairs) {
    const dl = h('dl', { class: 'lina-kv' });
    pairs.forEach(([k, v]) => { if (v == null || v === '') return; dl.appendChild(h('dt', { text: k })); dl.appendChild(h('dd', { text: String(v) })); });
    return dl;
  }

  /* ---------------- Surfaces ---------------- */
  const L = () => window.Lina;

  async function work() {
    const p = await L().data.passports();
    const nodes = [head('İş', p.ok ? `${p.rows.length} pasaport` : null)];
    if (!p.ok) {
      nodes.push(empty(L().data.passportError(p.error), p.error === 'auth' ? 'Supabase görünümü anon anahtarla okunamıyor.' : p.error === 'config' ? 'Supabase yapılandırması eksik.' : 'Bağlantı kurulamadı. Tekrar deneyebilirim.'));
      return nodes;
    }
    if (!p.rows.length) { nodes.push(empty('Kayıtlı iş yok.', p.source)); return nodes; }
    const order = { draft: 0, issued: 1, active: 2 };
    const rows = p.rows.slice().sort((a, b) => (order[String(a.status).toLowerCase()] ?? 9) - (order[String(b.status).toLowerCase()] ?? 9)).slice(0, 12);
    nodes.push(h('ul', { class: 'lina-list' }, rows.map(r => h('li', {}, [
      h('button', { type: 'button', class: 'lina-row', onclick: () => passportDetail(r) }, [
        h('div', { class: 'lina-row-title', text: r.passport_id || '—' }),
        h('div', { class: 'lina-row-sub' }, [
          h('span', { class: 'lina-tag ' + (String(r.status).toLowerCase() === 'draft' ? 'accent' : ''), text: statusText(r.status) }),
          ' ', r.facility ? h('span', { text: r.facility }) : null
        ]),
        h('div', { class: 'lina-row-side' }, [riskTag(r.wastewater_risk)])
      ])
    ]))));
    nodes.push(h('p', { class: 'lina-surface-meta', text: 'Kaynak: ' + p.source, style: 'margin:10px 4px 0' }));
    return nodes;
  }

  function statusText(s) {
    const t = String(s || '').toLowerCase();
    return t === 'draft' ? 'Taslak' : t === 'issued' ? 'Yayınlandı' : t === 'active' ? 'Aktif' : (s || '—');
  }

  function passportDetail(r) {
    openPanel('Pasaport', [
      kv([
        ['ID', r.passport_id], ['Durum', statusText(r.status)], ['Tesis', r.facility],
        ['Toplam CO₂ (kg)', r.total_co2_kg], ['CO₂ / kg', r.co2_kg_per_kg], ['Atık su riski', r.wastewater_risk]
      ]),
      h('h3', { text: 'Kaynak' }),
      h('p', { text: 'Supabase · public.v_dpp_batch_passports' }),
      h('p', {}, [h('a', { class: 'lina-link', href: '../index.html#dppBatchPassports', text: 'Pasaport tablosunda aç' })])
    ]);
  }

  async function now() {
    const p = await L().data.passports();
    const o = L().data.overrides();
    const items = [];
    if (o.ok) o.rows.forEach(r => items.push({
      title: `Override aktif · ${r.itemId}`, sub: r.ruleId + (r.approvedBy ? ` · ${r.approvedBy}` : ''), side: r.expiresAt ? 'bitiş ' + L().data.fmtDate(r.expiresAt) : '',
      detail: () => openPanel('Override', [kv([['Kalem', r.itemId], ['Kural', r.ruleId], ['Onaylayan', r.approvedBy], ['Gerekçe', r.justification], ['Zaman', L().data.fmtDate(r.timestamp)], ['Bitiş', L().data.fmtDate(r.expiresAt)]]), h('h3', { text: 'Kaynak' }), h('p', { text: o.source })])
    }));
    if (p.ok) p.rows.filter(r => String(r.wastewater_risk || '').toUpperCase() === 'HIGH').slice(0, 8).forEach(r => items.push({
      title: r.passport_id, sub: (r.facility || '') + ' · yüksek atık su riski', side: statusText(r.status), tone: 'danger', detail: () => passportDetail(r)
    }));

    const nodes = [head('Şimdi', items.length ? `${items.length} dikkat gerektiren` : null)];
    if (!p.ok && !items.length) nodes.push(empty(L().data.passportError(p.error), 'Bekleyen öğeler kontrol edilemedi.'));
    else if (!items.length) nodes.push(empty('Şu anda kritik bekleyen iş yok.'));
    else nodes.push(h('ul', { class: 'lina-list' }, items.map(it => h('li', {}, [
      h('button', { type: 'button', class: 'lina-row', onclick: it.detail }, [
        h('div', { class: 'lina-row-title', text: it.title }),
        h('div', { class: 'lina-row-sub', text: it.sub }),
        h('div', { class: 'lina-row-side' }, [it.tone === 'danger' ? h('span', { class: 'lina-tag danger', text: it.side }) : it.side])
      ])
    ]))));
    return nodes;
  }

  function memory() {
    const a = L().data.auditLog();
    const nodes = [head('Hafıza', a.ok && a.rows.length ? `${a.rows.length} kayıt` : null)];
    if (!a.ok) { nodes.push(empty('Denetim kaydı modülü yüklenemedi.')); return nodes; }
    if (!a.rows.length) { nodes.push(empty('Bu tarayıcıda kayıtlı karar yok.', 'Kaynak: ' + a.source)); return nodes; }
    nodes.push(h('ul', { class: 'lina-list' }, a.rows.slice(0, 12).map(ev => h('li', {}, [
      h('button', { type: 'button', class: 'lina-row', onclick: () => openPanel('Kayıt', [
        kv([['Tür', ev.event_type], ['Zaman', L().data.fmtDate(ev.ts)], ['Rol', ev.actor_role], ['Kalem', ev.item_id], ['Gerekçe', ev.reason || ev.justification], ['ID', ev.id]]),
        h('h3', { text: 'Kaynak' }), h('p', { text: a.source }),
        h('h3', { text: 'Ham kayıt' }), h('pre', { text: JSON.stringify(ev, null, 2) })
      ]) }, [
        h('div', { class: 'lina-row-title', text: ev.event_type || 'Olay' }),
        h('div', { class: 'lina-row-sub', text: [ev.actor_role, ev.item_id, ev.reason].filter(Boolean).join(' · ') || 'Ayrıntı yok' }),
        h('div', { class: 'lina-row-side', text: L().data.fmtDate(ev.ts) })
      ])
    ]))));
    nodes.push(h('p', { class: 'lina-surface-meta', text: 'Kaynak: ' + a.source, style: 'margin:10px 4px 0' }));
    return nodes;
  }

  function modules() {
    return [head('Modüller', `${L().data.MODULES.length} gerçek rota`), h('ul', { class: 'lina-list' }, L().data.MODULES.map(m => h('li', {}, [
      h('a', { class: 'lina-row', href: m.href }, [h('div', { class: 'lina-row-title', text: m.title }), h('div', { class: 'lina-row-sub', text: m.href.replace('../', '') })])
    ])))];
  }

  const RENDER = { work, now, memory, modules };

  async function show(name) {
    const slot = $('linaSurface');
    const nodes = await RENDER[name]();
    slot.innerHTML = '';
    nodes.forEach(n => slot.appendChild(n));
    slot.hidden = false;
    L().state.setSurface(name);
    document.querySelectorAll('#linaContexts .lina-chip').forEach(c => c.setAttribute('aria-selected', String(c.dataset.surface === name)));
  }

  function clear() {
    const slot = $('linaSurface'); slot.innerHTML = ''; slot.hidden = true;
    L().state.setSurface(null);
    document.querySelectorAll('#linaContexts .lina-chip').forEach(c => c.setAttribute('aria-selected', 'false'));
  }

  /* ---------------- Approval card ---------------- */
  function approval(action, onApprove, onReject) {
    const slot = $('linaSurface');
    slot.innerHTML = '';
    const approveBtn = h('button', { type: 'button', class: 'lina-btn primary', text: 'Onayla', onclick: onApprove });
    const rejectBtn = h('button', { type: 'button', class: 'lina-btn', text: 'Reddet', onclick: onReject });
    slot.appendChild(h('div', { class: 'lina-approval', role: 'group', 'aria-label': 'Onay' }, [
      h('h3', { text: action.title }),
      h('p', { text: action.detail }),
      h('div', { class: 'lina-actions' }, [approveBtn, rejectBtn])
    ]));
    slot.hidden = false;
    rejectBtn.focus();
  }

  window.Lina = window.Lina || {};
  window.Lina.surfaces = { show, clear, approval, openPanel, closePanel, h };
})();
