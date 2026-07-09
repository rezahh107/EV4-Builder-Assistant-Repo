export const SUCCESS_RECEIPT_TEXT = '✅ این Builder action به decision card کرنل وصل است؛ Builder فقط تصمیم قفل‌شده را به گام اجرایی تبدیل کرده و lineage حفظ شده است.';
export const WARNING_RECEIPT_TEXT = '⚠️ این Builder action هنوز رسید معتبر کرنل ندارد؛ بدون machine-readable trace کامل نباید به‌عنوان تصمیم اجرایی معتبر عبور کند.';
export const FALLBACK_WARNING_RECEIPT_TEXT = '⚠️ fallback اجرا شد، اما تصمیم جدید محسوب نمی‌شود؛ برای انتخاب جایگزین، decision trace معتبر لازم است.';

export const REQUIRED_TRACE_FIELDS = [
  'decision_family',
  'decision_card_ref',
  'selected_option',
  'rejected_options',
  'evidence_refs',
  'evidence_state',
  'consumer_stage'
];

const EMPTY_NON_CLAIMS = Object.freeze({
  builder_design_authority_claimed: false,
  builder_execution_proof_claimed: false,
  downstream_enforcement_claimed: false,
  production_readiness_claimed: false,
  enforcement_status_upgrade_claimed: false
});

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(hasValue);
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

export function missingKernelTraceFields(trace) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) return [...REQUIRED_TRACE_FIELDS];
  const missing = REQUIRED_TRACE_FIELDS.filter((field) => !hasValue(trace[field]));
  if (trace.consumer_stage !== undefined && trace.consumer_stage !== 'builder') missing.push('consumer_stage:builder');
  if (trace.evidence_state !== undefined && trace.evidence_state !== 'validated') missing.push('evidence_state:validated');
  return [...new Set(missing)];
}

export function isCompleteBuilderKernelTrace(trace) {
  return missingKernelTraceFields(trace).length === 0 && trace.consumer_stage === 'builder' && trace.evidence_state === 'validated';
}

export function formatKernelDecisionReceipt({ surface = 'action_batch', decision_trace = null, fallback = false } = {}) {
  const missing = missingKernelTraceFields(decision_trace);
  const traceComplete = missing.length === 0;
  const source_trace_state = traceComplete ? 'complete' : (decision_trace && typeof decision_trace === 'object' ? 'incomplete' : 'missing');
  const receipt_status = traceComplete ? 'success' : (fallback ? 'fallback_warning' : 'warning');
  const receipt_text = traceComplete ? SUCCESS_RECEIPT_TEXT : (fallback ? FALLBACK_WARNING_RECEIPT_TEXT : WARNING_RECEIPT_TEXT);

  return {
    schema: 'ev4-builder-kernel-decision-receipt@0.1.0',
    wave: 5,
    surface: fallback ? 'fallback' : surface,
    receipt_status,
    source_of_truth: 'machine_readable_decision_trace',
    source_trace_state,
    decision_trace,
    missing_trace_fields: missing,
    receipt_text,
    wave_boundary: 'presentation_layer_only',
    non_claims: { ...EMPTY_NON_CLAIMS }
  };
}
