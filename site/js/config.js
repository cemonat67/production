// Zero@Ecosystem Configuration
// Centralizes configuration for API endpoints and feature flags.

const ZeroConfig = {
    // n8n Webhook URLs (Mocked for local dev, replace with real URLs in prod)
    // Using localhost endpoints that can be tunneled or mocked
    api: {
        overrideRequest: 'http://localhost:5678/webhook/governance/override-request',
        evidenceGenerator: 'http://localhost:5678/webhook/governance/generate-evidence-pack',
        incidentIntake: 'http://localhost:5678/webhook/ops/incident',
        incidentAck: 'http://localhost:5678/webhook/ops/incident-ack'
    },
    
    // Feature Flags
    features: {
        useRemoteAudit: true, // Attempt to send logs to n8n
        useRemoteEvidence: true // Use n8n for evidence generation
    },

    // Mock responses for Demo/Offline mode if API is unreachable
    mock: {
        evidenceUrl: "data:text/json;charset=utf-8,%7B%22mock%22%3A%22evidence%22%7D",
        evidenceHash: "0xMOCK_HASH_7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
    }
};

window.ZeroConfig = ZeroConfig;

/**
 * Universal n8n Orchestrator Connector
 * Handles connectivity, offline fallbacks, and error reporting.
 */
window.zeroOrchSend = async function(type, payload) {
    if (!window.ZeroConfig || !window.ZeroConfig.api) {
        console.error("ZeroConfig missing");
        return { error: "Config missing" };
    }
    
    let url;
    if (type === 'OVERRIDE') url = window.ZeroConfig.api.overrideRequest;
    else if (type === 'EVIDENCE') url = window.ZeroConfig.api.evidenceGenerator;
    else if (type === 'INCIDENT') url = window.ZeroConfig.api.incidentIntake;
    else if (type === 'INC_ACK') url = window.ZeroConfig.api.incidentAck;
    else {
        console.error("Unknown Orchestrator Type:", type);
        return { error: "Unknown type" };
    }

    console.log(`[Orchestrator] Sending ${type}...`, payload);

    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(id);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`[Orchestrator] ${type} Success:`, data);
        return data;
    } catch (e) {
        console.warn(`[Orchestrator] ${type} failed (Offline/Timeout).`, e);
        // Return offline marker so callers can use fallback logic
        return { error: e.message, offline: true };
    }
};
