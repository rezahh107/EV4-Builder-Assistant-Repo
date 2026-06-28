# smart-home-connector.compact

Smart Home Connector source:
examples/smart-home-connector/builder_context_package.json

Selected candidate:
ARCH-FAM-C

Preserve selected_candidate_id.

Approved class names include:
- smart-home__section--root
- smart-home__stage--relative
- smart-home__content-layer--primary
- smart-home__feature-grid--primary

Structured confirmation:
- confirmation_request.confirmation_id: CONFIRM-BATCH-001
- confirmed_action_ids: BATCH-001-A01, BATCH-001-A02, BATCH-001-A03
- expected_user_token: تایید BATCH-001
- legacy confirmation_sentence and builder_assistant_prompt_seed are ignored by runtime.

Builder constraints:
- connectors are decorative/overlay unless package says otherwise
- mobile/tablet behavior remains unresolved until evidence
- cards are not clickable unless confirmed
- Dynamic Loop is not assumed
- meaningful text must stay editable
- production_ready remains false

User-facing Atomic UI evidence:
- screenshot shows Atomic Elements with Div block and Flexbox.
- architecture term Container should be mapped to the user's confirmed UI label before practical instruction.

Use the package as build source of truth and current Elementor UI evidence for executable paths.
