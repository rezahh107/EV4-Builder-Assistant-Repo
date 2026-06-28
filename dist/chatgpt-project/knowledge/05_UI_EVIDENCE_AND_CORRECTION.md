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

Architecture term vs UI label:
- Package term Container is internal architecture vocabulary.
- User-facing output should use confirmed UI labels such as Flexbox, Div block, Flex, Div, or Container.
- If the label is unknown, ask a short UI Vocabulary Sync question before relying on it.
- User screenshot evidence from 2026-06-28 showed Atomic Elements: Div block, Flexbox, Tabs, Heading, Image, Paragraph, SVG, Button, Divider.

known_control_map shape:
```yaml
known_control_map:
  - control_name:
    panel_name:
    element_generation:
    confirmed_by: user_statement | screenshot | documentation | installed_version
    evidence_ref:
    status: confirmed | missing | version_sensitive | insufficient_evidence
    session_confirmed_at:
```

ui_vocabulary_map shape:
```yaml
ui_vocabulary_map:
  - vocabulary_key: layout_parent
    architecture_term: Container
    user_ui_label:
    confirmed_by: user_statement | screenshot | documentation | installed_version
    confirmed_at_checkpoint:
    status: confirmed | unknown | changed | insufficient_evidence
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
