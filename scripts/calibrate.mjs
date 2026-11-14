#!/usr/bin/env node
// Runs the real review engine on the three synthetic fixtures and writes reviews/calibration/*.json.
// Thresholds are fixed here and in verify.mjs. Fix the reviewer, never the numbers.
import fs from 'node:fs';
import path from 'node:path';
import { loadContext, ROOT } from '../src/engine/context.mjs';
import { review } from '../src/engine/review.mjs';

export const THRESHOLDS = { strongMin: 8.5, weakMax: 4.5, middlingGap: 1.5 };

export function runCalibration({ write = true } = {}) {
  const ctx = loadContext();
  const out = {};
  for (const name of ['weak', 'middling', 'strong']) {
    const rel = `fixtures/${name}.txt`;
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const r = review({ text, type: 'main', ctx, draftPath: rel, id: `calibration-${name}`, createdAt: '2026-11-14T00:00:00.000Z' });
    r.calibration_fixture = name;
    if (write) {
      fs.mkdirSync(path.join(ROOT, 'reviews/calibration'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, `reviews/calibration/${name}.json`), JSON.stringify(r, null, 2));
    }
    out[name] = r;
  }
  const { weak, middling, strong } = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.average]));
  const t = THRESHOLDS;
  const holds = strong >= t.strongMin && weak <= t.weakMax && middling - weak >= t.middlingGap && strong - middling >= t.middlingGap;
  return { reviews: out, averages: { weak, middling, strong }, holds };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { reviews, averages, holds } = runCalibration();
  for (const [k, r] of Object.entries(reviews)) {
    console.log(`\n== ${k}: average ${r.average}  (chars ${r.char_counts.total}, academic ${Math.round(r.academic_share * 100)}%, critical ${r.sentence_stats.critical})`);
    console.log('   scores', JSON.stringify(r.scores));
    for (const d of r.deductions) console.log(`   ${d.refunded ? '(refunded) ' : ''}${d.id} ${d.criterion} -${d.points} ${d.claim_id}: ${d.reason} | "${d.quote.slice(0, 70)}"`);
    for (const c of r.checks) if (!c.pass) console.log(`   FAIL check ${c.id}: ${c.detail}`);
  }
  console.log('\nAverages', averages, 'holds:', holds);
}
