#!/usr/bin/env node
// npm run verify. Prints PASS/FAIL for 8 checks and exits 1 if any fails.
// Do not edit checks or thresholds to make them pass.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadContext, ROOT, listReviews } from '../src/engine/context.mjs';
import { splitSentences } from '../src/engine/review.mjs';
import { EXAMPLES } from '../src/engine/examples.mjs';
import { PHIL, ECON } from '../src/engine/lexicon.mjs';
import { runCalibration, THRESHOLDS } from './calibrate.mjs';

const REQUIRED_TIER1 = [
  'ucas-3q', 'ucas-ai', 'ucas-declaration', 'ucas-similarity',
  'lse-ps', 'lse-phil-econ', 'lse-phil-econ-structure',
  'durham-ps', 'durham-substitute', 'durham-conf-2026',
  'ed-what-you-need', 'ed-how-select', 'ed-unsuccessful-ps'
];
const results = [];
const report = (n, name, problems, info = []) => {
  results.push({ n, pass: problems.length === 0 });
  console.log(`\n[${problems.length ? 'FAIL' : 'PASS'}] ${n}. ${name}`);
  for (const i of info) console.log(`       ${i}`);
  for (const p of problems.slice(0, 25)) console.log(`   x   ${p}`);
  if (problems.length > 25) console.log(`   x   ... ${problems.length - 25} more`);
};

const ctx = loadContext();
const sources = ctx.raw.sources;
const stored1 = new Set(sources.filter((s) => s.tier === 1 && s.status === 'stored').map((s) => s.id));

// 1 ------------------------------------------------------------------
{
  const p = [];
  const ids = new Set();
  for (const s of sources) {
    if (ids.has(s.id)) p.push(`duplicate id ${s.id}`); ids.add(s.id);
    if (![1, 2, 3].includes(s.tier)) p.push(`${s.id}: no valid tier`);
    if (s.status === 'stored') {
      if (!s.url) p.push(`${s.id}: stored without url`);
      if (!s.date_captured) p.push(`${s.id}: stored without date`);
      if (!Array.isArray(s.extracts) || !s.extracts.length) p.push(`${s.id}: stored without extracts`);
      if (typeof s.notes !== 'string') p.push(`${s.id}: stored without notes`);
    } else if (s.status === 'missing') {
      if (!s.missing_reason || s.missing_reason.length < 20) p.push(`${s.id}: missing without a reason`);
    } else p.push(`${s.id}: status must be stored|missing`);
  }
  for (const id of REQUIRED_TIER1) {
    const s = ctx.sources.get(id);
    if (!s) p.push(`required source ${id} absent from guidance/sources.json`);
    else if (s.tier !== 1) p.push(`required source ${id} is not tier 1`);
  }
  const info = ['Source list:'].concat(sources.map((s) => `  T${s.tier} ${s.status.padEnd(7)} ${s.id.padEnd(24)} ${s.status === 'stored' ? s.url : 'MISSING: ' + s.missing_reason}`));
  info.push(`  (${sources.filter((s) => s.status === 'stored').length} stored, ${sources.filter((s) => s.status === 'missing').length} missing; capture method: ${[...new Set(sources.filter((s) => s.fetch_method).map((s) => s.fetch_method))].join(', ')})`);
  report(1, 'Every required source stored or missing-with-reason, each with tier', p, info);
}

