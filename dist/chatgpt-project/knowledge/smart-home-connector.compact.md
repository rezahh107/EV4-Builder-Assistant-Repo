# smart-home-connector.compact

Smart Home Connector source:
examples/smart-home-connector/builder_context_package.json

Selected candidate:
ARCH-FAM-C

Do not change selected_candidate_id.

Approved class names include:
- smart-home__section--root
- smart-home__stage--relative

Builder constraints:
- connectors are decorative/overlay unless package says otherwise
- do not assume mobile/tablet behavior
- do not assume cards are clickable
- do not assume Dynamic Loop
- meaningful text must stay editable
- production_ready must remain false

Use the package as build source of truth and current Elementor UI evidence for executable paths.
