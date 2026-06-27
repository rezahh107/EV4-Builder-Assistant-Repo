# commands/SESSION_COMMANDS

Version: 0.1.0
Status: active_initial
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
```

These commands control the builder session. They are not EV4 Architect pipeline commands.

---

## Commands

### توقف

Set state to `PAUSED`.

```text
- Stop all new builder actions immediately.
- Preserve last verified checkpoint.
- Answer only the current question or investigate the reported issue.
- Do not resume until استارت or ادامه.
```

### استارت

Resume from last verified checkpoint.

```text
- Do not restart the project.
- Do not repeat confirmed actions unless correction requires it.
- Identify the resumed checkpoint.
- Continue only if no blocker remains.
```

### ادامه

Continue with the next uncompleted builder batch only when safe.

```text
- Does not automatically confirm the previous batch.
- If previous batch is unconfirmed, ask whether to confirm or proceed despite risk.
```

### تایید

Mark latest completed batch as user-confirmed.

```text
- Create a new verified checkpoint.
- Do not automatically provide next batch unless user also says ادامه or asks to proceed.
```

### اصلاح

Set state to `CORRECTION_MODE`.

```text
- Stop new implementation.
- Identify incorrect/unsupported instruction.
- State affected actions.
- Give smallest corrected path.
- Wait for confirmation.
```

### بررسی

Set state to `REVIEW_MODE`.

Inspect only provided evidence:

```text
Elementor screenshot
Structure Panel screenshot
Frontend screenshot
SVG
DOM diagnostic
Computed CSS
Export JSON
```

Return:

```text
confirmed
provisional
unknown
discrepancies
missing evidence
whether checkpoint can be confirmed
```

Do not continue automatically.

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

No new build actions unless user also says ادامه.

### عقب

Return to checkpoint before latest unconfirmed batch.

```text
- Identify discarded unconfirmed actions.
- State what should be reverted.
- Preserve earlier confirmed checkpoint.
```

Do not undo earlier confirmed checkpoints without explicit authorization.

### مستندات

Verify the requested behavior using official Elementor V4+ sources when web/source access is available.

Return:

```text
exact behavior being verified
applicable Elementor generation/version
source result
whether control is confirmed for this installation
difference between documentation and user's screenshot
safe implementation consequence
```

Do not continue automatically.

### ریست

Do not reset immediately.

Ask reset scope:

```text
latest unconfirmed batch
current section
all builder progress
project-specific handoff
entire session state
```

State exactly what would be lost.

### خلاصه

Return continuation-oriented summary:

```text
verified structure
verified classes
verified values
provisional values
unknowns
conflicts
corrected instructions
pending work
last checkpoint
next safe action
```

Do not continue automatically.

---

## Adjustable Action Count

The user may set maximum action count:

```text
یک پله
دو پله
سه پله
چهار پله
پنج پله
شش پله
تعداد پله: N
```

Where `N` is 1–6.

This changes only the maximum action count. It does not permit bundling unrelated tasks.
