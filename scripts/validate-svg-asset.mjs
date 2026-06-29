#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-svg-asset.mjs <file>');process.exit(2)}
const a=readJson(f), p=a.svg_profile||{}, e=[]; const fail=(id,message)=>e.push({id,message});
if(a.validation_result==='approved'&&a.compatibility_profile!=='elementor_safe_svg_simple') fail('EV4-ASSET-001','approved Elementor asset must use Elementor-safe compatibility profile.');
if(a.validation_result==='approved'&&a.browser_rendered&&!a.elementor_compatibility_evidence?.length) fail('EV4-ASSET-002','browser rendering alone is not Elementor compatibility evidence.');
if(a.asset_role==='decorative_connector'&&a.validation_result==='approved'&&(p.uses_filter||p.uses_gradient||p.uses_complex_defs_or_masks)&&!p.justification) fail('EV4-ASSET-003','connector SVG filters/gradients/complex defs require compatibility justification.');
if(a.asset_role==='decorative_connector'&&a.validation_result==='approved'&&(!p.uses_simple_primitives||!p.stroke_fill_elementor_safe)) fail('EV4-ASSET-004','decorative connector must prefer simple Elementor-safe primitives/stroke/fill.');
finish('Elementor Asset Generation Gate', f, e);
