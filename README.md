# EV4 Builder Assistant Repo

Status: Builder runtime active. Project Gate integration is planned. The Project Gate program is not implemented.

## Role

Builder executes proven Elementor actions. Architect owns architecture. CE owns implementation-strategy proof. Responsive owns post-build responsive validation.

## Planned Project Gate Flow

```text
CE output → EV4 Project Gate → Builder input
Builder output and build evidence → EV4 Project Gate → Responsive input
```

The future user flow is one upload and one check. An accepted result supplies the next-stage package. A non-accepted result supplies a plain-language package describing what must be corrected before another check.

Builder receives only executable-ready input with a locked selected candidate, explicit implementation strategy, structured confirmation, a safe first batch, explicit class scope, and no blocking dependency.

Builder does not choose geometry, anchors, connector strategy, overlay policy, responsive strategy, interaction, Dynamic Loop, accessibility completion, or production readiness.

This repository remains authoritative for Builder schemas, validators, runtime protocols, fixtures, and execution behavior. EV4 Project Gate verifies the handoff and does not replace Builder contracts or invent build evidence.

```yaml
project_gate_handoff: documented
project_gate_runtime: not_implemented
production_ready: false
```

## Related Repositories

- `rezahh107/EV4-Project-Gate`
- `rezahh107/EV4-Architect-Repo`
- `rezahh107/EV4-Constructability-Engineer-Repo`
- `rezahh107/EV4-Responsive-Architect`
