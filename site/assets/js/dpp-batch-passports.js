(function () {
  "use strict";

  function pickFirst(obj, keys) {
    for (const k of keys) {
      if (obj && typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();
    }
    return "";
  }

  function getSupabaseConfig() {
    const url = pickFirst(window, ["SUPABASE_URL","__SUPABASE_URL","ZERO_SUPABASE_URL","supabaseUrl"]);
    const key = pickFirst(window, ["SUPABASE_ANON_KEY","SUPABASE_KEY","__SUPABASE_ANON_KEY","ZERO_SUPABASE_ANON_KEY","supabaseAnonKey"]);
    return { url, key };
  }

  function findSection(title) {
    const els = Array.from(document.querySelectorAll("h1,h2,h3,h4,section,div"));
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (t === title) return el.closest("section") || el.closest("div") || el.parentElement || document.body;
    }
    return document.body;
  }

  function findTable() {
    const byId =
      document.querySelector("#dppBatchPassports table") ||
      document.querySelector("table[data-dpp='batch-passports']");
    if (byId) return byId;

    const sec = findSection("DPP Batch Passports");
    return sec ? sec.querySelector("table") : null;
  }

  function setStatus(msg, kind) {
    const sec = findSection("DPP Batch Passports");
    const p = sec.querySelector(".dpp-status, [data-dpp-status]") || sec.querySelector("p");
    if (p) {
      p.textContent = msg;
      p.style.opacity = "0.85";
      p.style.color = kind === "err" ? "#b91c1c" : kind === "ok" ? "#065f46" : "";
    }
    (kind === "err" ? console.error : console.log)("[DPP Batch]", msg);
  }

  function fmt(x, d) {
    if (x === null || x === undefined || x === "") return "—";
    const n = Number(x);
    if (!Number.isFinite(n)) return String(x);
    return n.toFixed(d);
  }

  async function fetchRows() {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) {
      setStatus("Supabase config missing (SUPABASE_URL / SUPABASE_ANON_KEY).", "err");
      return [];
    }

    const view = "v_dpp_batch_passports";
    const select = "passport_id,status,facility,total_co2_kg,co2_kg_per_kg,wastewater_risk";
    const endpoint =
      `${url.replace(/\/+$/,"")}/rest/v1/${view}` +
      `?select=${encodeURIComponent(select)}` +
      `&order=passport_id.desc` +
      `&limit=200`;

    setStatus("Loading passports…", "info");

    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setStatus(`Fetch failed: ${res.status} ${res.statusText}${text ? " — " + text : ""}`, "err");
      return [];
    }

    const rows = await res.json();
    setStatus(`Loaded ${Array.isArray(rows) ? rows.length : 0} passport(s).`, "ok");
    return Array.isArray(rows) ? rows : [];
  }

  function ensureFilterBar(sec){
    if (sec.querySelector('[data-filterbar="dpp-batch"]')) return;

    const bar = document.createElement("div");
    bar.setAttribute("data-filterbar","dpp-batch");
    bar.style.display="flex";
    bar.style.gap="10px";
    bar.style.alignItems="center";
    bar.style.margin="10px 0 12px 0";

    bar.innerHTML = `
      <input id="dppBatchSearch" placeholder="Search passport / facility..." style="flex:1; padding:8px 10px; border:1px solid #e5e7eb; border-radius:10px;">
      <select id="dppBatchRisk" style="padding:8px 10px; border:1px solid #e5e7eb; border-radius:10px;">
        <option value="">Risk: All</option>
        <option value="HIGH">HIGH</option>
        <option value="MEDIUM">MEDIUM</option>
        <option value="LOW">LOW</option>
      </select>
      <select id="dppBatchStatus" style="padding:8px 10px; border:1px solid #e5e7eb; border-radius:10px;">
        <option value="">Status: All</option>
        <option value="active">active</option>
        <option value="issued">issued</option>
        <option value="draft">draft</option>
      </select>
    `;

    // button satırı genelde sec içindeki ilk child'larda; bar'ı başlığın altına koy
    sec.insertBefore(bar, sec.children[2] || null);

    const onChange = () => applyFilter();
    bar.querySelector("#dppBatchSearch").addEventListener("input", onChange);
    bar.querySelector("#dppBatchRisk").addEventListener("change", onChange);
    bar.querySelector("#dppBatchStatus").addEventListener("change", onChange);
  }

  let __rows = [];

  function applyFilter(){
    try {
      const q = (document.querySelector("#dppBatchSearch")?.value || "").toLowerCase().trim();
      const risk = (document.querySelector("#dppBatchRisk")?.value || "").trim();
      const st = (document.querySelector("#dppBatchStatus")?.value || "").trim();

      let rows = (__rows || []).slice();

      if (q) rows = rows.filter(r => (String(r.passport_id||"") + " " + String(r.facility||"")).toLowerCase().includes(q));
      if (risk) rows = rows.filter(r => String(r.wastewater_risk||"").toUpperCase() === risk);
      if (st) rows = rows.filter(r => String(r.status||"").toLowerCase() === st);

      render(rows);
    } catch(e) {}
  }

  function render(rows) {
    try{ window.__dppBatchRows = rows || []; window.__dppBatchRender = render; }catch(e){}

    const table = findTable();
    if (!table) {
      setStatus("Table not found in DPP Batch Passports section.", "err");
      return;
    }
    let tbody = table.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      table.appendChild(tbody);
    }
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="padding:12px;opacity:.75;">No passports yet.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:10px;">
          <button class="dpp-view dpp-view-btn"
            data-passport-id="${String(r.passport_id || "").replace(/"/g,"&quot;")}"
            style="padding:6px 10px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;">
            View
          </button>
        </td>
        <td style="padding:10px;font-weight:600;">${r.passport_id || "—"}</td>
        <td style="padding:10px;">${r.status || "—"}</td>
        <td style="padding:10px;">${fmt(r.total_co2_kg, 3)}</td>
        <td style="padding:10px;">${fmt(r.co2_kg_per_kg, 2)}</td>
        <td style="padding:10px;">${(r.wastewater_risk || "—")}</td>
        <td style="padding:10px;">${r.facility || "—"}</td>
      `;
      tbody.appendChild(tr);
    }  }

  async function load() {
    try {
      const sec = findSection("DPP Batch Passports");
      ensureFilterBar(sec);

      __rows = await fetchRows();
      applyFilter();
    } catch (e) {
      setStatus(`Unexpected error: ${e && e.message ? e.message : String(e)}`, "err");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // bind only to the correct button id
    const btn = document.getElementById("btnLoadDppBatch");
    if (btn) btn.addEventListener("click", load);

    // auto-load so it never looks empty
    load();
  });
})();


/* DPP_VIEW_MODAL_V1 */
(function(){
  function ensureModal(){
    if(document.getElementById("dppViewModal")) return;

    var wrap = document.createElement("div");
    wrap.id = "dppViewModal";
    wrap.style.position="fixed";
    wrap.style.inset="0";
    wrap.style.background="rgba(0,0,0,.45)";
    wrap.style.display="none";
    wrap.style.zIndex="9999";
    wrap.style.padding="24px";

    wrap.innerHTML = `
      <div style="max-width:900px;margin:40px auto;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:800;font-size:16px;">Batch Passport — Detail</div>
          <button id="dppModalClose" style="padding:8px 10px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;">Close</button>
        </div>

        <div style="padding:16px;">
          <div id="dppModalCards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;"></div>

          <div style="display:flex;gap:10px;align-items:center;margin:8px 0 12px 0;">
            <button id="dppCopyJson" style="padding:10px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#0b1f49;color:#fff;font-weight:700;">
              Copy JSON
            </button>
            <div id="dppCopyMsg" style="opacity:.7;font-size:13px;"></div>
          </div>

          <pre id="dppModalJson" style="margin:0;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;max-height:360px;overflow:auto;font-size:12px;line-height:1.35;"></pre>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    function close(){
      wrap.style.display="none";
      document.body.style.overflow="";
    }
    wrap.addEventListener("click", (e)=>{ if(e.target===wrap) close(); });
    wrap.querySelector("#dppModalClose").addEventListener("click", close);

    wrap.querySelector("#dppCopyJson").addEventListener("click", async ()=>{
      var pre = wrap.querySelector("#dppModalJson");
      try{
        await navigator.clipboard.writeText(pre.textContent || "");
        wrap.querySelector("#dppCopyMsg").textContent = "Copied ✅";
        setTimeout(()=> wrap.querySelector("#dppCopyMsg").textContent="", 1200);
      }catch(e){
        wrap.querySelector("#dppCopyMsg").textContent = "Copy failed (clipboard permission)";
      }
    });
  }

  function showRow(row){
    ensureModal();
    var wrap = document.getElementById("dppViewModal");
    var cards = wrap.querySelector("#dppModalCards");
    var pre = wrap.querySelector("#dppModalJson");

    var items = [
      ["passport_id", row.passport_id],
      ["status", row.status],
      ["facility", row.facility],
      ["total_co2_kg", row.total_co2_kg],
      ["co2_kg_per_kg", row.co2_kg_per_kg],
      ["wastewater_risk", row.wastewater_risk],
    ];

    cards.innerHTML = items.map(([k,v])=>`
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:10px 12px;background:#fff;">
        <div style="opacity:.65;font-size:12px;margin-bottom:2px;">${k}</div>
        <div style="font-weight:800;">${(v===null||v===undefined||v==="") ? "—" : String(v)}</div>
      </div>
    `).join("");

    pre.textContent = JSON.stringify(row, null, 2);
    wrap.style.display="block";
    document.body.style.overflow="hidden";
  }

  // Table click delegation (works after re-render)
  document.addEventListener("click", (e)=>{
    var b = e.target && e.target.closest ? e.target.closest("button.dpp-view") : null;
    if(!b) return;

    // row index from table order; we keep current rows in __dppBatchRows if available
    var tr = b.closest("tr");
    if(!tr) return;

    // try to map by passport_id cell (2nd cell after Action)
    var tds = tr.querySelectorAll("td");
    var pid = (tds && tds[1] && tds[1].textContent || "").trim();

    var rows = window.__dppBatchRows || [];
    var row = rows.find(r => String(r.passport_id||"").trim() == pid) || null;

    // fallback: build from DOM
    if(!row){
      row = {
        passport_id: pid,
        status: (tds[2] && tds[2].textContent || "").trim(),
        total_co2_kg: (tds[3] && tds[3].textContent || "").trim(),
        co2_kg_per_kg: (tds[4] && tds[4].textContent || "").trim(),
        wastewater_risk: (tds[5] && tds[5].textContent || "").trim(),
        facility: (tds[6] && tds[6].textContent || "").trim(),
      };
    }

    showRow(row);
  });
})();

