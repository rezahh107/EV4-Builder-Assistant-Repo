# protocols/COGNITIVE_MODE_HINT

Version: 0.1.0
Status: active
Purpose: provide an advisory lightweight next-turn thinking-mode recommendation without changing Builder workflow state.

---

## Recommended Values

```yaml
instant: simple confirmation, mechanical execution, no analysis needed
medium: screenshot/evidence interpretation, correction, small repair
high: root-cause analysis, repo patch design, schema/protocol/validator work
```

---

## Allowed Contexts

A cognitive mode hint may appear only after non-active-build responses such as:

```text
repo_analysis
repair_planning
root_cause_analysis
status
review_only
paused_summary
non_build_planning
```

---

## Forbidden Contexts

Do not append this hint after active Builder batches that must end with an exact confirmation token or a targeted screenshot request.

Forbidden context:

```text
active_builder_batch
```

---

## Advisory Only

The hint must not:

```text
- change workflow_mode or runtime_state;
- satisfy evidence requirements;
- confirm Builder actions;
- bypass a Session Repair Packet;
- alter Builder batch formatting;
- appear after the required final confirmation token or screenshot request of an active batch.
```
