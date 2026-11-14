import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const j = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export function loadContext() {
  const sources = j('guidance/sources.json').sources;
  const claims = j('guidance/claims.json').claims;
  return {
    sources: new Map(sources.map((s) => [s.id, s])),
    claims: new Map(claims.map((c) => [c.id, c])),
    rubric: j('rubric/rubric.json'),
    config: j('config/applicant.json'),
    raw: { sources, claims }
  };
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export function listReviews(dir = 'reviews') {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.json')).map((f) => ({ file: path.join(dir, f), data: JSON.parse(fs.readFileSync(path.join(abs, f), 'utf8')) }));
}
