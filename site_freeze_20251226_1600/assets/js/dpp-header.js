(() => {
  // Inject standardized header into ALL DPP pages.
  // Goal: left-aligned, navy, consistent logo + typography.

  const BRAND_DEFAULT = "Zero@Production";
  const SUB_DEFAULT =
    "Digital Product Passport Management Hub. Complete transparency and traceability across your entire garment manufacturing and retail ecosystem.";

  const fileTitleMap = {
    "garmentdpp.html": "Garment DPP",
    "fibredppchatgpt08aug25final.html": "Fibre DPP",
    "fibredppchatgpt08aug25final copy.html": "Fibre DPP",
    "yarn-dppchatgptfinal.html": "Yarn DPP",
    "fabric-dppchatgptfinal.html": "Fabric DPP",
    "finishingtest-with-rabateks-dpp.html": "Finishing DPP",
    "chemicals-dyes-management.dpp.html": "Chemicals & Dyes DPP",
    "energy-utilities-managementdpp.html": "Energy & Utilities DPP",
    "logisticsmanagementdpp.html": "Logistics DPP",
    "packagingmanagementdpp-2_full_updated.html": "Packaging DPP",
    "orderdeliverymanagementdpp.html": "Order Delivery DPP",
    "transportdpp.html": "Employee Transport DPP",
    "officedpp.html": "Office DPP",
    "officesuppliesandwastedpp.html": "Office Supplies & Waste DPP",
    "itdpp.html": "IT DPP",
    "manufacturerdatabase.html": "Manufacturer Database",
    "randomordercreator.html": "Random Order Creator",
    "system-status.html": "System Status",
    "rabateks-dpp-retail-distribution-management_full.html": "Retail & Distribution DPP",
    "rabateksdpp.html": "Production Dashboard"
  };

  function ensureDppTitle(x){
    const t = (x || "").replace(/\s+/g, " ").trim();
    if (!t) return t;
    const low = t.toLowerCase();
    if (low.includes("dpp")) return t;
    if (low.includes("dashboard") || low === "index" || low === "zero@production") return "Dashboard — DPP";
    return t + " — DPP";
  }



  function pickTitle() {
    // Prefer <title>, but if it is generic, use filename map
    const t = (document.title || "").trim();
    if (t && t.toLowerCase() !== "zero@production") return ensureDppTitle(t);

    const fn = (location.pathname.split("/").pop() || "").toLowerCase();
    if (fileTitleMap[fn]) return ensureDppTitle(fileTitleMap[fn]);

    // fallback: first H1 text (cleaned)
    const h1 = document.querySelector("h1");
    const h1t = (h1?.textContent || "").replace(/\s+/g, " ").trim();
    if (h1t && !h1t.toLowerCase().includes("zero@production")) return h1t;

    return "DPP";
  }

  function pickBrand() {
    const m = document.querySelector('meta[name="dpp-brand"]');
    return (m?.getAttribute("content") || "").trim() || BRAND_DEFAULT;
  }

  function pickSubtitle() {
    const m = document.querySelector('meta[name="dpp-subtitle"]');
    return (m?.getAttribute("content") || "").trim() || SUB_DEFAULT;
  }

  function hideLegacyHeaders() {
    
    // __ZERO_KILL_LEGACY_V2
    try{
      // 1) remove the classic legacy header block entirely
      document.querySelectorAll("header.header").forEach(h => h.remove());

      // 2) remove leftover logo wrappers (but never touch our injected dpp-header)
      const kill = [".logo-container", ".logo", ".header-content", ".logo-section", ".logo-container svg", ".brand-logo", ".navbar-brand", ".brand"];
      kill.forEach(sel=>{
        document.querySelectorAll(sel).forEach(el=>{
          if (el.closest && el.closest(".dpp-header")) return;
          // if it's inside a legacy header, remove the header; else hide the node
          const legacyHeader = el.closest && el.closest("header");
          if (legacyHeader && legacyHeader.classList && legacyHeader.classList.contains("header")) {
            legacyHeader.remove();
          } else {
            el.style.display="none";
            el.style.visibility="hidden";
          }
        });
      });
    }catch(e){}
// Best-effort: hide top header-ish containers that contain "Zero@Production"
    const candidates = [
      document.querySelector("header"),
      document.querySelector(".header"),
      document.querySelector(".top-header"),
      document.querySelector(".page-header"),
      document.querySelector(".navbar"),
    ].filter(Boolean);

    for (const el of candidates) {
      const txt = (el.textContent || "").toLowerCase();
      if (txt.includes("zero") && txt.includes("production")) {
        el.classList.add("legacy-dpp-header");
      }
    }

    // Also hide a first-block H1 container if it looks like the old banner
    const h1 = document.querySelector("h1");
    if (h1) {
      const txt = (h1.textContent || "").toLowerCase();
      if (txt.includes("zero") && txt.includes("production")) {
        const wrap = h1.closest("div,section,header") || h1;
        wrap.classList.add("legacy-dpp-header");
      }
    }
  }

  function injectHeader() {
    if (document.querySelector(".dpp-header")) return;

    document.documentElement.classList.add("dpp-header-on");

    const header = document.createElement("div");
    header.className = "dpp-header";
    header.innerHTML = `
  <div class="dpp-left">
    <a class="dpp-home" href="index.html" title="Zero@Production">
      <img src="assets/img/logo.png" alt="Zero@Production" class="dpp-logo">
    </a>
  </div>

  <div class="dpp-center">
    <div class="dpp-title">${pickTitle()}</div>
    <div class="dpp-subtitle">${pickSubtitle()}</div>
  </div>

  <div class="dpp-right">
    <a class="dpp-back" href="index.html">← Back to Production</a>
  </div>
`;
document.body.insertBefore(header, document.body.firstChild);
  }

  try {
    hideLegacyHeaders();
    injectHeader();
  } catch(e) {
    // fail silently: never break page
  }
})();
