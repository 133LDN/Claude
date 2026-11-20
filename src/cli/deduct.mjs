#!/usr/bin/env node
// Add a sourced deduction the engine cannot detect (spelling, misused terms). Refuses anything CLAUDE.md forbids:
// the quote must be verbatim in the saved draft and the claim must be confirmed with a stored tier 1 source.
// Usage: node src/cli/deduct.mjs --review reviews/<id>.json --criterion <id> --severity minor|moderate|major
//          --claim C-0xx --quote "<verbatim text>" --reason "<why>" [--care "<how much a selector would care>"]
import fs from 'node:fs';
import path from 'node:path';
import { loadContext, ROOT } from '../engine/context.mjs';

const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const file = path.resolve(ROOT, get('review'));
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const ctx = loadContext();
const draft = fs.readFileSync(path.join(ROOT, r.draft_path), 'utf8');
const quote = get('quote'), claim = ctx.claims.get(get('claim')), crit = get('criterion');
const SEV = { minor: 1, moderate: 2, major: 3 };
const fail = (m) => { console.error('Refused: ' + m); process.exit(1); };
if (!quote || !draft.includes(quote)) fail('quote is not verbatim in the saved draft');
if (!claim || claim.label !== 'confirmed') fail(`claim ${get('claim')} is not confirmed`);
const tier1_ids = claim.tier1_ids.filter((id) => { const s = ctx.sources.get(id); return s && s.tier === 1 && s.status === 'stored'; });
if (!tier1_ids.length) fail('claim has no stored tier 1 source');
if (!r.scores[crit] && r.scores[crit] !== 0) fail('unknown criterion');
if (!SEV[get('severity')]) fail('severity must be minor|moderate|major');
const i = draft.indexOf(quote), b = draft.slice(0, i);
const d = { id: `D${r.deductions.length + 1}`, criterion: crit, severity: get('severity'), points: SEV[get('severity')], quote,
  anchor: { line: b.split('\n').length, col: i - b.lastIndexOf('\n') - 1, length: quote.length, offset: i }, extra_quotes: [],
  claim_id: claim.id, tier1_id: tier1_ids[0], tier1_ids, reason: get('reason'), selector_care: get('care') || '', source: 'reviewer' };
r.deductions.push(d);
const m = r.moderation.find((x) => x.criterion === crit);
m.adjustments.push({ action: 'add', deduction_id: d.id, points: -d.points, reason: d.reason });
m.too_high = { answer: 'yes', reasoning: `${m.too_high.reasoning} Reviewer added ${d.id}: ${d.reason}`.trim() };
m.after = Math.max(0, m.after - d.points);
r.scores[crit] = m.after;
r.average = Math.round((Object.values(r.scores).reduce((a, x) => a + x, 0) / Object.keys(r.scores).length) * 100) / 100;
r.issues.push({ id: `I-${d.id}`, importance: d.points >= 3 ? 'high' : d.points >= 2 ? 'medium' : 'low', kind: 'deduction', deduction_id: d.id, criterion: crit, title: d.reason, detail: d.selector_care, quote, anchor: d.anchor, claim_ids: [claim.id], tier1_ids, question: null, example: null });
fs.writeFileSync(file, JSON.stringify(r, null, 2));
console.log(`${d.id} added to ${crit}: -${d.points}. Score now ${m.after}; average ${r.average}.`);
