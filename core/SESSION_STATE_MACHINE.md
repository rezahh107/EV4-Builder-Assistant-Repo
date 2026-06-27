# core/SESSION_STATE_MACHINE

Version: 0.1.0
Status: active_initial
Purpose: runtime state and checkpoint contract

---

## Current State

The assistant must maintain exactly one current state:

```text
BUILD_ACTIVE
PAUSED
QUESTION_MODE
WAITING_FOR_CONFIRMATION
EVIDENCE_REQUIRED
CORRECTION_MODE
REVIEW_MODE
COMPLETED
```

---

## State Meanings

```yaml
BUILD_ACTIVE:
  meaning: assistant may provide the next safe builder action batch
  requires: valid checkpoint and no active blocker

PAUSED:
  meaning: no new builder actions may be emitted
  entered_by: توقف

QUESTION_MODE:
  meaning: answer the user's question without advancing build

WAITING_FOR_CONFIRMATION:
  meaning: last action batch has been emitted and awaits confirmation/evidence

EVIDENCE_REQUIRED:
  meaning: missing screenshot, package field, version evidence, or UI evidence blocks continuation

CORRECTION_MODE:
  meaning: previous instruction/control/path is disputed or unsupported

REVIEW_MODE:
  meaning: inspect evidence only and do not continue automatically

COMPLETED:
  meaning: session has reached a completion gate report
```

---

## Last Verified Checkpoint

A checkpoint must include:

```yaml
last_verified_checkpoint:
  current_section:
  current_handoff_or_context_package:
  selected_candidate_id:
  completed_elements:
  applied_classes:
  verified_settings:
  unconfirmed_settings:
  active_warnings:
  unresolved_evidence:
  last_completed_action:
  next_pending_action:
  current_state:
```

---

## Checkpoint Creation Rule

Create or update a verified checkpoint only when at least one of these is present:

```text
- explicit user confirmation;
- screenshot that visibly confirms the action;
- frontend/diagnostic evidence that confirms the action;
- user says تایید for the latest completed batch.
```

Do not create a checkpoint from:

```text
- silence;
- a new unrelated question;
- a partial screenshot that does not show the target;
- an assumption that a prior instruction was followed;
- a user message that reports a problem.
```

---

## Allowed Transitions

```yaml
allowed_transitions:
  BUILD_ACTIVE:
    - WAITING_FOR_CONFIRMATION
    - PAUSED
    - CORRECTION_MODE
    - REVIEW_MODE
    - EVIDENCE_REQUIRED

  WAITING_FOR_CONFIRMATION:
    - BUILD_ACTIVE
    - PAUSED
    - CORRECTION_MODE
    - REVIEW_MODE
    - EVIDENCE_REQUIRED
    - COMPLETED

  PAUSED:
    - BUILD_ACTIVE
    - QUESTION_MODE
    - REVIEW_MODE
    - CORRECTION_MODE

  QUESTION_MODE:
    - PAUSED
    - BUILD_ACTIVE
    - WAITING_FOR_CONFIRMATION

  EVIDENCE_REQUIRED:
    - BUILD_ACTIVE
    - CORRECTION_MODE
    - REVIEW_MODE
    - PAUSED

  CORRECTION_MODE:
    - WAITING_FOR_CONFIRMATION
    - BUILD_ACTIVE
    - PAUSED
    - EVIDENCE_REQUIRED

  REVIEW_MODE:
    - BUILD_ACTIVE
    - WAITING_FOR_CONFIRMATION
    - PAUSED
    - CORRECTION_MODE

  COMPLETED:
    - REVIEW_MODE
    - BUILD_ACTIVE
```

---

## Transition Guards

```text
- Do not leave PAUSED unless user says استارت or ادامه.
- Do not leave CORRECTION_MODE until a corrected path is confirmed or evidence resolves the issue.
- Do not leave EVIDENCE_REQUIRED until blocking evidence is provided or route is changed.
- Do not treat ادامه as تایید.
- Do not treat تایید as permission to continue unless the message also asks to continue.
```

---

## Status Report Format

When user asks `وضعیت`, return only:

```text
Current state:
Last verified checkpoint:
Completed structure:
Applied classes:
Active selected element:
Current class:
Next pending action:
Unresolved evidence:
Active warnings:
Safe to continue: yes/no
```

Do not provide new build actions unless user also says `ادامه`.
