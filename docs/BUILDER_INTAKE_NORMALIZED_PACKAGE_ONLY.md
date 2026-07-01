# Builder Intake: Normalized Package Only

Status: active  
Scope: Builder intake boundary for CE handoff data

---

## Rule

Builder intake must accept only a validated `Builder_Context_Package`.

A raw CE `builder_executable_package` must not enter `APPROVED_HANDOFF_MODE`, even when it is marked `executable_ready` by Constructability Engineer.

```text
Allowed:
CE builder_executable_package -> explicit adapter -> Builder_Context_Package -> Builder intake

Blocked:
CE builder_executable_package -> Builder intake
```

---

## Why

CE and Builder use different contracts:

```text
CE: proves executable implementation strategy
Builder: executes validated Builder_Context_Package batches
```

The CE package is not a runtime prompt and is not a drop-in Builder package. The adapter may normalize it, but runtime intake must not infer missing fields or convert CE shape during an interactive session.

---

## Regression

This boundary is covered by:

```text
tests/invalid-cross-field/raw_ce_builder_executable_package_rejected_by_intake.json
```

That fixture intentionally resembles an executable CE package. It must still fail Builder cross-field intake validation because it lacks the Builder package identity and normalized Builder carriers.

---

## Preserved Boundaries

```text
No architecture rerun.
No scoring rerun.
No selected_candidate_id mutation.
No approved class-name mutation.
No production-readiness claim.
No runtime raw-CE conversion path.
```