// 2 ------------------------------------------------------------------
{
  const p = [];
  const LABELS = ['confirmed', 'unconfirmed', 'contradicted'];
  for (const c of ctx.raw.claims) {
    if (!LABELS.includes(c.label)) p.push(`${c.id}: no cross-check label`);
    if (c.label === 'confirmed' && !(c.tier1_ids || []).some((id) => stored1.has(id))) p.push(`${c.id}: confirmed but cites no stored tier 1 source`);
    for (const id of c.tier1_ids || []) if (!ctx.sources.get(id) || ctx.sources.get(id).tier !== 1) p.push(`${c.id}: ${id} is not a tier 1 source`);
    if (c.label === 'contradicted' && c.use !== 'dropped') p.push(`${c.id}: contradicted but not dropped`);
    if (c.label === 'unconfirmed' && c.use === 'rubric') p.push(`${c.id}: unconfirmed claim used in rubric`);
    if (c.origin_tier > 1 && c.use === 'rubric') p.push(`${c.id}: tier ${c.origin_tier} claim used directly in rubric`);
  }
  const rubricClaims = [];
  for (const cr of ctx.rubric.criteria) for (const v of ['main', 'durham']) {
    const ids = cr[v]?.claims || [];
    if (!ids.length) p.push(`criterion ${cr.id}/${v}: no claims`);
    const t1 = ids.flatMap((id) => (ctx.claims.get(id)?.tier1_ids || []).filter((x) => stored1.has(x)));
    if (!t1.length) p.push(`criterion ${cr.id}/${v}: no tier 1 id`);
    rubricClaims.push(...ids);
  }
  for (const ch of ctx.rubric.checks) rubricClaims.push(...ch.claims);
  for (const id of new Set(rubricClaims)) {
    const c = ctx.claims.get(id);
    if (!c) p.push(`rubric cites unknown claim ${id}`);
    else if (c.label !== 'confirmed') p.push(`rubric cites ${c.label} claim ${id}`);
  }
  const by = (l) => ctx.raw.claims.filter((c) => c.label === l).length;
  report(2, 'Every rubric claim has a cross-check label and every criterion a tier 1 id', p, [`${ctx.raw.claims.length} claims: ${by('confirmed')} confirmed, ${by('unconfirmed')} unconfirmed (advice only), ${by('contradicted')} contradicted (dropped)`]);
}

// 3 ------------------------------------------------------------------
let averages;
{
  const p = [];
  const cal = runCalibration({ write: true });
  averages = cal.averages;
  const { weak, middling, strong } = averages;
  const t = THRESHOLDS;
  if (!(strong >= t.strongMin)) p.push(`strong ${strong} < ${t.strongMin}`);
  if (!(weak <= t.weakMax)) p.push(`weak ${weak} > ${t.weakMax}`);
  if (!(middling - weak >= t.middlingGap)) p.push(`middling ${middling} is not ${t.middlingGap}+ above weak ${weak}`);
  if (!(strong - middling >= t.middlingGap)) p.push(`middling ${middling} is not ${t.middlingGap}+ below strong ${strong}`);
  report(3, 'Calibration holds', p, [`Fixture averages: weak ${weak}, middling ${middling}, strong ${strong}`, `Required: strong >= ${t.strongMin}, weak <= ${t.weakMax}, middling >= ${t.middlingGap} from both`]);
}

const reviews = [...listReviews('reviews'), ...listReviews('reviews/calibration')];

// 4 ------------------------------------------------------------------
{
  const p = [];
  let n = 0;
  for (const { file, data: r } of reviews) {
    const draftAbs = r.draft_path && path.join(ROOT, r.draft_path);
    const draft = draftAbs && fs.existsSync(draftAbs) ? fs.readFileSync(draftAbs, 'utf8') : null;
    if (!draft) p.push(`${file}: draft ${r.draft_path} not found`);
    for (const d of r.deductions || []) {
      n++;
      if (!d.quote || !d.quote.trim()) p.push(`${file} ${d.id}: no quote`);
      else if (draft && !draft.includes(d.quote)) p.push(`${file} ${d.id}: quote not verbatim in draft`);
      for (const q of d.extra_quotes || []) if (draft && !draft.includes(q)) p.push(`${file} ${d.id}: extra quote not in draft`);
      if (!d.tier1_id || !stored1.has(d.tier1_id)) p.push(`${file} ${d.id}: tier1_id ${d.tier1_id} is not a stored tier 1 source`);
      const c = ctx.claims.get(d.claim_id);
      if (!c || c.label !== 'confirmed') p.push(`${file} ${d.id}: claim ${d.claim_id} not confirmed`);
      else if (!c.tier1_ids.includes(d.tier1_id)) p.push(`${file} ${d.id}: tier1_id not among claim's sources`);
    }
  }
  report(4, 'Every deduction has quote plus tier 1 id', p, [`${n} deductions across ${reviews.length} review(s)`]);
}

