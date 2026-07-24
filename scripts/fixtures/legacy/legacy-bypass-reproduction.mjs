const HISTORICAL_BYPASSES = Object.freeze([
  {
    test_id: 'B1',
    title: 'manual or synthetic Builder Input admission',
    authority_effect_reached: 'legacy intake accepted an internally consistent caller-controlled package without upstream provenance',
    post_repair_regression_test: 'explicit source mode and canonical Run Intake tests'
  },
  {
    test_id: 'B2',
    title: 'Checkpoint confirmation without Confirmation Receipt',
    authority_effect_reached: 'legacy Completion accepted confirmed_action_ids although no canonical Receipt transaction existed',
    post_repair_regression_test: 'WAITING-only canonical Confirmation generation tests'
  },
  {
    test_id: 'B3',
    title: 'nonexistent Evidence source',
    authority_effect_reached: 'legacy Completion accepted Evidence metadata without resolving source bytes',
    post_repair_regression_test: 'internal Evidence snapshot tests'
  },
  {
    test_id: 'B4',
    title: 'wrong Evidence content hash',
    authority_effect_reached: 'legacy Completion accepted a declared hash without recomputing source bytes',
    post_repair_regression_test: 'Evidence snapshot SHA and drift tests'
  },
  {
    test_id: 'B5',
    title: 'synthetic Evidence reaches legacy Completion authorization',
    authority_effect_reached: 'legacy Completion authorized synthetic transaction fixture content',
    post_repair_regression_test: 'real Run synthetic-content rejection tests'
  },
  {
    test_id: 'B6',
    title: 'caller-authored Completion Status booleans',
    authority_effect_reached: 'legacy Completion consumed caller-authored true values as terminal predicates',
    post_repair_regression_test: 'Runtime-derived Completion Status and Gate tests'
  },
  {
    test_id: 'B7',
    title: 'incompatible proof reuse',
    authority_effect_reached: 'legacy Completion accepted one Evidence ID for unrelated layout and export proofs',
    post_repair_regression_test: 'claim compatibility and internal Evidence validation tests'
  }
]);

export function reproduceHistoricalBypasses() {
  return HISTORICAL_BYPASSES.map((entry) => ({
    ...entry,
    input_mode: 'inert_historical_reproduction_fixture',
    validation_result: 'historically_reproduced',
    classification: 'HISTORICAL_AUTHORITY_BYPASS_REPRODUCTION',
    active_runtime_importable: false,
    real_run_authority: false,
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false
  }));
}

export const LEGACY_FIXTURE_AUTHORITY_SCOPE = 'historical_reproduction_only';
