#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-unit-policy.mjs <file>');process.exit(2)}
const x=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message}); const key=`${x.control_family}.${x.control_name}`; const unit=x.unit??'unitless';
if(!x.unit_policy_id) fail('EV4-UPM-001','missing unit_policy_id.'); if(!x.responsive_scope) fail('EV4-UPM-002','missing responsive_scope.');
const blocked={ 'typography.font_size':['%','vw','vh'], 'typography.line_height':['%','vw','vh']}; if((blocked[key]||[]).includes(unit)) fail('EV4-UPM-003',`${key} blocks ${unit}.`);
if(key==='typography.font_size'&&unit==='px'&&!x.exception_reason) fail('EV4-UPM-004','px font-size requires exception_reason.');
if(key==='size.min_height'&&unit==='%'&&!x.parent_height_proven) fail('EV4-UPM-005','% min-height requires proven parent height.');
if(key.startsWith('position.')&&unit==='px'&&!x.exception_reason) fail('EV4-UPM-006','px absolute offset requires exception_reason.');
if(key==='style.z_index'&&unit!=='unitless') fail('EV4-UPM-007','z-index is unitless only.');
if(key==='style.opacity'&&!['unitless','%'].includes(unit)) fail('EV4-UPM-008','opacity only allows unitless or %.');
if(key==='size.width'&&x.context==='decorative_connector'&&unit==='px'&&!x.exception_reason) fail('EV4-UPM-009','decorative connector px width requires exception_reason.');
if(key==='asset.svg_sizing'&&x.unit==='fixed_width_height'&&!x.rationale) fail('EV4-UPM-010','fixed SVG width+height requires aspect-ratio rationale.');
if(['spacing.padding','spacing.gap','size.width'].includes(key)&&['px','%'].includes(unit)&&!x.rationale&&!x.exception_reason) fail('EV4-UPM-011',`${key} ${unit} requires rationale.`);
finish('Unit Policy Matrix', f, e);
