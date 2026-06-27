# commands/SESSION_COMMANDS

Version: 0.2.3
Status: active
Purpose: Persian control commands for the builder session

---

## Recognition Rule

Treat these Persian words as explicit session commands when they appear alone or at the beginning of a message followed by a colon.

```text
توقف
استارت
ادامه
تایید
اصلاح
بررسی
وضعیت
عقب
مستندات
ریست
خلاصه
یک پله
دو پله
سه پله
چهار پله
پنج پله
تعداد پله: N
```

These commands control the builder session. They are not EV4 Architect pipeline commands.

---

## Commands

### توقف

Set state to `PAUSED` and stop all new builder actions. Preserve the last verified checkpoint. Do not resume until `استارت` or `ادامه`.

### استارت

Resume from the last verified checkpoint. Do not restart the project and do not repeat confirmed actions unless correction requires it.

### ادامه

Continue with the next uncompleted builder batch only when safe. This does not automatically confirm the previous batch.

### تایید

Mark the latest completed batch as user-confirmed and create a verified checkpoint. Do not automatically provide the next batch unless the user also asks to continue.

### اصلاح

Set state to `CORRECTION_MODE`. Stop new implementation, identify the incorrect or unsupported instruction, provide the smallest corrected path, and wait for confirmation.

### بررسی

Set state to `REVIEW_MODE`. Inspect only provided evidence and do not continue automatically.

Evidence may include:

```text
Elementor screenshot
Structure Panel screenshot
Frontend screenshot
SVG
DOM diagnostic
Computed CSS
Export JSON
```

### وضعیت

Return concise state report only:

```text
Current state
Last verified checkpoint
Completed structure
Applied classes
Active selected element
Current class
Next pending action
Unresolved evidence
Active warnings
Safe to continue
```

No new build actions unless user also says `ادامه`.

### عقب

Return to the checkpoint before the latest unconfirmed batch. Identify discarded unconfirmed actions and preserve earlier confirmed checkpoints.

### مستندات

Verify the requested behavior using official Elementor V4+/Atomic sources when source access is available. Report the safe implementation consequence and do not continue automatically.

### ریست

Do not reset immediately. Ask reset scope first and state exactly what would be lost.

Allowed reset scopes:

```text
full_session_reset
checkpoint_only_reset
class_map_reset
not_confirmed
```

Scope meanings:

```text
full_session_reset = clears the full Builder Assistant session state, but does not change the approved Builder_Context_Package.
checkpoint_only_reset = returns to the last verified checkpoint and discards only later unverified state.
class_map_reset = re-checks approved class application status without changing architecture or class names.
not_confirmed = no reset performed; user declined or scope is unclear.
```

If reset scope is unclear, ask the user to choose one of the allowed scopes. Do not reset automatically.

### خلاصه

Return continuation-oriented summary with verified structure, applied classes, unknowns, conflicts, pending work, last checkpoint, and next safe action. Do not continue automatically.

---

## Adjustable Action Count Commands

These commands set the maximum number of builder actions per future response:

```text
یک پله = 1
دو پله = 2
سه پله = 3
چهار پله = 4
پنج پله = 5
تعداد پله: N = any integer from 1 to 5
```

When an action-count command is received:

```text
1. Update max_actions_per_turn within 1..5.
2. Report the new maximum.
3. Preserve the current session state.
4. Do not emit a new builder batch unless the user also says ادامه.
```

Values above 5 are invalid. Ask the user to choose a value from 1 to 5.

This changes only the maximum action count. It does not permit bundling unrelated tasks.
