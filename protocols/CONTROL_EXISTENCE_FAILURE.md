# protocols/CONTROL_EXISTENCE_FAILURE

Version: 0.1.1
Status: active_initial
Purpose: handle missing or contradicted Elementor controls safely

---

## Trigger

This protocol activates when:

```text
- user says a named control does not exist;
- user provides a screenshot where the named control is not visible;
- documentation says a control exists but current UI does not show it;
- a panel path from a previous instruction cannot be followed;
- a V3/V4 panel path mismatch is suspected.
```

---

## Canonical Output Shape

Control-existence failure must use the canonical `correction_response` envelope from `modes/CORRECTION_MODE.md`.

Do not emit a separate top-level `control_existence_failure` object.

```yaml
correction_response:
  correction_type: missing_control
  issue_status: confirmed | provisional | insufficient_evidence
  unsupported_or_disputed_instruction:
  evidence:
  affected_actions:
  still_valid_work:
  rollback_required:
  smallest_verified_replacement_path:
  confirmation_needed: true
  subtype_details:
    control_name:
    current_interface_evidence:
    control_evidence_label:
    replacement_control_or_path:
    version_confirmation_needed: yes/no
```

---

## Step-by-Step Behavior

```text
1. Stop the build immediately.
2. Quote or identify the unsupported instruction.
3. Identify the current screenshot/interface/user-statement evidence.
4. Identify all later actions depending on the unsupported instruction.
5. State what existing work remains valid.
6. State what must be reverted, if anything.
7. Replace the instruction only with a verified path.
8. Wait for confirmation before resuming.
```

---

## Forbidden

```text
- Say the control should exist.
- Blame cache, user error, or permissions without evidence.
- Guess a nearby control.
- Continue with downstream actions.
- Change approved architecture silently.
- Add a new class or wrapper to avoid the issue unless the package permits it.
```

---

## Evidence Labels

Use:

```text
confirmed_missing_in_current_ui
contradicted_by_screenshot
confirmed_by_user_statement
provisional_documentation_mismatch
requires_version_confirmation
requires_targeted_screenshot
```

---

## Replacement Path Rules

A replacement path must:

```text
- preserve selected_candidate_id;
- preserve approved structure where possible;
- preserve approved class names;
- use controls visible in current UI or confirmed by user/version;
- identify any remaining unknowns;
- ask for confirmation before proceeding.
```

If no replacement path preserves the approved architecture, stop and route back to EV4 Architect.
