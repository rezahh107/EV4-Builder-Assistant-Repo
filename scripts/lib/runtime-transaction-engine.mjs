// Canonical Runtime Transaction Engine public API.
// Critical transition execution is composed exclusively from the internal runtime-engine modules below.
export { RuntimeTransactionError } from './runtime-engine/common.mjs';
export { verifyBuilderInput, createIntakeResult, verifyCapsuleAgainstInput } from './runtime-engine/input.mjs';
export { createGuardRegistry, loadTransitionAuthority, isAllowedCombination, evaluateTransition } from './runtime-engine/transitions.mjs';
export { validateActionLedger } from './runtime-engine/ledger.mjs';
export { loadCompletionScopes, validateCompletionScope, validateCompletionGateBinding } from './runtime-engine/completion-policy.mjs';
export { publishAtomicDirectory } from './runtime-engine/publication.mjs';
export { executeResumeTransaction } from './runtime-engine/resume.mjs';
export { executeCompletionTransaction } from './runtime-engine/completion.mjs';
export { blockedResult, atomicWriteJsonFile } from './runtime-engine/results.mjs';
