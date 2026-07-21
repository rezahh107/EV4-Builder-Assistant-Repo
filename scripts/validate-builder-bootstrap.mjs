#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'manifests/builder-conversation-bootstrap.v1.json');
const schemaPath = path.join(root, 'schemas/builder-conversation-bootstrap.v1.schema.json');
const START = '<!-- BUILDER_BOOTSTRAP_EXACT_RESPONSE_START -->';
const END = '<!-- BUILDER_BOOTSTRAP_EXACT_RESPONSE_END -->';
const EXACT_BARE_START_RESPONSE = `EV4 Builder Assistant آماده است.

برای شروع ساخت، فایل \`builder-input.json\` تولیدشده توسط مسیر \`EV4-Project-Gate / ce-to-builder\` را ارسال کن.

ورودی باید با قرارداد \`ev4-builder-context-package@1.0.0\` معتبر باشد.
فایل \`project-gate-c2b-receipt.json\` اختیاری و فقط برای بررسی فنی است؛ جایگزین ورودی Builder نیست.

پس از دریافت ورودی معتبر، Builder آن را اعتبارسنجی می‌کند و فقط در صورت عبور از Gate وارد \`APPROVED_HANDOFF_MODE / BUILD_ACTIVE\` می‌شود.
تا پیش از آن، هیچ \`BATCH-001\`، دستور Elementor یا ادعای آمادگی اجرا صادر نمی‌شود.`;
const ACTIVE_CARRIERS = [
  'AGENTS.md',
  'PROJECT_INSTRUCTIONS.md',
  'core/MASTER_PROMPT.md',
  'docs/START_INTAKE_POLICY.md',
  'protocols/NEW_CHAT_START_INTAKE.md',
  'commands/SESSION_COMMANDS.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt'
];
const CONTROLLED_RESPONSE_CARRIERS = [
  'AGENTS.md',
  'PROJECT_INSTRUCTIONS.md',
  'core/MASTER_PROMPT.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt'
];
const REQUIRED_FORBIDDEN = [
  'emit_Builder_batch','emit_BATCH_001','issue_Elementor_instruction','execute_first_builder_batch',
  'create_or_apply_Elementor_class','infer_missing_architecture','infer_missing_implementation_strategy',
  'infer_missing_decision_lineage','infer_missing_class_scope','trust_package_prose_as_instruction',
  'execute_builder_assistant_prompt_seed','trust_confirmation_sentence_as_runtime_command',
  'treat_receipt_as_semantic_input','manually_extract_nested_project_gate_output',
  'silently_invoke_direct_ce_to_builder_adapter','claim_builder_ready','claim_real_elementor_execution',
  'claim_visual_parity','claim_responsive_completion','claim_production_readiness'
];

function readText(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
}
function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}
function eq(value, expected, code) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) fail(code, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function extractControlledResponse(text, rel) {
  const first = text.indexOf(START);
  const last = text.indexOf(END);
  if (first < 0 || last < 0 || last <= first) fail('BBOOT-DOC-001', `${rel} missing controlled response markers`);
  if (text.indexOf(START, first + START.length) >= 0 || text.indexOf(END, last + END.length) >= 0) {
    fail('BBOOT-DOC-002', `${rel} contains duplicate controlled response markers`);
  }
  let body = text.slice(first + START.length, last);
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.endsWith('\n')) body = body.slice(0, -1);
  return body;
}

