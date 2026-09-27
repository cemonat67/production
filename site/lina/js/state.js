/**
 * Lina — UI state model.
 * One store, one screen. Surfaces subscribe; nothing else holds state.
 *
 * type LinaState = "idle" | "listening" | "thinking" | "acting" | "approval_required" | "error"
 */
(function () {
  'use strict';

  const STATES = ['idle', 'listening', 'thinking', 'acting', 'approval_required', 'error'];

  const DEFAULT_MESSAGE = {
    idle: '',
    listening: 'Dinliyorum...',
    thinking: 'Kontrol ediyorum...',
    acting: 'İşlemi gerçekleştiriyorum...',
    approval_required: 'Onay gerekiyor',
    error: 'Bir bağlantı sorunu var.'
  };

  const ARIA_LABEL = {
    idle: 'Lina, hazır',
    listening: 'Lina dinliyor',
    thinking: 'Lina kontrol ediyor',
    acting: 'Lina işlem yapıyor',
    approval_required: 'Lina onay bekliyor',
    error: 'Lina bir sorunla karşılaştı'
  };

  const store = {
    state: 'idle',
    message: '',
    detail: '',
    payload: null,
    surface: null,          // "now" | "work" | "memory" | null
    context: 'general'      // general | work | memory | agent | device | home | industrial
  };

  const listeners = new Set();
  function emit() { listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.error('[lina.state]', e); } }); }
  function snapshot() { return Object.assign({}, store); }

  function set(state, opts) {
    if (STATES.indexOf(state) < 0) throw new Error('Unknown Lina state: ' + state);
    opts = opts || {};
    store.state = state;
    store.message = (opts.message != null) ? opts.message : DEFAULT_MESSAGE[state];
    store.detail = opts.detail || '';
    store.payload = opts.payload || null;
    emit();
  }

  function setSurface(surface, context) {
    store.surface = surface || null;
    store.context = context || (surface === 'work' ? 'work' : surface === 'memory' ? 'memory' : 'general');
    emit();
  }

  function subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }

  window.Lina = window.Lina || {};
  window.Lina.state = {
    STATES, DEFAULT_MESSAGE, ARIA_LABEL,
    get: snapshot, set, setSurface, subscribe,
    is: (s) => store.state === s
  };
})();
