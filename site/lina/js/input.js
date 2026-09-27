/**
 * Lina — input bar.  ＋  Lina’ya söyle...  🎙
 * Text always works. Mic works only when the browser really supports SpeechRecognition.
 * The ＋ opens a small, real menu (contexts + modules); there is no attachment support in this site, so none is shown.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function mount(onSubmit) {
    const L = window.Lina;
    const form = $('linaForm'), input = $('linaInput'), mic = $('linaMic'), plus = $('linaPlus'), menu = $('linaMenu'), hint = $('linaHint');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      onSubmit(v);
    });

    // Microphone
    if (!L.voice.supported) {
      mic.disabled = true;
      mic.setAttribute('aria-label', 'Ses tanıma bu tarayıcıda desteklenmiyor');
      mic.title = 'Ses tanıma bu tarayıcıda desteklenmiyor';
    } else {
      mic.addEventListener('click', () => {
        if (L.voice.isActive()) { L.voice.stop(); return; }
        L.surfaces.closePanel();
        L.voice.start();
      });
    }
    L.state.subscribe(s => {
      mic.setAttribute('aria-pressed', String(s.state === 'listening'));
      mic.setAttribute('aria-label', s.state === 'listening' ? 'Dinlemeyi durdur' : (L.voice.supported ? 'Sesle söyle' : mic.getAttribute('aria-label')));
    });

    // ＋ menu: real contexts only
    function buildMenu() {
      menu.innerHTML = '';
      const add = (label, fn) => menu.appendChild(L.surfaces.h('button', { type: 'button', role: 'menuitem', text: label, onclick: () => { closeMenu(); fn(); } }));
      menu.appendChild(L.surfaces.h('div', { class: 'lina-menu-label', text: 'Bağlam' }));
      add('Şimdi', () => onSubmit('şimdi'));
      add('İş', () => onSubmit('bugün ne kaldı'));
      add('Hafıza', () => onSubmit('hafıza'));
      menu.appendChild(L.surfaces.h('div', { class: 'lina-menu-label', text: 'Modüller' }));
      add('Tüm modüller', () => onSubmit('modüller'));
    }
    function openMenu() { buildMenu(); menu.hidden = false; plus.setAttribute('aria-expanded', 'true'); const f = menu.querySelector('button'); if (f) f.focus(); }
    function closeMenu() { menu.hidden = true; plus.setAttribute('aria-expanded', 'false'); }
    plus.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
    document.addEventListener('click', (e) => { if (!menu.hidden && !form.contains(e.target)) closeMenu(); });
    menu.addEventListener('keydown', (e) => {
      const items = Array.from(menu.querySelectorAll('button'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { closeMenu(); plus.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    });

    hint.textContent = L.voice.supported ? '' : 'Bu tarayıcıda ses tanıma yok; yazarak devam edebilirsin.';

    // Keep the bar above a soft keyboard on mobile Safari.
    if (window.visualViewport) {
      const bar = document.querySelector('.lina-inputbar');
      const sync = () => {
        const vv = window.visualViewport;
        const gap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        bar.style.transform = gap ? `translateY(-${gap}px)` : '';
      };
      window.visualViewport.addEventListener('resize', sync);
      window.visualViewport.addEventListener('scroll', sync);
    }

    return { focus: () => input.focus(), closeMenu };
  }

  window.Lina = window.Lina || {};
  window.Lina.input = { mount };
})();
