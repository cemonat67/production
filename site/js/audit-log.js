
/**
 * Zero@Ecosystem Audit Log Module
 * Static, local-first audit trail using localStorage.
 */

const ZeroAuditLog = (function() {
    const STORAGE_KEY = 'zero_audit_log_v1';

    function getLogs() {
        const logs = localStorage.getItem(STORAGE_KEY);
        return logs ? JSON.parse(logs) : [];
    }

    function saveLogs(logs) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }

    function generateUUID() { // Simple UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    return {
        /**
         * Log an event to the audit trail.
         * @param {string} type - Event type (e.g. "OVERRIDE_REQUEST")
         * @param {object} payload - Event details (actor_role, item_id, reason, notes, etc.)
         */
        logEvent: function(type, payload) {
            const logs = getLogs();
            const event = {
                id: generateUUID(),
                ts: new Date().toISOString(),
                event_type: type,
                ...payload
            };
            logs.unshift(event); // Newest first
            saveLogs(logs);
            console.log("[AuditLog]", event);
            return event;
        },

        getLogs: getLogs,

        clearLogs: function() {
            localStorage.removeItem(STORAGE_KEY);
        },

        exportJSON: function() {
            const logs = getLogs();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "zero_audit_log_" + new Date().toISOString() + ".json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    };
})();

// Expose globally
window.ZeroAuditLog = ZeroAuditLog;