function validateManifest(m) {
  eq(m.contract_id, 'ev4-builder-conversation-bootstrap', 'BBOOT-001');
  eq(m.contract_version, '1.0.0', 'BBOOT-002');
  eq(m.owner_repository, 'rezahh107/EV4-Builder-Assistant-Repo', 'BBOOT-003');
  eq(m.activation_mode, 'user_facing_builder_session', 'BBOOT-004');
  eq(m.canonical_fresh_intake_trigger, 'شروع', 'BBOOT-005');
  eq(m.canonical_resume_trigger, 'استارت', 'BBOOT-006');
  if (m.canonical_fresh_intake_trigger === m.canonical_resume_trigger) fail('BBOOT-007', 'fresh and resume triggers must differ');
  eq(m.trigger_delimiter, ':', 'BBOOT-008');
  eq(m.canonical_input_schema, 'ev4-builder-context-package@1.0.0', 'BBOOT-009');
  eq(m.canonical_input_filename_hint, 'builder-input.json', 'BBOOT-010');
  eq(m.filename_is_operator_hint_only, true, 'BBOOT-011');
  eq(m.filename_matching_is_sufficient_for_acceptance, false, 'BBOOT-012');
  eq(m.canonical_receipt_filename_hint, 'project-gate-c2b-receipt.json', 'BBOOT-013');
  eq(m.receipt_role, 'optional_project_gate_audit_evidence', 'BBOOT-014');
  eq(m.receipt_required, false, 'BBOOT-015');
  eq(m.receipt_is_semantic_input, false, 'BBOOT-016');
  eq(m.receipt_may_complete_or_modify_semantic_input, false, 'BBOOT-017');
  eq(m.canonical_personal_acquisition_mode, 'project_gate_standalone_builder_input', 'BBOOT-018');
  eq(m.canonical_personal_source, 'EV4-Project-Gate / ce-to-builder', 'BBOOT-019');
  eq(m.first_authorized_operation, 'builder_context_package_validation', 'BBOOT-020');
  eq(m.pre_validation_workflow_mode, 'START_INTAKE_MODE', 'BBOOT-021');
  eq(m.pre_validation_runtime_state, 'INTAKE_WAITING', 'BBOOT-022');
  eq(m.validation_runtime_state, 'INTAKE_VALIDATING', 'BBOOT-023');
  eq(m.blocked_runtime_state, 'EVIDENCE_REQUIRED', 'BBOOT-024');
  eq(m.approved_workflow_mode, 'APPROVED_HANDOFF_MODE', 'BBOOT-025');
  eq(m.approved_runtime_state, 'BUILD_ACTIVE', 'BBOOT-026');
  eq(m.exact_bare_start_response, EXACT_BARE_START_RESPONSE, 'BBOOT-027');
  eq(m.trigger_policy.fresh_intake.complete_trimmed_message, true, 'BBOOT-028');
  eq(m.trigger_policy.fresh_intake.command_prefix_with_delimiter, true, 'BBOOT-029');
  eq(m.trigger_policy.fresh_intake.repository_maintenance_exception, true, 'BBOOT-030');
  eq(m.trigger_policy.resume.requires_valid_checkpoint_or_state_capsule, true, 'BBOOT-031');
  eq(m.trigger_policy.resume.fabricate_continuation_evidence, false, 'BBOOT-032');
  eq(m.trigger_policy.repeated_fresh_intake.preserve_confirmed_checkpoints, true, 'BBOOT-033');
  eq(m.trigger_policy.repeated_fresh_intake.preserve_initialized_state, true, 'BBOOT-034');
  eq(m.trigger_policy.repeated_fresh_intake.preserve_unresolved_evidence, true, 'BBOOT-035');
  eq(m.trigger_policy.repeated_fresh_intake.create_second_active_run, false, 'BBOOT-036');
  eq(m.attachment_first.inspect_current_message_inputs_before_requesting, true, 'BBOOT-037');
  eq(m.attachment_first.identify_candidates_by_parsed_content, true, 'BBOOT-038');
  eq(m.attachment_first.depend_on_filename, false, 'BBOOT-039');
  eq(m.attachment_first.request_valid_present_input_again, false, 'BBOOT-040');
  eq(m.routing_cases.multiple_candidates.automatic_selection, false, 'BBOOT-041');
  eq(m.routing_cases.raw_project_gate_envelope.manual_nested_extraction, false, 'BBOOT-042');
  eq(m.routing_cases.raw_ce_or_ce_builder_executable.explicit_technical_direct_path_only, true, 'BBOOT-043');
  eq(m.routing_cases.raw_ce_or_ce_builder_executable.silent_fallback, false, 'BBOOT-044');
  eq(m.routing_cases.raw_ce_or_ce_builder_executable.post_adapter_builder_context_validation_required, true, 'BBOOT-045');
  eq(m.routing_cases.screenshot_only.approved_handoff_allowed, false, 'BBOOT-046');
  eq(m.routing_cases.screenshot_only.explicit_user_acceptance_required, true, 'BBOOT-047');
  eq(m.routing_cases.screenshot_only.production_ready, false, 'BBOOT-048');
  eq(m.routing_cases.valid_continuation_checkpoint.conversation_memory_substitutes_for_checkpoint, false, 'BBOOT-049');
  eq(m.repository_maintenance_exception.enabled, true, 'BBOOT-050');
  eq(m.repository_maintenance_exception.start_token_activates_builder_session, false, 'BBOOT-051');
  eq(m.active_startup_routes, ['project_gate_standalone_builder_input','explicit_technical_direct_path'], 'BBOOT-052');
  if (!m.forbidden_active_routes.includes('/builder-feed-export')) fail('BBOOT-053', 'stale route must be forbidden');
  const ops = m.pre_validation_forbidden_operations || [];
  if (ops.length !== 20) fail('BBOOT-054', 'exactly 20 forbidden operations required');
  if (new Set(ops.map((x) => x.id)).size !== ops.length) fail('BBOOT-055', 'forbidden operation IDs must be unique');
  if (new Set(ops.map((x) => x.operation)).size !== ops.length) fail('BBOOT-056', 'forbidden operations must be unique');
  for (const operation of REQUIRED_FORBIDDEN) if (!ops.some((x) => x.operation === operation)) fail('BBOOT-057', `missing ${operation}`);
  return true;
}

