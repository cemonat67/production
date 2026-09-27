# Lina — Zero@System interface shell

One screen. One assistant. One context.

`site/lina/` is an additive shell over the existing Zero@Production site. It does not
modify any DPP page, loader, or script; it reuses them.

## Product model

| Layer  | Role                                   | Where |
|--------|----------------------------------------|-------|
| Lina   | visible assistant / interface          | `site/lina/` |
| Chatty | conversational capability (not in this repo) | seam: `window.ZeroChatty.resolve(text, ctx)` |
| ZeroOS | orchestration                          | `site/js/config.js` → n8n (`zeroOrchSend`) |

## Files

```
index.html        shell markup (header · presence · words · contexts · surface · panel · input bar)
lina.css          tokens, states, panel, input bar, responsive, reduced-motion
js/state.js       LinaState store  idle | listening | thinking | acting | approval_required | error
js/data.js        real sources only: Supabase passports, local audit log, session overrides, node probes
js/presence.js    the @ mark (SVG) and its state variants
js/voice.js       SpeechRecognition + Web Audio level meter; honest fallback when unsupported
js/brain.js       local intent rules; delegates to Chatty when present
js/surfaces.js    NowSurface · WorkSurface · MemorySurface · ContextPanel · ApprovalCard
js/input.js       ＋  Lina’ya söyle...  🎙
js/shell.js       bootstrap and action loop
```

## What is real here

- **Work / Now**: `v_dpp_batch_passports` via the anon Supabase key already shipped in
  `assets/js/supabase.fabric.config.js` (same query as `dpp-batch-passports.js`).
- **Now**: active governance overrides from `sessionStorage` (`governance-engine.js` TTL).
- **Memory**: `ZeroAuditLog` (`site/js/audit-log.js`, localStorage) with source and date.
- **Modules**: the 14 routes from the `site/index.html` router map.
- **Voice**: browser SpeechRecognition (`tr-TR`) and a real mic level via AnalyserNode.
- **Approval**: one gated action that exists today, `ZeroAuditLog.clearLogs()`.

## What is honestly empty

Devices, Home, agents and industrial contexts have no data source in this repo. Lina says so
(“iMac durumu henüz bağlı değil.”, “Home henüz bağlı değil.”, “Aktif agent bilgisi mevcut değil.”).

To add a device, register a probe — nothing is shown without one:

```js
window.LinaConfig = { nodes: [{ id: 'imac', name: 'iMac', probe: async () => 'online' }] };
```

## Porting to the macOS app

The shell has no build step and no framework. State, brain, and surfaces are independent
modules on `window.Lina`; the native side can drive them by calling
`Lina.state.set('listening')`, `Lina.voice.onTranscript(fn)`, or by providing
`window.ZeroChatty.resolve`.
