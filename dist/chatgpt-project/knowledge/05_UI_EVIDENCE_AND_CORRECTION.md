# 05_UI_EVIDENCE_AND_CORRECTION

Executable UI instructions must prioritize current evidence:
1. latest current Elementor editor screenshot
2. user statement about installed UI
3. installed Elementor version evidence
4. official Elementor docs for the context
5. diagnostics/frontend/export evidence
6. Builder_Context_Package
7. workbook/reference layer
8. case memory
9. inference

UI confidence gate:
- Official Elementor docs are primary for capability and terminology.
- Current Elementor UI screenshot or direct user statement is primary for executable controls.
- Do not name exact UI paths unless visible, user-confirmed, version-confirmed, or applicable official docs confirm them.
- If evidence is insufficient, use insufficient_evidence or enter CORRECTION instead of guessing.

Risk-based execution:
- Low-risk structure actions such as creating a Container, basic widgets, renaming a Structure Panel item, or applying an approved class may proceed from an approved package when normal Elementor UI is available.
- Exact control paths, responsive controls, SVG, overlay, z-index, overflow, grid, Variables, Components, interaction/state controls, and class-management UI behavior require current UI/user/version/docs evidence.
- If a control is missing, stop and enter CORRECTION.

known_control_map shape:
```yaml
known_control_map:
  - control_name:
    panel_name:
    element_generation:
    confirmed_by: user_statement | screenshot | documentation | installed_version
    evidence_ref:
    status: confirmed | missing | version_sensitive | insufficient_evidence
```

Screenshot recipe:
```text
Screenshot target:
- selected element:
- show:
- active class:
- panel/tab:
- crop:
```

CORRECTION rules:
- Stop downstream actions.
- Identify the disputed instruction and evidence.
- Preserve approved architecture and classes.
- Provide the smallest verified replacement path.
- Resume from the last valid checkpoint, not memory.