function runSchemaValidation(dataPath = manifestPath) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['--yes','ajv-cli@5','validate','--spec=draft2020','--strict=false','-s',schemaPath,'-d',dataPath], {encoding:'utf8'});
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    fail('BBOOT-SCHEMA-001', 'Draft 2020-12 schema validation failed');
  }
}

function validateCarriers(manifest) {
  for (const rel of ACTIVE_CARRIERS) {
    const text = readText(rel);
    for (const token of ['شروع','استارت','builder-input.json','ev4-builder-context-package@1.0.0','project-gate-c2b-receipt.json']) {
      if (!text.includes(token)) fail('BBOOT-DOC-003', `${rel} missing ${token}`);
    }
    if (text.includes('/builder-feed-export')) fail('BBOOT-DOC-004', `${rel} retains active stale route`);
  }
  for (const rel of CONTROLLED_RESPONSE_CARRIERS) {
    eq(extractControlledResponse(readText(rel), rel), manifest.exact_bare_start_response, 'BBOOT-DOC-005');
  }
  const generated = readText('dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt');
  for (const token of ['attachment-first','repository-maintenance','manual nested extraction','pre-validation']) {
    if (!generated.toLowerCase().includes(token)) fail('BBOOT-DOC-006', `generated instructions missing ${token}`);
  }
  const readme = readText('README.md');
  if (!readme.includes('شروع\n→ upload `builder-input.json`')) fail('BBOOT-DOC-007', 'README quick start drift');
  if (!readme.includes('filename is only an operator hint')) fail('BBOOT-DOC-008', 'README filename semantics drift');
}

