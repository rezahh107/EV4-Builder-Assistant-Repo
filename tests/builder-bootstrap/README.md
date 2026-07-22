# Builder Conversation Bootstrap Tests

The executable suite is `scripts/validate-builder-bootstrap.mjs`.

It validates one canonical positive manifest and 35 fail-closed semantic mutations. Each mutation is written to an isolated temporary copy, parsed again, and required to fail for its intended diagnostic class. The suite never modifies authority files in the working tree.

Covered mutation classes include contract identity, trigger differentiation, exact response bytes, input schema, filename-only acceptance, Receipt separation, stale startup routes, Project Gate envelope extraction, explicit direct-path preservation, attachment-first routing, ambiguity blocking, screenshot fallback, checkpoint preservation, repository-maintenance routing, pre-validation prohibitions, untrusted prose/prompt/confirmation handling, readiness claims, and continuation evidence.
