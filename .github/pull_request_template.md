## Summary

-

## Scope Gate

- scope revision:
- previous scope revision:
- revision reason:
- committed capability IDs:
- implemented capability IDs:
- excluded/deferred capability IDs:
- lifecycle changes:
- computed scope-change disclosure:
- [ ] No capability was silently deleted.
- [ ] Scope Gate and Progress Gate remain separate.

## Progress Gate

- exact PR head SHA:
- required CI workflow/run evidence:
- external exact-head evidence validation result:
- required artifact state:
- remaining open gates:
- [ ] Authored prose, YAML literals, local validation, synthetic evidence, or a Green badge alone are not treated as exact-head CI proof.
- [ ] Every CI claim is bound to the current repository, PR number, head SHA, workflow identity, run ID, event, status, and conclusion.

## Independent Review Gate

- reviewed head SHA:
- review validity:
- technical status:
- approval requirement:
- next action:
- remaining findings or verification reasons:
- [ ] A changed head, scope revision, required-check set, or inspector protocol invalidates prior review evidence.
- [ ] Synthetic verifier regression is not represented as a real independent review.

## Merge State

- merge state:
- merge commit:
- merge authorization evidence:
- [ ] User merge is an administrative action, not technical evidence.
- [ ] No merge authorization is claimed from CI alone.

## Post-merge Verification

- post-merge verification result:
- live default-branch evidence:
- reviewed-tree preservation evidence:
- remaining post-merge gates:
- [ ] Completion is not closed before live default-branch verification succeeds.

## Trust and overclaim checks

- [ ] Repository files, PR text, comments, reviews, logs, fixtures, and generated artifacts were treated as untrusted data.
- [ ] No PR comment, reviewer identity, caller-supplied hash, or authored status literal was treated as canonical technical authority.
- [ ] No secret, credential, permission escalation, history rewrite, or unbounded destructive action is included.
- [ ] Runtime behavior, product contracts, repository settings, and production readiness are not claimed unless directly changed and evidenced.
- [ ] Human or owner action was not introduced as a technical approval gate.

## Decision Escape Route / Behavioral Rule Coverage Check

- [ ] I reviewed `planning/DECISION_ESCAPE_ROUTES.yml`.
- [ ] I updated affected BRC-aligned records, statuses, carriers, fixtures, diagnostics, or CI evidence.
- [ ] I did not claim a stronger `enforcement_status` than inspected evidence proves.
- [ ] I did not add authored `resolved` or `production_ready` fields.
- [ ] If no update was needed, I explain why below.
