/**
 * Zero@Ecosystem Self-Healing & Resilience Module
 * Detects fatal errors, missing data, and API outages.
 * Fails safely to "Degraded Mode" without crashing the UI.
 */
const ZeroSelfHeal = (function() {
    
    const STATE = {
        isDegraded: false,
        synapseOnline: true,
        dataIntegrity: 'UNKNOWN', // OK, FAIL
        buildStamp: '2025-12-24-BUILD-001'
    };

    // Initialize Global Error Handlers
    function init() {
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            handleFatalError('JS_EXCEPTION', `${msg} @ ${lineNo}:${columnNo}`);
            return false; // Let default handler run too
        };

        window.onunhandledrejection = function(event) {
            handleFatalError('PROMISE_REJECTION', event.reason);
        };

        console.log("[ZeroSelfHeal] Guardian active.");
        checkSynapseHealth();
        checkBuildFreshness();
    }

    function handleFatalError(type, details) {
        console.error(`[ZeroSelfHeal] ${type}:`, details);
        STATE.isDegraded = true;
        showDegradedBanner("System recovering from unexpected error. Some features may be limited.");
        
        if (window.ZeroAuditLog) {
            window.ZeroAuditLog.logEvent('self_heal.degraded', {
                reason: type,
                details: typeof details === 'object' ? JSON.stringify(details) : details,
                url: window.location.href
            });
        }
    }

    function showDegradedBanner(msg) {
        // 3. SELF-HEALING BANNER KONTROLÜ (DEMO MODE)
        const isDemo = sessionStorage.getItem('zero_demo_mode') === 'ON';
        if (!isDemo) {
            console.log("[ZeroSelfHeal] Banner suppressed (Demo Mode OFF):", msg);
            return;
        }

        let banner = document.getElementById('zero-heal-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'zero-heal-banner';
            banner.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%;
                background: #D51635; color: white; text-align: center;
                padding: 8px; z-index: 9999; font-weight: bold; font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                display: flex; align-items: center; justify-content: center; gap: 15px;
            `;
            document.body.prepend(banner);
        }
        
        banner.innerHTML = `
            <span>⚠️ ${msg}</span>
            <button id="zero-heal-ack-btn" style="
                background: rgba(255,255,255,0.2); 
                border: 1px solid rgba(255,255,255,0.4); 
                color: white; 
                padding: 2px 8px; 
                border-radius: 4px; 
                cursor: pointer; 
                font-size: 12px;">
                Acknowledge
            </button>
        `;
        
        document.getElementById('zero-heal-ack-btn').onclick = function() {
            banner.style.display = 'none';
            
            const incidentId = 'INC-' + Date.now();
            
            // Log locally
            if (window.ZeroAuditLog) {
                window.ZeroAuditLog.logEvent('INCIDENT_ACKNOWLEDGED', {
                    details: msg,
                    actor_role: 'OPERATOR',
                    item_id: incidentId
                });
            }
            
            // Call n8n Webhook via Helper
            ackIncident(incidentId);
        };
    }

    async function sendIncident(event_type, details){
        if (typeof window.zeroOrchSend !== 'function') return;
        try{
            await zeroOrchSend("INCIDENT", {
                event_type,
                timestamp: new Date().toISOString(),
                client_build: window.__ZERO_BUILD_TS || "",
                demo_mode: (sessionStorage.getItem("zero_demo_mode")==="ON") ? "ON":"OFF",
                details: details || {}
            });
        }catch(e){}
    }

    async function ackIncident(incident_id){
        if (typeof window.zeroOrchSend !== 'function') return;
        try{
            await zeroOrchSend("INC_ACK", {
                incident_id,
                timestamp: new Date().toISOString(),
                actor_role: sessionStorage.getItem("zero_role") || "SYSTEM",
                actor_id: "demo_user"
            });
        }catch(e){}
    }

    // Ping Synapse API (Mocked for now or real endpoint)
    async function checkSynapseHealth() {
        const HEALTH_ENDPOINT = 'https://synapse.zeroatecosystem.com/health'; 
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000); // 3s timeout
            
            const response = await fetch(HEALTH_ENDPOINT, { 
                method: 'HEAD', 
                signal: controller.signal,
                mode: 'no-cors' // Opaque response is fine for "is it up"
            });
            clearTimeout(id);
            
            STATE.synapseOnline = true;
            console.log("[ZeroSelfHeal] Synapse Brain is ONLINE.");
        } catch (e) {
            STATE.synapseOnline = false;
            console.warn("[ZeroSelfHeal] Synapse Brain unreachable. Switching to LOCAL INTENT mode.");
            
            // Notify UI to disable "Live AI" badges
            document.querySelectorAll('.synapse-status').forEach(el => {
                el.classList.add('offline');
                el.title = "AI Offline - Using Local Rules";
            });

            if (window.ZeroAuditLog) {
                window.ZeroAuditLog.logEvent('system.synapse_down', { timestamp: new Date() });
            }
        }
    }

    // Check Data Integrity (called after fetch)
    function checkDataIntegrity(yarns) {
        if (!yarns || !Array.isArray(yarns)) {
            handleFatalError('DATA_LOAD_FAIL', 'Yarn data is missing or corrupt.');
            return;
        }

        let failCount = 0;
        yarns.forEach(yarn => {
            // Critical checks: CO2, Composition
            if (!yarn.co2 || yarn.co2 <= 0 || !yarn.composition) {
                failCount++;
                // Force-mark in object (transient)
                yarn.governance = yarn.governance || {};
                yarn.governance.data_integrity = 'FAIL';
                yarn.strategic_status = 'EXIT'; // Force exit status
            }
        });

        if (failCount > 0) {
            STATE.dataIntegrity = 'FAIL';
            showDegradedBanner(`Data Integrity Alert: ${failCount} products have missing critical data.`);
            if (window.ZeroAuditLog) {
                window.ZeroAuditLog.logEvent('data_integrity.fail', { count: failCount });
            }
        } else {
            STATE.dataIntegrity = 'OK';
        }
    }

    function checkBuildFreshness() {
        // Simple stamp check
        const current = STATE.buildStamp;
        console.log(`[ZeroSelfHeal] Build: ${current}`);
        
        // Render Build Info & Hard Refresh & Demo Indicator
        const buildInfo = document.createElement('div');
        buildInfo.id = 'zero-build-info';
        buildInfo.style.cssText = "position: fixed; bottom: 5px; right: 5px; font-size: 10px; color: #ccc; z-index: 1000; background:rgba(255,255,255,0.9); padding:4px 8px; border-radius:4px; display:flex; align-items:center; gap:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);";
        
        const isDemo = sessionStorage.getItem('zero_demo_mode') === 'ON';
        const demoColor = isDemo ? '#27ae60' : '#bdc3c7';
        const demoText = isDemo ? 'Presentation: ON' : 'Presentation: OFF';
        const demoTextColor = isDemo ? '#fff' : '#555';

        buildInfo.innerHTML = `
            <span id="zero-demo-indicator" style="background:${demoColor}; color:${demoTextColor}; padding:2px 6px; border-radius:4px; font-weight:bold;">${demoText}</span>
            <span>Build: ${current}</span>
            <button onclick="window.location.reload(true)" style="cursor:pointer; border:1px solid #ccc; background:#fff; font-size:10px; padding:2px 5px; border-radius:3px;">Refresh</button>
        `;
        document.body.appendChild(buildInfo);
    }

    // Report to n8n
    function reportIncident(type, details) {
        sendIncident(type, details);
    }

    // Public API
    return {
        init: init,
        checkDataIntegrity: checkDataIntegrity,
        getHealth: function() { return STATE; },
        report: reportIncident
    };

})();

// Auto-start
ZeroSelfHeal.init();
