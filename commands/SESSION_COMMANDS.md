# commands/SESSION_COMMANDS

Version: 0.3.6
Status: personal_inspector_bound_commands

Canonical startup authority: `manifests/builder-conversation-bootstrap.v1.json`.

Commands are recognized alone or at message start followed by `:`. Repository-maintenance requests remain maintenance mode.

## شروع

Fresh intake or state-preserving rerun. Inspect all current attachments before asking. Canonical personal input is `builder-input.json` from `EV4-Project-Gate / ce-to-builder`; Receipt is optional non-semantic evidence.

When input is present, normal execution additionally requires matching accepted `builder-intake-authorization.json` from:

```bash
node scripts/builder-inspector.mjs intake --input builder-input.json --output builder-intake-authorization.json
```

Missing/mismatched authorization means `START_INTAKE_MODE / EVIDENCE_REQUIRED`, no batch. Repeated `شروع` preserves state and blockers.

## استارت

Resume only with exact matching input, accepted intake capsule, Session State, Checkpoint, personal state capsule, and accepted `builder-resume-authorization.json`. It never initializes a session and never fabricates continuation evidence.

## توقف / ادامه / تایید

`توقف` pauses and preserves state. `ادامه` continues only when safe and never confirms. `تایید` accepts only the active structured token/evidence.

## اصلاح / بررسی / وضعیت

`اصلاح` enters CORRECTION with Repair Packet. `بررسی` is evidence review only. `وضعیت` reports state/evidence only and emits no new action.

## پیش‌نمایش / خلاصه

`پیش‌نمایش` does not execute or mutate state. `خلاصه` returns copy-pasteable exact carrier names and keeps `production_ready: false`.

## Completion

Builder completion requires matching accepted `builder-completion-authorization.json`. It is `builder_completion_only`; Responsive and production remain false.


Canonical semantic schema: `ev4-builder-context-package@1.0.0`.

Receipt filename hint: `project-gate-c2b-receipt.json`; audit evidence only.
