/**
 * Lina — data sources.
 * Every source reports {ok, rows|value, error, source}. Nothing is fabricated:
 * a source that cannot be reached says so and the UI renders an honest empty state.
 */
(function () {
  'use strict';

  const cfg = window.LinaConfig = Object.assign({
    userName: 'Cem',
    locale: 'tr-TR',
    // Devices with real probes only. Each: { id, name, probe: async () => 'online'|'offline'|'unknown' }
    // No probe exists in this deployment, so the list is empty and the UI says so.
    nodes: []
  }, window.LinaConfig || {});

  // Real routes that exist in this site (mirrors the module map in site/index.html router).
  const MODULES = [
    { key: 'garment',    title: 'Garment DPP',            href: '../GarmentDPP.html',                   words: ['garment', 'giysi', 'konfeksiyon'] },
    { key: 'fabric',     title: 'Fabric DPP',             href: '../fabric-dpp.html',                   words: ['fabric', 'kumaş', 'kumas'] },
    { key: 'yarn',       title: 'Yarn DPP',               href: '../yarn-dpp.html',                     words: ['yarn', 'iplik'] },
    { key: 'fibre',      title: 'Fibre DPP',              href: '../fibre-dpp.html',                    words: ['fibre', 'fiber', 'elyaf'] },
    { key: 'chemicals',  title: 'Chemicals & Dyes DPP',   href: '../chemicals-dyes-management.dpp.html', words: ['chemical', 'kimyasal', 'boya'] },
    { key: 'finishing',  title: 'Finishing DPP',          href: '../finishing-dpp.html',                words: ['finishing', 'terbiye', 'apre'] },
    { key: 'energy',     title: 'Energy DPP',             href: '../energy-dpp.html',                   words: ['energy', 'enerji'] },
    { key: 'retail',     title: 'Retail DPP',             href: '../retail-dpp.html',                   words: ['retail', 'perakende', 'mağaza', 'magaza'] },
    { key: 'transport',  title: 'Transport DPP',          href: '../transport-dpp.html',                words: ['transport', 'ulaşım', 'ulasim', 'servis'] },
    { key: 'delivery',   title: 'Delivery DPP',           href: '../delivery-dpp.html',                 words: ['delivery', 'teslimat', 'sevkiyat'] },
    { key: 'packaging',  title: 'Packaging DPP',          href: '../packaging-dpp.html',                words: ['packaging', 'ambalaj', 'paket'] },
    { key: 'office',     title: 'Office DPP',             href: '../office-dpp.html',                   words: ['office', 'ofis'] },
    { key: 'it',         title: 'IT DPP',                 href: '../it-dpp.html',                       words: ['it dpp', 'bilgi işlem', 'bilişim', 'bilisim'] },
    { key: 'wastewater', title: 'Wastewater Intelligence', href: '../wastewater-intelligence.html',     words: ['wastewater', 'atık su', 'atik su', 'atıksu'] }
  ];

  /* ---------- Supabase: DPP batch passports (same view/select as dpp-batch-passports.js) ---------- */
  let passportCache = null;
  async function passports(force) {
    if (!force && passportCache && (Date.now() - passportCache.ts) < 60000) return passportCache.result;
    const url = (window.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = window.SUPABASE_ANON_KEY || '';
    const source = 'Supabase · public.v_dpp_batch_passports';
    if (!url || !key) return remember({ ok: false, rows: [], error: 'config', source });

    const select = 'passport_id,status,facility,total_co2_kg,co2_kg_per_kg,wastewater_risk';
    const endpoint = `${url}/rest/v1/v_dpp_batch_passports?select=${encodeURIComponent(select)}&order=passport_id.desc&limit=200`;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(endpoint, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(t);
      if (!res.ok) return remember({ ok: false, rows: [], error: (res.status === 401 || res.status === 403) ? 'auth' : `HTTP ${res.status}`, source });
      const rows = await res.json();
      return remember({ ok: true, rows: Array.isArray(rows) ? rows : [], error: null, source });
    } catch (e) {
      return remember({ ok: false, rows: [], error: e && e.name === 'AbortError' ? 'timeout' : 'network', source });
    }
    function remember(result) { passportCache = { ts: Date.now(), result }; return result; }
  }

  /* ---------- Local audit log (site/js/audit-log.js, localStorage) ---------- */
  function auditLog() {
    const source = 'Bu tarayıcı · localStorage · zero_audit_log_v1';
    if (!window.ZeroAuditLog) return { ok: false, rows: [], error: 'module', source };
    try { return { ok: true, rows: window.ZeroAuditLog.getLogs() || [], error: null, source }; }
    catch (e) { return { ok: false, rows: [], error: 'parse', source }; }
  }

  /* ---------- Governance overrides (sessionStorage, 30 min TTL — governance-engine.js) ---------- */
  function overrides() {
    const source = 'Bu oturum · sessionStorage · zero_override_*';
    const rows = [];
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k || k.indexOf('zero_override_') !== 0) continue;
        const v = JSON.parse(sessionStorage.getItem(k));
        if (!v || (v.expiresAt && Date.now() > v.expiresAt)) continue;
        const parts = k.replace('zero_override_', '').split('_');
        rows.push({ key: k, itemId: parts[0], ruleId: parts.slice(1).join('_'), ...v });
      }
    } catch (e) { return { ok: false, rows: [], error: 'parse', source }; }
    return { ok: true, rows, error: null, source };
  }

  /* ---------- Devices / nodes: only real probes ---------- */
  async function nodes() {
    const out = [];
    for (const n of cfg.nodes) {
      let state = 'unknown';
      if (typeof n.probe === 'function') {
        try { state = await n.probe(); } catch (e) { state = 'unknown'; }
      }
      out.push({ id: n.id, name: n.name, state: ['online', 'offline'].indexOf(state) >= 0 ? state : 'unknown' });
    }
    return out;
  }

  /* ---------- Greeting & summary (only real facts) ---------- */
  function greeting(date) {
    const h = (date || new Date()).getHours();
    const part = h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
    return cfg.userName ? `${part} ${cfg.userName}.` : `${part}.`;
  }

  async function summary() {
    const lines = [];
    const p = await passports();
    if (p.ok) {
      const open = p.rows.filter(r => String(r.status || '').toLowerCase() === 'draft').length;
      const high = p.rows.filter(r => String(r.wastewater_risk || '').toUpperCase() === 'HIGH').length;
      if (p.rows.length === 0) lines.push({ text: 'Kayıtlı batch pasaportu yok.' });
      else {
        lines.push({ text: open > 0 ? `Bugün açık kalan ${open} taslak pasaport var.` : `${p.rows.length} pasaport kayıtlı, açık taslak yok.` });
        if (high > 0) lines.push({ text: `${high} pasaportta yüksek atık su riski var.`, tone: 'danger' });
        else lines.push({ text: 'Yüksek riskli pasaport yok.', tone: 'ok' });
      }
    } else {
      lines.push({ text: passportError(p.error) });
    }
    const o = overrides();
    if (o.ok && o.rows.length) lines.push({ text: `${o.rows.length} aktif override var.` });
    return lines;
  }

  function passportError(code) {
    if (code === 'auth') return 'Pasaport verisine erişim izni yok.';
    if (code === 'config') return 'Pasaport verisi yapılandırılmamış.';
    return 'Pasaport verisine şu anda ulaşılamıyor.';
  }

  function fmtDate(iso) {
    try { return new Intl.DateTimeFormat(cfg.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
    catch (e) { return String(iso || ''); }
  }

  window.Lina = window.Lina || {};
  window.Lina.data = { cfg, MODULES, passports, auditLog, overrides, nodes, greeting, summary, fmtDate, passportError };
})();
