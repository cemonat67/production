/**
 * Lina — state model
 * One screen, one assistant, one context. UI derives from this store.
 * Classic script (no bundler), namespaced under window.ZeroLina.
 */
window.ZeroLina = window.ZeroLina || {};

ZeroLina.State = (function () {
  const LINA_STATES = ['idle', 'listening', 'thinking', 'acting', 'approval_required', 'error'];
  const CONTEXT_TYPES = ['general', 'now', 'work', 'memory', 'module', 'industrial', 'device', 'home', 'agent'];

  const store = {
    lina: 'idle',
    statusText: '',
    context: { type: 'general', id: null, title: null },
    panelOpen: false,
    nodes: [],          // [{ id, label, status: 'checking'|'online'|'unavailable'|'attention'|'critical', detail }]
    approvals: [],      // computed from ZeroGovernance
    portfolio: null,    // { fibres, fabrics, yarns, errors: [] }
    memory: [],         // audit ledger entries
    attachments: [],    // { name, size, type } — local context only
    thread: [],         // { who: 'you'|'lina', text }
    pendingApproval: null,
    error: null
  };

  const listeners = new Set();

  function emit(changed) {
    listeners.forEach(function (fn) {
      try { fn(store, changed); } catch (e) { console.error('[Lina] listener failed', e); }
    });
  }

  function set(patch) {
    const changed = Object.keys(patch);
    changed.forEach(function (k) { store[k] = patch[k]; });
    emit(changed);
  }

  function setLina(next, statusText) {
    if (LINA_STATES.indexOf(next) === -1) {
      console.warn('[Lina] unknown state', next);
      return;
    }
    set({ lina: next, statusText: statusText == null ? store.statusText : statusText });
  }

  function setContext(type, extra) {
    if (CONTEXT_TYPES.indexOf(type) === -1) {
      console.warn('[Lina] unknown context', type);
      type = 'general';
    }
    const ctx = Object.assign({ type: type, id: null, title: null }, extra || {});
    set({ context: ctx });
  }

  function say(text) {
    const thread = store.thread.concat([{ who: 'lina', text: text }]).slice(-6);
    set({ thread: thread });
  }

  function heard(text) {
    const thread = store.thread.concat([{ who: 'you', text: text }]).slice(-6);
    set({ thread: thread });
  }

  return {
    LINA_STATES: LINA_STATES,
    CONTEXT_TYPES: CONTEXT_TYPES,
    get: function () { return store; },
    set: set,
    setLina: setLina,
    setContext: setContext,
    say: say,
    heard: heard,
    subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
  };
})();
