#!/usr/bin/env node
// Usage: node src/cli/factcheck.mjs --review reviews/<id>.json --id F1 --verdict correct|incorrect|unclear --source <url> [--note "..."]
import fs from 'node:fs';
import path from 'node:path';
import { loadContext, ROOT } from '../engine/context.mjs';
import { applyFactCheck } from '../engine/review.mjs';

const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const file = path.resolve(ROOT, get('review'));
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
applyFactCheck(r, loadContext(), { id: get('id'), verdict: get('verdict'), sourceUrl: get('source'), note: get('note') });
// anchor any new deduction quote against the saved draft
const draft = fs.readFileSync(path.join(ROOT, r.draft_path), 'utf8');
for (const d of r.deductions) if (!d.anchor && d.quote) { const i = draft.indexOf(d.quote); if (i >= 0) { const b = draft.slice(0, i); d.anchor = { line: b.split('\n').length, col: i - b.lastIndexOf('\n') - 1, length: d.quote.length, offset: i }; } }
for (const is of r.issues) if (!is.anchor && is.deduction_id) is.anchor = r.deductions.find((d) => d.id === is.deduction_id)?.anchor || null;
fs.writeFileSync(file, JSON.stringify(r, null, 2));
console.log(`${get('id')}: ${get('verdict')}. Average now ${r.average}.`);
