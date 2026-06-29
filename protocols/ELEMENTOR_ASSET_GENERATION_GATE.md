# protocols/ELEMENTOR_ASSET_GENERATION_GATE

Version: 0.1.0
Status: active
Purpose: require a compatibility check before Builder emits Elementor-bound assets.

## Trigger

Run before Builder emits a file intended for Elementor upload or Elementor widget use. MVP enforcement is SVG.

## Contract

```yaml
elementor_asset_generation_check:
  asset_type: svg
  target_use: Elementor SVG widget
  generated_by_builder: true
  knowledge_lookup_performed: true
  local_kb_checked: true
  official_docs_checked: true
  compatibility_profile: elementor_safe_svg
  contains_forbidden_features: false
  required_features_present: true
  safe_to_generate: true
  required_next_action: generate_asset
```

## Rules

- Check local EV4 knowledge first.
- Official Elementor docs remain authoritative for Elementor capability and asset compatibility.
- If source status is unknown, do not generate the asset.
- Browser-valid SVG is not automatically Elementor-safe.
- Unsafe generated assets require a Session Repair Packet.