// 5 ------------------------------------------------------------------
{
  const p = [];
  const crit = ctx.rubric.criteria.map((c) => c.id);
  for (const { file, data: r } of reviews) {
    for (const cid of crit) {
      const m = (r.moderation || []).find((x) => x.criterion === cid);
      if (!m) { p.push(`${file}: no moderation for ${cid}`); continue; }
      for (const k of ['too_high', 'too_low']) {
        if (!m[k] || !['yes', 'no'].includes(m[k].answer) || !(m[k].reasoning || '').trim()) p.push(`${file} ${cid}: ${k} missing answer or reasoning`);
      }
      if (typeof m.after !== 'number' || m.after !== r.scores[cid]) p.push(`${file} ${cid}: moderated score ${m.after} != recorded score ${r.scores[cid]}`);
    }
  }
  report(5, 'Every review has both moderation answers', p, [`${reviews.length} review(s) checked: ${reviews.map((r) => path.basename(r.file)).join(', ')}`]);
}

// 6 ------------------------------------------------------------------
{
  const p = [];
  for (const f of ['.claude/commands/review-ps.md', '.claude/commands/review-durham.md', '.claude/commands/refresh-guidance.md', 'CLAUDE.md']) if (!fs.existsSync(path.join(ROOT, f))) p.push(`${f} missing`);
  if (fs.existsSync(path.join(ROOT, 'CLAUDE.md'))) {
    const md = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8').toLowerCase();
    for (const must of ['diagnose', 'explain', 'ask questions', '2 sentences', 'not for use', 'different topic', 'never rewrite', 'draft paragraphs', 'invent experiences']) if (!md.includes(must)) p.push(`CLAUDE.md lacks tutor limit: "${must}"`);
  }
  report(6, 'Commands and CLAUDE.md exist', p);
}

// 7 ------------------------------------------------------------------
{
  const p = [];
  const data = spawnSync(process.execPath, ['scripts/build-viewer-data.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (data.status !== 0) p.push('viewer data step failed: ' + (data.stderr || '').trim().split('\n').slice(-3).join(' | '));
  const b = spawnSync('npm', ['--prefix', 'viewer', 'run', 'build'], { cwd: ROOT, encoding: 'utf8' });
  if (b.status !== 0) p.push('vite build failed: ' + ((b.stderr || '') + (b.stdout || '')).trim().split('\n').slice(-5).join(' | '));
  const tail = (b.stdout || '').trim().split('\n').filter((l) => /dist\/|built in/.test(l)).slice(-4);
  report(7, 'Site builds', p, tail);
}

// 8 ------------------------------------------------------------------
{
  const p = [];
  const all = [...Object.entries(EXAMPLES).map(([k, e]) => ['library ' + k, e])];
  for (const { file, data: r } of reviews) for (const i of r.issues || []) if (i.example) all.push([`${file} ${i.id}`, i.example]);
  for (const [where, e] of all) {
    const n = splitSentences(e.text).length;
    if (n > 2) p.push(`${where}: ${n} sentences`);
    if (e.label !== 'not for use') p.push(`${where}: not labelled "not for use"`);
    if (PHIL.test(e.text) || ECON.test(e.text)) p.push(`${where}: example is on the applicant's subjects`);
  }
  report(8, 'No example over 2 sentences', p, [`${all.length} example(s) checked (library + reviews)`]);
}

const failed = results.filter((r) => !r.pass).map((r) => r.n);
console.log(`\n${failed.length ? 'FAILED checks: ' + failed.join(', ') : 'ALL 8 CHECKS PASS'}`);
console.log(`Fixture averages: weak ${averages.weak}, middling ${averages.middling}, strong ${averages.strong}`);
console.log('Viewer (read-only): run `npm run viewer`, then open http://localhost:5173/');
process.exit(failed.length ? 1 : 0);
