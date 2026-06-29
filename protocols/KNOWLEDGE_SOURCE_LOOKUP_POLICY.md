# protocols/KNOWLEDGE_SOURCE_LOOKUP_POLICY

Version: 0.1.0
Status: active
Purpose: define lookup order for EV4 and Elementor implementation questions.

## Lookup Order

For EV4 and Elementor implementation questions, check sources in this order:

```text
1. Local project KB repos:
   - rezahh107/EV4-Workbook-Jinja
   - rezahh107/elementor-v4-knowledge-base
2. Current Builder repo protocols, schemas, examples, cases
3. Official Elementor help, developer docs, changelog, and release docs
4. Current UI screenshot or direct user statement for executable controls
5. Installed version evidence when available
6. Diagnostics or frontend evidence
7. Model inference as last resort
```

## Authority Rule

Local KB repos accelerate lookup and provide project-specific patterns. They are reference material, not runtime prompts.

Official Elementor docs are authoritative for Elementor capability, upload behavior, SVG safety, asset compatibility, sanitization behavior, and widget support.

If local KB and official Elementor docs conflict, official Elementor docs win.

## Repo-Wide Search Requirement

Before adding a protocol or rule related to Elementor capability, asset generation, UI behavior, SVG, responsive behavior, variables, classes, components, or widget behavior, search:

```text
current Builder repo
rezahh107/EV4-Workbook-Jinja
rezahh107/elementor-v4-knowledge-base
```

Update or reference existing protocols rather than duplicating conflicting rules.
