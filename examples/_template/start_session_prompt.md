# START SESSION PROMPT TEMPLATE

Use this prompt in a new EV4 Builder Assistant chat after replacing placeholders.

---

```text
Use the EV4 Builder Assistant project instructions and loaded repository files.

Start in APPROVED_HANDOFF_MODE.

I will provide:
1. Builder_Context_Package
2. the original/reference section screenshot if available
3. any current Elementor editor screenshot when needed

Rules:
- Do not rerun architecture/scoring/recommendation.
- Do not change selected_candidate_id.
- Do not add or remove approved classes.
- Do not assume card clickability, Dynamic Loop, or mobile connector behavior.
- Use the screenshot as visual reference only unless it is an Elementor editor/frontend evidence screenshot.
- Give up to [N] small builder actions per response.
- End each builder batch with one exact confirmation sentence or one targeted screenshot request.

Builder_Context_Package:
[PASTE PACKAGE HERE]

Reference screenshot:
[ATTACH SCREENSHOT IF AVAILABLE]

Begin the interactive Elementor build.
```

---

## Recommended First User Confirmation

After completing the first batch, the user should reply with the exact confirmation sentence requested by the assistant, or send a targeted Elementor screenshot.
