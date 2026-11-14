#!/usr/bin/env node
// Usage: node src/cli/review.mjs --type main|durham --input <file>
// Copies the draft byte-for-byte into drafts/, writes reviews/<id>.json, prints a summary.
import fs from 'node:fs';
import path from 'node:path';
import { loadContext, ROOT, stamp, listReviews } from '../engine/context.mjs';
import { review } from '../engine/review.mjs';

const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const args = { type: get('type'), input: get('input') };
const type = args.type;
if (!['main', 'durham'].includes(type) || !args.input) { console.error('Usage: --type main|durham --input <file>'); process.exit(2); }

const bytes = fs.readFileSync(path.resolve(args.input));
const id = `${type}-${stamp()}`;
const draftRel = `drafts/${id}.txt`;
fs.mkdirSync(path.join(ROOT, 'drafts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, draftRel), bytes); // verbatim
const text = bytes.toString('utf8');

const ctx = loadContext();
const prev = listReviews('reviews').map((r) => r.data).filter((r) => r.type === type).sort((a, b) => a.created_at.localeCompare(b.created_at)).pop() || null;
const r = review({ text, type, ctx, draftPath: draftRel, id, createdAt: new Date().toISOString(), previous: prev });
fs.mkdirSync(path.join(ROOT, 'reviews'), { recursive: true });
const out = `reviews/${id}.json`;
fs.writeFileSync(path.join(ROOT, out), JSON.stringify(r, null, 2));

console.log(`Saved draft:  ${draftRel}`);
console.log(`Saved review: ${out}`);
console.log(`Characters: Q1 ${r.char_counts.q1}, Q2 ${r.char_counts.q2}, Q3 ${r.char_counts.q3}, total ${r.char_counts.total}/4000`);
for (const c of r.checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
for (const [k, v] of Object.entries(r.scores)) console.log(`  ${k.padEnd(20)} ${v}`);
console.log(`Average ${r.average}. Fact-checks queued: ${r.fact_checks.length}.`);
