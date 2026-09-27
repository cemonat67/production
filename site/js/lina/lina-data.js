/**
 * Lina — data adapters
 * Only real sources from this repository are read here. Anything that is not
 * connected in this deployment is reported as unavailable, never invented.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.Data = (function () {
  // Module registry mirrors ZERO_DEMO_ROUTER in site/index.html (same keys, same files).
  const MODULES = [
    { key: 'fibre',      file: 'fibre-dpp.html',                     label: 'Elyaf (Fibre) DPP',        group: 'Üretim zinciri', desc: 'Ham madde ve elyaf üretimi.' },
    { key: 'yarn',       file: 'yarn-dpp.html',                      label: 'İplik (Yarn) DPP',         group: 'Üretim zinciri', desc: 'İplik üretimi ve portföy yönetimi.' },
    { key: 'fabric',     file: 'fabric-dpp.html',                    label: 'Kumaş (Fabric) DPP',       group: 'Üretim zinciri', desc: 'Kumaş üretimi, örme ve dokuma.' },
    { key: 'chemicals',  file: 'chemicals-dyes-management.dpp.html', label: 'Kimyasal ve Boya',          group: 'Üretim zinciri', desc: 'Kimyasal ve boya yönetimi.' },
    { key: 'finishing',  file: 'finishing-dpp.html',                 label: 'Terbiye (Finishing) DPP',  group: 'Üretim zinciri', desc: 'Terbiye ve apre süreçleri.' },
    { key: 'garment',    file: 'GarmentDPP.html',                    label: 'Konfeksiyon (Garment) DPP', group: 'Üretim zinciri', desc: 'Konfeksiyon ve nihai ürün.' },
    { key: 'packaging',  file: 'packaging-dpp.html',                 label: 'Ambalaj',                   group: 'Lojistik',       desc: 'Ambalaj yönetimi.' },
    { key: 'delivery',   file: 'delivery-dpp.html',                  label: 'Sipariş Teslimatı',         group: 'Lojistik',       desc: 'Sipariş ve teslimat yönetimi.' },
    { key: 'transport',  file: 'transport-dpp.html',                 label: 'Personel Ulaşımı',          group: 'Lojistik',       desc: 'Personel servis ve ulaşım.' },
    { key: 'retail',     file: 'retail-dpp.html',                    label: 'Perakende ve Dağıtım',      group: 'Lojistik',       desc: 'Perakende ve dağıtım ağı.' },
    { key: 'energy',     file: 'energy-dpp.html',                    label: 'Enerji ve Altyapı',         group: 'Tesis',          desc: 'Enerji ve altyapı tüketimi.' },
    { key: 'wastewater', file: 'wastewater-intelligence.html',       label: 'Atık Su Zekâsı',            group: 'Tesis',          desc: 'Ekoten atık su deşarj verisi.' },
    { key: 'office',     file: 'office-dpp.html',                    label: 'Ofis DPP',                  group: 'Tesis',          desc: 'Ofis kaynakları ve atık.' },
    { key: 'it',         file: 'it-dpp.html',                        label: 'Bilgi İşlem (IT) DPP',      group: 'Tesis',          desc: 'BT altyapısı ve yapay zekâ maliyeti.' }
  ];

  const RULE_LABELS = {
    DATA_HALT: 'Veri bütünlüğü',
    LEGAL_BAN: 'Yasal kısıt (EU Green Claims)',
    DISCOUNT_BLOCK: 'Marj erozyonu'
  };

  function fetchWithTimeout(url, opts, ms) {
    const controller = new AbortController();
    const id = setTimeout(function () { controller.abort(); }, ms || 4000);
    const merged = Object.assign({}, opts || {}, { signal: controller.signal });
    return fetch(url, merged).finally(function () { clearTimeout(id); });
  }

  async function loadJson(url) {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 6000);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
    return res.json();
  }

  /** Product portfolio from the static data files shipped with the site. */
  async function loadPortfolio() {
    const out = { fibres: [], fabrics: [], yarns: [], errors: [] };
    const jobs = [
      loadJson('assets/data/fibre-cards.json').then(function (d) { out.fibres = d.cards || []; }),
      loadJson('assets/data/fabric-cards.json').then(function (d) { out.fabrics = d.cards || []; }),
      loadJson('data/yarns.json').then(function (d) { out.yarns = Array.isArray(d) ? d : []; })
    ];
    const results = await Promise.allSettled(jobs);
    results.forEach(function (r, i) {
      if (r.status === 'rejected') out.errors.push(['fibre', 'fabric', 'yarn'][i]);
    });
    return out;
  }

  /**
   * Decisions waiting for a human — derived from the existing governance engine.
   * These are the same blocks the DPP pages enforce; nothing is fabricated.
   */
  function computeApprovals(yarns) {
    const G = window.ZeroGovernance;
    if (!G || !Array.isArray(yarns)) return [];
    const list = [];
    yarns.forEach(function (y) {
      const itemId = y.id || y.yarn_id;
      if (!itemId) return;
      [['blocker', G.shouldBlockSale(y)], ['gate', G.shouldBlockDiscount(y)]].forEach(function (pair) {
        const kind = pair[0], b = pair[1];
        if (b && b.blocked) {
          list.push({
            kind: kind,           // blocker: sale is stopped · gate: action needs a role's approval
            itemId: itemId,
            name: y.name || itemId,
            ruleId: b.ruleId,
            ruleLabel: RULE_LABELS[b.ruleId] || b.ruleId,
            reason: b.reason,
            roleRequired: b.roleRequired,
            currentValue: b.current_value,
            threshold: b.threshold,
            status: y.strategic_status || null
          });
        }
      });
    });
    return list;
  }

  function approvalCounts(list) {
    const c = { blockers: 0, gates: 0 };
    (list || []).forEach(function (a) { if (a.kind === 'blocker') c.blockers++; else c.gates++; });
    return c;
  }

  /** Portfolio counts by strategic status (real field in yarns.json). */
  function portfolioStatus(yarns) {
    const c = { HERO: 0, TRANSFORM: 0, EXIT: 0 };
    (yarns || []).forEach(function (y) { if (c[y.strategic_status] != null) c[y.strategic_status]++; });
    return c;
  }

  /** Local audit ledger (localStorage). Merges both keys used across the site. */
  function loadMemory() {
    let entries = [];
    try {
      if (window.ZeroAuditLog && typeof window.ZeroAuditLog.getLogs === 'function') {
        entries = entries.concat(window.ZeroAuditLog.getLogs() || []);
      }
      const legacy = JSON.parse(localStorage.getItem('zero_audit_log_v1') || '[]');
      if (Array.isArray(legacy)) entries = entries.concat(legacy);
    } catch (e) { /* storage may be blocked; report empty */ }
    const seen = {};
    return entries
      .filter(function (e) { if (!e || !e.id || seen[e.id]) return false; seen[e.id] = 1; return true; })
      .sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
  }

  const STRATEGY_DOCS = [
    { title: 'CEO Karar Özeti',        file: 'strategy/01_CEO_Decision_Brief.md' },
    { title: 'CFO Etki Anlık Görüntüsü', file: 'strategy/02_CFO_Impact_Snapshot.md' },
    { title: 'Karar Mantığı',          file: 'strategy/04_Decision_Logic.md' },
    { title: 'Yönetişim ve Kontrol',   file: 'strategy/07_Governance_And_Control.md' },
    { title: 'Satış Oyun Kitabı',      file: 'strategy/03_Sales_Playbook.md' }
  ];

  /* ------------------------------------------------------------------
     Node status — real reachability probes against the systems this
     deployment is configured with. No device telemetry exists here.
     ------------------------------------------------------------------ */
  function nodeDefs() {
    const cfg = window.ZeroConfig && window.ZeroConfig.api;
    const nodes = [];
    nodes.push({ id: 'supabase', label: 'Supabase', status: 'checking', detail: 'Veri katmanı' });
    if (cfg && cfg.overrideRequest) nodes.push({ id: 'n8n', label: 'n8n', status: 'checking', detail: 'Orkestratör' });
    nodes.push({ id: 'synapse', label: 'Synapse', status: 'checking', detail: 'Karar zekâsı' });
    return nodes;
  }

  async function probeSupabase() {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return { status: 'unavailable', detail: 'Yapılandırılmamış' };
    try {
      const res = await fetchWithTimeout(window.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', {
        headers: { apikey: window.SUPABASE_ANON_KEY }
      }, 4000);
      if (res.ok) return { status: 'online', detail: 'Erişilebilir' };
      if (res.status === 401 || res.status === 403) return { status: 'attention', detail: 'Erişilebilir, yetki reddedildi' };
      return { status: 'attention', detail: 'HTTP ' + res.status };
    } catch (e) {
      return { status: 'unavailable', detail: 'Ulaşılamadı' };
    }
  }

  async function probeOpaque(url, detailOk) {
    try {
      await fetchWithTimeout(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }, 3000);
      return { status: 'online', detail: detailOk || 'Erişilebilir' };
    } catch (e) {
      return { status: 'unavailable', detail: 'Ulaşılamadı' };
    }
  }

  function n8nOrigin() {
    try { return new URL(window.ZeroConfig.api.overrideRequest).origin; } catch (e) { return null; }
  }

  async function probeNode(node) {
    if (node.id === 'supabase') return probeSupabase();
    if (node.id === 'n8n') {
      const origin = n8nOrigin();
      if (!origin) return { status: 'unavailable', detail: 'Yapılandırılmamış' };
      if (location.protocol === 'https:' && origin.indexOf('http:') === 0) {
        return { status: 'unavailable', detail: 'Yerel adres, bu sayfadan erişilemez' };
      }
      return probeOpaque(origin + '/healthz');
    }
    if (node.id === 'synapse') return probeOpaque('https://synapse.zeroatecosystem.com/health');
    return { status: 'unavailable', detail: 'Bilinmiyor' };
  }

  /** Probes every node; calls onUpdate(nodes) as each result arrives. */
  async function probeNodes(onUpdate) {
    const nodes = nodeDefs();
    onUpdate(nodes.slice());
    await Promise.all(nodes.map(async function (n) {
      const r = await probeNode(n);
      n.status = r.status; n.detail = r.detail; n.checkedAt = new Date();
      onUpdate(nodes.slice());
    }));
    return nodes;
  }

  return {
    MODULES: MODULES,
    RULE_LABELS: RULE_LABELS,
    STRATEGY_DOCS: STRATEGY_DOCS,
    moduleByKey: function (k) { return MODULES.filter(function (m) { return m.key === k; })[0] || null; },
    loadPortfolio: loadPortfolio,
    computeApprovals: computeApprovals,
    approvalCounts: approvalCounts,
    portfolioStatus: portfolioStatus,
    loadMemory: loadMemory,
    probeNodes: probeNodes
  };
})();
