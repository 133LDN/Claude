#!/usr/bin/env node
// node scripts/refresh-guidance.mjs          -> print diff of guidance/sources.next.json vs guidance/sources.json
// node scripts/refresh-guidance.mjs --apply  -> back up the current store, then replace it with the next one
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../src/engine/context.mjs';

const cur = path.join(ROOT, 'guidance/sources.json');
const next = path.join(ROOT, 'guidance/sources.next.json');
if (!fs.existsSync(next)) { console.error('No guidance/sources.next.json. Build it first (see /refresh-guidance).'); process.exit(2); }
const A = JSON.parse(fs.readFileSync(cur, 'utf8')).sources;
const B = JSON.parse(fs.readFileSync(next, 'utf8')).sources;
const a = new Map(A.map((s) => [s.id, s])), b = new Map(B.map((s) => [s.id, s]));
let changes = 0;
for (const [id, s] of b) if (!a.has(id)) { changes++; console.log(`+ ADDED   ${id} (T${s.tier}, ${s.status}) ${s.url || ''}`); }
for (const [id, s] of a) if (!b.has(id)) { changes++; console.log(`- REMOVED ${id} (T${s.tier})`); }
for (const [id, s] of b) {
  const o = a.get(id); if (!o) continue;
  const fields = ['tier', 'status', 'url', 'fetch_method', 'missing_reason', 'governs', 'notes'].filter((f) => JSON.stringify(o[f]) !== JSON.stringify(s[f]));
  const oe = new Set(o.extracts || []), ne = new Set(s.extracts || []);
  const lost = [...oe].filter((x) => !ne.has(x)), gained = [...ne].filter((x) => !oe.has(x));
  if (fields.length || lost.length || gained.length) {
    changes++;
    console.log(`~ CHANGED ${id}`);
    for (const f of fields) console.log(`    ${f}: ${JSON.stringify(o[f])} -> ${JSON.stringify(s[f])}`);
    for (const x of lost) console.log(`    - extract: ${x}`);
    for (const x of gained) console.log(`    + extract: ${x}`);
  }
}
console.log(changes ? `\n${changes} source(s) differ.` : 'No differences.');
if (process.argv.includes('--apply')) {
  const hist = path.join(ROOT, 'guidance/history');
  fs.mkdirSync(hist, { recursive: true });
  const bak = path.join(hist, `sources-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.copyFileSync(cur, bak);
  fs.copyFileSync(next, cur);
  fs.unlinkSync(next);
  console.log(`Applied. Previous store saved to ${path.relative(ROOT, bak)}. Now re-cross-check guidance/claims.json and run npm run verify.`);
} else console.log('Dry run. Show this diff to the applicant; apply only with --apply after they confirm.');
