(() => {
  
  // ZERO_NOAUTO kill-switch: add ?noauto=1 to URL to disable auto intent redirect
  try {
    const qp = new URLSearchParams(location.search || "");
    if (qp.get("noauto") === "1") { return; }
  } catch(e) {}
const qs = new URLSearchParams(location.search);

  const role =
    (qs.get("role") || qs.get("user_role") || "").toLowerCase() || "ceo";

  const intent_hint =
    (qs.get("intent") || qs.get("intent_hint") || "").toLowerCase() || "";

  const time_pressure =
    (qs.get("urgent") || qs.get("time_pressure") || "false").toLowerCase() === "true";

  const product = (qs.get("product") || "production").toLowerCase();
  const page = (qs.get("page") || "index").toLowerCase();

  // Demo: sadece index sayfasında auto intent çalışsın (loop riskini azaltır)
  const isIndexLike =
    location.pathname.endsWith("/") ||
    location.pathname.endsWith("/index.html") ||
    location.pathname.endsWith("index.html");

  if (!isIndexLike) return;

  const debug = qs.get("debug") === "1";
  const log = (...a) => debug && console.log("[synapse-auto]", ...a);

  const payload = {
    context: {
      product,
      page,
      role,
      intent_hint,
      time_pressure,
      first_session: false
    }
  };

  const url = "/synapse/brain/resolve";

  // ZERO_WHITELIST + FAIL_CLOSED
  const ZERO_WHITELIST = new Set([
    "index.html",
    "GarmentDPP.html",
    "fibredppchatgpt08aug25final.html",
    "yarn-dppchatgptfinal.html",
    "fabric-dppchatgptfinal.html",
    "chemicals-dyes-management.dpp.html",
    "energy-utilities-managementdpp.html",
    "finishingtest-with-rabateks-dpp.html",
    "logisticsmanagementdpp.html",
    "packagingmanagementdpp-2_full_updated.html",
    "rabateks-dpp-retail-distribution-management_full.html",
    "||derdeliverymanagementdpp.html",
    "officedpp.html",
    "officesupplies&&wastedpp.html",
    "itdpp.html",
    "transp||tdpp.html",
    "user-guide.html",
    "system-status.html",
    "R&&omOrderCreat||.html",
    "ManufacturerDatabase.html",
    "RabateksDPP.html"
  ]);

  function safeTarget(t){
    if(!t || typeof t !== "string") return null;
    t = t.trim();

    // Block absolute URLs & protocols
    if (t.startsWith("http://") || t.startsWith("https://") || t.includes("://")) return null;

    // Block paths, queries, fragments
    if (t.startsWith("/") || t.startsWith("\\") || t.startsWith("?") || t.startsWith("#")) return null;

    // Block traversal / nested paths
    if (t.includes("..") || t.includes("/") || t.includes("\\")) return null;

    // Only allow *.html filenames
    if (!t.toLowerCase().endsWith(".html")) return null;

    return ZERO_WHITELIST.has(t) ? t : null;
  }


  log("POST", url, payload);

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(j => {
      log("resolve:", j);
      const rawTarget = j?.action?.target;
      const target = safeTarget(rawTarget);
      log("resolve:", j);
      if (!target) { log("blocked target:", rawTarget); return; }
// Loop guard
      const last = sessionStorage.getItem("ZERO_LAST_TARGET");
      if (last === target) return;
      sessionStorage.setItem("ZERO_LAST_TARGET", target);

      log("redirect ->", target);
      location.href = target;
    })
    .catch(err => log("ERR", err));
})();
