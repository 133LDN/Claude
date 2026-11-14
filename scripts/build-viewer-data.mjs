#!/usr/bin/env node
// Snapshot reviews, drafts and the guidance store into viewer/src/data.json (the viewer is read-only).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listReviews, loadContext } from '../src/engine/context.mjs';

const ctx = loadContext();
const withDraft = (r) => {
  const p = r.draft_path && path.join(ROOT, r.draft_path);
  return { ...r, draft_text: p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null };
};
const user = listReviews('reviews').map((x) => withDraft(x.data)).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
const calibration = listReviews('reviews/calibration').map((x) => withDraft(x.data));
const data = {
  generated_at: new Date().toISOString(),
  config: ctx.config,
  rubric: ctx.rubric,
  sources: ctx.raw.sources,
  capture_note: JSON.parse(fs.readFileSync(path.join(ROOT, 'guidance/sources.json'), 'utf8')).capture_method_note,
  claims: ctx.raw.claims,
  reviews: user,
  calibration
};
fs.writeFileSync(path.join(ROOT, 'viewer/src/data.json'), JSON.stringify(data));
console.log(`viewer data: ${user.length} review(s), ${calibration.length} calibration review(s), ${data.sources.length} sources`);