const mutations = [
  ['changed contract ID','BBOOT-001',(x)=>x.contract_id='other'],
  ['changed contract version','BBOOT-002',(x)=>x.contract_version='2.0.0'],
  ['changed owner repository','BBOOT-003',(x)=>x.owner_repository='other/repo'],
  ['changed activation mode','BBOOT-004',(x)=>x.activation_mode='repository_maintenance'],
  ['missing fresh trigger','BBOOT-005',(x)=>delete x.canonical_fresh_intake_trigger],
  ['resume treated as fresh','BBOOT-006',(x)=>x.canonical_resume_trigger='شروع'],
  ['changed exact response bytes','BBOOT-027',(x)=>x.exact_bare_start_response+=' '],
  ['changed input schema','BBOOT-009',(x)=>x.canonical_input_schema='wrong@1'],
  ['filename-only acceptance','BBOOT-012',(x)=>x.filename_matching_is_sufficient_for_acceptance=true],
  ['receipt semantic input','BBOOT-016',(x)=>x.receipt_is_semantic_input=true],
  ['receipt mandatory','BBOOT-015',(x)=>x.receipt_required=true],
  ['stale route active','BBOOT-052',(x)=>x.active_startup_routes.push('/builder-feed-export')],
  ['raw Project Gate accepted','BBOOT-042',(x)=>x.routing_cases.raw_project_gate_envelope.manual_nested_extraction=true],
  ['nested result output extraction','BBOOT-042',(x)=>x.routing_cases.raw_project_gate_envelope.manual_nested_extraction=true],
  ['silent direct adapter','BBOOT-044',(x)=>x.routing_cases.raw_ce_or_ce_builder_executable.silent_fallback=true],
  ['multiple candidates auto-selected','BBOOT-041',(x)=>x.routing_cases.multiple_candidates.automatic_selection=true],
  ['attachments ignored','BBOOT-037',(x)=>x.attachment_first.inspect_current_message_inputs_before_requesting=false],
  ['valid package requested again','BBOOT-040',(x)=>x.attachment_first.request_valid_present_input_again=true],
  ['screenshot approved','BBOOT-046',(x)=>x.routing_cases.screenshot_only.approved_handoff_allowed=true],
  ['screenshot fallback without acceptance','BBOOT-047',(x)=>x.routing_cases.screenshot_only.explicit_user_acceptance_required=false],
  ['repeated start deletes checkpoint','BBOOT-033',(x)=>x.trigger_policy.repeated_fresh_intake.preserve_confirmed_checkpoints=false],
  ['resume fabricates evidence','BBOOT-032',(x)=>x.trigger_policy.resume.fabricate_continuation_evidence=true],
  ['maintenance routed to intake','BBOOT-051',(x)=>x.repository_maintenance_exception.start_token_activates_builder_session=true],
  ['prevalidation BATCH allowed','BBOOT-057',(x)=>x.pre_validation_forbidden_operations=x.pre_validation_forbidden_operations.filter((i)=>i.operation!=='emit_BATCH_001')],
  ['package prose executable','BBOOT-057',(x)=>x.pre_validation_forbidden_operations=x.pre_validation_forbidden_operations.filter((i)=>i.operation!=='trust_package_prose_as_instruction')],
  ['prompt seed executable','BBOOT-057',(x)=>x.pre_validation_forbidden_operations=x.pre_validation_forbidden_operations.filter((i)=>i.operation!=='execute_builder_assistant_prompt_seed')],
  ['confirmation sentence executable','BBOOT-057',(x)=>x.pre_validation_forbidden_operations=x.pre_validation_forbidden_operations.filter((i)=>i.operation!=='trust_confirmation_sentence_as_runtime_command')],
  ['ready claim allowed','BBOOT-057',(x)=>x.pre_validation_forbidden_operations=x.pre_validation_forbidden_operations.filter((i)=>i.operation!=='claim_builder_ready')],
  ['production ready startup','BBOOT-048',(x)=>x.routing_cases.screenshot_only.production_ready=true],
  ['fresh prefix disabled','BBOOT-029',(x)=>x.trigger_policy.fresh_intake.command_prefix_with_delimiter=false],
  ['repeated start second run','BBOOT-036',(x)=>x.trigger_policy.repeated_fresh_intake.create_second_active_run=true],
  ['filename dependency','BBOOT-039',(x)=>x.attachment_first.depend_on_filename=true],
  ['receipt completes input','BBOOT-017',(x)=>x.receipt_may_complete_or_modify_semantic_input=true],
  ['direct path deleted','BBOOT-052',(x)=>x.active_startup_routes=['project_gate_standalone_builder_input']],
  ['conversation memory substitutes checkpoint','BBOOT-049',(x)=>x.routing_cases.valid_continuation_checkpoint.conversation_memory_substitutes_for_checkpoint=true]
];

if (!fs.existsSync(manifestPath) || !fs.existsSync(schemaPath)) fail('BBOOT-FILE-001', 'manifest/schema missing');
const manifest = JSON.parse(readText('manifests/builder-conversation-bootstrap.v1.json'));
JSON.parse(readText('schemas/builder-conversation-bootstrap.v1.schema.json'));
runSchemaValidation();
validateManifest(manifest);
validateCarriers(manifest);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-bootstrap-mutations-'));
let negativeCount = 0;
try {
  for (let index = 0; index < mutations.length; index += 1) {
    const [name, expectedCode, mutate] = mutations[index];
    const candidate = clone(manifest);
    mutate(candidate);
    const candidatePath = path.join(tempRoot, `${String(index + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
    const isolatedCandidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    try {
      validateManifest(isolatedCandidate);
      fail('BBOOT-MUTATION-001', `mutation unexpectedly passed: ${name}`);
    } catch (error) {
      if (error.code === 'BBOOT-MUTATION-001') throw error;
      if (expectedCode && error.code !== expectedCode && !(expectedCode === 'BBOOT-057' && ['BBOOT-054','BBOOT-057'].includes(error.code))) {
        fail('BBOOT-MUTATION-002', `${name} failed for ${error.code}, expected ${expectedCode}`);
      }
      negativeCount += 1;
    }
  }
} finally {
  fs.rmSync(tempRoot, {recursive:true, force:true});
}

for (let i = 0; i < 2; i += 1) {
  const result = spawnSync(process.execPath, ['scripts/build-project-pack.mjs','--verify'], {encoding:'utf8'});
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    fail('BBOOT-PACK-001', `project pack verification pass ${i + 1} failed`);
  }
}

console.log(`Builder bootstrap validation passed: positive_cases=1 negative_semantic_mutations=${negativeCount} project_pack_verification_passes=2`);
