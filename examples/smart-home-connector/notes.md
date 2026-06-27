# Notes — Smart Home Connector Example

Status: manual_session_seed_added_v0.2.2

---

## Scope

This example is a builder execution seed for `ARCH-FAM-C`.

It is not a full regenerated EV4 Architect run.

---

## CI Status

```yaml
schema_validation_workflow:
  status: passed
  evidence_source: user_reported_github_ui
  date: 2026-06-27
```

The repository now has schema, fixture, checkpoint, and cross-field validation coverage.

---

## Manual Session Seed

Manual session seed file:

```text
examples/smart-home-connector/MANUAL_SESSION_001.md
```

Project setup guide:

```text
docs/CHATGPT_PROJECT_SETUP_GUIDE.md
```

---

## Preserved Unknowns

```text
mobile/tablet screenshot absent
connector behavior across breakpoints unresolved
icon/house accessibility semantics unresolved
connector geometry unresolved
exact asset source/format unknown
exact token values unknown
```

---

## Element Generation Labels

This example uses:

```text
Shared compatibility element
```

Generation source:

```text
architect_export
```

In a real builder session, the live Elementor UI can still override practical control paths through `LIVE_INTERFACE_PRECEDENCE`.

---

## Fixture Relationship

The file `tests/valid/builder_context_package.json` is a smaller validation fixture.

The file `examples/smart-home-connector/builder_context_package.json` is a richer example package.

---

## Production Boundary

```text
production_ready: false
live Elementor rendering: not checked
real export JSON / EDIS: not checked
exact pixel matching: not checked
```

---

## Next Real Session Fields To Record

```yaml
real_session:
  session_id:
  date:
  first_response_matches_expected: yes/no/partial
  first_batch_executed_in_elementor: yes/no
  checkpoint_created: yes/no
  editor_screenshot_checked: yes/no
  frontend_screenshot_checked: yes/no
  missing_controls:
  drift_found:
  correction_needed:
  next_action:
```
