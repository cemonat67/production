/**
 * Lina — presence mark.
 * A refined "@": open outer ring, inner loop with stem. No face, no sparkle.
 * State is expressed by small, meaningful additions (echo, dots, arrow, badge),
 * never by colour alone — the headline text always names the state too.
 */
(function () {
  'use strict';

  const SVG = `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
  <g class="lp-echoes">
    <circle class="lp-echo e1" cx="32" cy="32" r="26"/>
    <circle class="lp-echo e2" cx="32" cy="32" r="26"/>
  </g>
  <g class="lp-mark">
    <!-- outer ring, open at lower-right like an @ -->
    <path class="lp-ring" d="M 46.1 46.1 A 20 20 0 1 1 52 32"/>
    <!-- inner loop + stem -->
    <circle class="lp-inner" cx="32" cy="32" r="8.5"/>
    <path class="lp-stem" d="M 40.5 32 V 40.5 Q 40.5 46 46 46"/>
  </g>
  <!-- thinking dots -->
  <circle class="lp-dot l" cx="4" cy="32" r="2"/>
  <circle class="lp-dot r" cx="60" cy="32" r="2"/>
  <!-- acting arrow -->
  <path class="lp-arrow" d="M 58 32 H 68 M 64 27 L 69 32 L 64 37"/>
  <!-- approval badge -->
  <g class="lp-badge">
    <circle cx="54" cy="12" r="7"/>
    <text x="54" y="15.2">!</text>
  </g>
  <!-- error dot -->
  <circle class="lp-err" cx="54" cy="12" r="4"/>
</svg>`;

  function mount(el) {
    if (!el) return;
    el.innerHTML = SVG;
    window.Lina.state.subscribe(s => {
      el.setAttribute('data-state', s.state);
      el.setAttribute('aria-label', window.Lina.state.ARIA_LABEL[s.state] || 'Lina');
    });
  }

  window.Lina = window.Lina || {};
  window.Lina.presence = { mount, SVG };
})();
