/**
 * Lina — shell bootstrap. Wires state → words, input → brain → surfaces, voice → brain.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const L = window.Lina;

  let summaryLines = [];
  let bars = [];

  function renderWords(s) {
    const headline = $('linaHeadline'), summary = $('linaSummary');
    if (s.state === 'idle' && !s.message) {
      headline.textContent = L.data.greeting();
      summary.innerHTML = '';
      summaryLines.forEach(l => summary.appendChild(L.surfaces.h('p', { class: l.tone ? 'is-' + l.tone : '', text: l.text })));
      return;
    }
    headline.textContent = s.message || '';
    summary.innerHTML = '';
    if (s.detail) summary.appendChild(L.surfaces.h('p', { text: s.state === 'listening' ? '“' + s.detail + '”' : s.detail }));
    if (s.state === 'error' && !s.detail) summary.appendChild(L.surfaces.h('p', { text: 'Tekrar deneyebilirim.' }));
  }

  function announce(s) {
    const a = $('linaAnnounce');
    const label = L.state.ARIA_LABEL[s.state];
    if (s.state !== 'idle') a.textContent = label + (s.message ? '. ' + s.message : '');
  }

  function mountVoiceActivity() {
    const wrap = $('linaVoiceActivity');
    for (let i = 0; i < 5; i++) { const b = document.createElement('i'); wrap.appendChild(b); bars.push(b); }
    L.voice.onLevel(level => {
      bars.forEach((b, i) => {
        const weight = [0.5, 0.8, 1, 0.8, 0.5][i];
        b.style.height = Math.max(4, Math.round(4 + level * 14 * weight)) + 'px';
      });
    });
    L.state.subscribe(s => wrap.classList.toggle('is-on', s.state === 'listening'));
  }

  async function renderNodes() {
    const nav = $('linaNodes');
    const list = await L.data.nodes();
    nav.innerHTML = '';
    if (!list.length) { nav.appendChild(L.surfaces.h('span', { class: 'lina-nodes-empty', text: 'Cihaz bağlı değil' })); return; }
    list.forEach(n => nav.appendChild(L.surfaces.h('span', { class: 'lina-node', 'data-state': n.state, title: n.name + ': ' + stateText(n.state) }, [
      L.surfaces.h('i', { class: 'lina-node-dot', 'aria-hidden': 'true' }),
      L.surfaces.h('span', { text: n.name }),
      L.surfaces.h('span', { class: 'sr-only', text: ' ' + stateText(n.state) })
    ])));
    function stateText(s) { return s === 'online' ? 'bağlı' : s === 'offline' ? 'bağlı değil' : 'durum bilinmiyor'; }
  }

  async function refreshSummary() {
    summaryLines = await L.data.summary();
    if (L.state.is('idle')) renderWords(L.state.get());
  }

  /* ---------- Action loop ---------- */
  let busy = false;
  async function handle(text) {
    if (busy) return;
    busy = true;
    L.surfaces.closePanel();
    try {
      L.state.set('thinking', { detail: text });
      const action = await L.brain.resolve(text);
      await perform(action);
    } catch (e) {
      console.error('[lina]', e);
      L.state.set('error', { message: 'Bir sorun oluştu.', detail: 'Tekrar deneyebilirim.' });
    } finally { busy = false; }
  }

  const SURFACE_SAY = { now: 'Bekleyenlere bakıyorum.', work: 'Bugünün işlerine bakıyorum.', memory: 'Hafızaya bakıyorum.', modules: 'Modülleri getiriyorum.' };

  async function perform(a) {
    switch (a.type) {
      case 'noop': L.state.set('idle'); return;
      case 'surface':
      case 'modules': {
        const name = a.type === 'modules' ? 'modules' : a.surface;
        L.state.set('acting', { message: SURFACE_SAY[name] });
        await Promise.all([L.surfaces.show(name), pause(350)]);
        L.state.set('idle');
        return;
      }
      case 'open_module':
        L.state.set('acting', { message: `${a.module.title} modülünü açıyorum.` });
        await pause(500);
        window.location.href = a.module.href;
        return;
      case 'reply':
        L.surfaces.clear();
        L.state.set('idle', { message: a.message, detail: a.detail });
        return;
      case 'approval':
        L.state.set('approval_required', { detail: a.detail });
        L.surfaces.approval(a,
          async () => {
            L.state.set('acting', { message: 'İşlemi gerçekleştiriyorum...' });
            try { await a.run(); await pause(350); L.surfaces.clear(); L.state.set('idle', { message: a.done || 'Tamamlandı.' }); await refreshSummary(); }
            catch (e) { L.state.set('error', { message: 'İşlem tamamlanamadı.', detail: 'Tekrar deneyebilirim.' }); }
          },
          () => { L.surfaces.clear(); L.state.set('idle', { message: 'Reddedildi.', detail: 'Hiçbir şey değişmedi.' }); }
        );
        return;
      default:
        L.surfaces.clear();
        L.state.set('idle', { message: 'Bunu henüz yapamıyorum.', detail: 'Şimdi, İş, Hafıza ya da bir modül adı söyleyebilirsin.' });
    }
  }

  function pause(ms) { return new Promise(r => setTimeout(r, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms)); }

  /* ---------- Boot ---------- */
  function boot() {
    L.presence.mount($('linaPresence'));
    mountVoiceActivity();
    L.state.subscribe(s => { renderWords(s); announce(s); });

    const input = L.input.mount(handle);
    L.voice.onTranscript(handle);

    document.querySelectorAll('#linaContexts .lina-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.surface;
        if (chip.getAttribute('aria-selected') === 'true') { L.surfaces.clear(); return; }
        handle(name === 'now' ? 'şimdi' : name === 'work' ? 'bugün ne kaldı' : 'hafıza');
      });
    });

    $('linaPanelClose').addEventListener('click', L.surfaces.closePanel);
    $('linaPanelBackdrop').addEventListener('click', L.surfaces.closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { L.surfaces.closePanel(); input.closeMenu(); if (L.voice.isActive()) L.voice.stop(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); }
    });

    renderNodes();
    refreshSummary();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSummary(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
