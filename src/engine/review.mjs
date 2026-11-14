// Deterministic review engine. Same input + same guidance store => same review.
// Rules:
//  - Every deduction carries a verbatim quote from the draft and a confirmed claim with stored tier 1 ids.
//  - A criterion with nothing deductible scores 10. There is no default or mid-point.
//  - Tier 2/3 claims appear only as advice with score_impact 0.
//  - Opinions (no source) are labelled and have score_impact 0.
import * as L from './lexicon.mjs';
import { EXAMPLES } from './examples.mjs';

export const ENGINE_VERSION = '1.0.0';
const SEV = { minor: 1, moderate: 2, major: 3 };

// ---------- parsing ----------
const HEADER = /^\s*(?:#+\s*)?(?:\*\*)?\s*(?:Q(?:uestion)?\s*([123])|([123])\s*[.)])\s*(?:\*\*)?\s*[:.\-–—]?\s*(.*)$/i;

export function parseDraft(text) {
  const lines = text.split('\n');
  const answers = { q1: [], q2: [], q3: [] };
  let cur = null;
  for (const line of lines) {
    const m = line.match(HEADER);
    if (m) {
      cur = 'q' + (m[1] || m[2]);
      const rest = (m[3] || '').trim();
      if (rest && !rest.endsWith('?')) answers[cur].push(rest);
      continue;
    }
    if (cur) answers[cur].push(line);
  }
  const out = {};
  for (const k of ['q1', 'q2', 'q3']) out[k] = answers[k].join('\n').trim();
  const found = Object.values(out).filter(Boolean).length;
  if (found === 0) throw new Error('Could not find Q1/Q2/Q3 headers. Label answers "Q1:", "Q2:", "Q3:".');
  return out;
}

const ABBR = /\b(?:e\.g|i\.e|etc|Dr|Mr|Mrs|Ms|Prof|St|vs|cf|J\.S|Ch|No)\.$/;
export function splitSentences(text) {
  const raw = text.replace(/\s*\n\s*/g, ' ').trim();
  if (!raw) return [];
  const parts = [];
  let buf = '';
  const tokens = raw.split(/(?<=[.!?]["'”’)]?)\s+/);
  for (const t of tokens) {
    buf = buf ? buf + ' ' + t : t;
    if (ABBR.test(buf) || /\b[A-Z]\.$/.test(buf)) continue;
    parts.push(buf);
    buf = '';
  }
  if (buf) parts.push(buf);
  return parts;
}

// UCAS counts characters including spaces. We count Unicode code points of the trimmed answer.
export const charCount = (s) => [...s].length;

// ---------- sentence features ----------
const LEARNED = /\b(?:taught me (?:why|how|that|to)|convinced me|persuaded me|i now|made me (?:question|doubt|more)|unsettled me|found (?:it )?harder|which made me)/i;
const SKILLS_ONLY = /\bskills?\b/i;

function features(text, q, idx, all) {
  const philHits = (text.match(new RegExp(L.PHIL.source, 'gi')) || []).length;
  const econHits = (text.match(new RegExp(L.ECON.source, 'gi')) || []).length;
  const phil = philHits > 0;
  const econ = econHits > 0;
  const lead = philHits > econHits ? 'phil' : econHits > philHits ? 'econ' : (philHits ? 'both' : null);
  const subject = phil || econ;
  const extra = L.EXTRACURRICULAR.test(text);
  const career = L.CAREER.test(text);
  const grades = L.GRADES.test(text);
  const reflection = L.REFLECTION.test(text);
  const learned = LEARNED.test(text);
  const ownView = L.OWN_VIEW.test(text);
  const objection = L.OBJECTION.test(text);
  const reason = L.REASON.test(text);
  const critical = (ownView && (reason || objection)) || (objection && reason && subject);
  const study = L.STUDY.test(text);
  let academic = subject || (study && L.ACADEMIC_MARKERS.test(text));
  if (extra && !(subject && (reflection || learned))) academic = false;
  if (career || grades) academic = false;
  if (SKILLS_ONLY.test(text) && !subject) academic = false;
  const named = L.NAMED_WORK_OR_AUTHOR.test(text) || /\bThe Economist\b/.test(text);
  return { text, q, idx, phil, econ, philHits, econHits, lead, subject, extra, career, grades, reflection, learned, ownView, objection, reason, critical, study, academic, named, chars: charCount(text) };
}


// A list: at least 2 commas once title-case titles ("Thinking, Fast and Slow") are masked,
// and a run of 3+ short segments (<= 8 words) split on commas and "and".
export function isList(t) {
  const masked = t.replace(/\b[A-Z][a-z]+(?:, [A-Z][a-z]+)+(?: and [A-Z][a-z]+)?/g, 'TITLE');
  if ((masked.match(/,/g) || []).length < 2) return false;
  if (!/,[^,]+,?\s(?:and|or)\s/.test(masked)) return false; // needs the "X, Y and Z" shape
  const segs = masked.split(/,|\band\b/).map((x) => x.trim().split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  let run = 0, best = 0;
  for (const n of segs) { run = n <= 8 ? run + 1 : 0; best = Math.max(best, run); }
  return best >= 3;
}

// ---------- helpers ----------
function tier1For(claimId, ctx) {
  const c = ctx.claims.get(claimId);
  if (!c) throw new Error(`Unknown claim ${claimId}`);
  if (c.label !== 'confirmed') throw new Error(`Claim ${claimId} is ${c.label}; cannot move a score`);
  const ids = c.tier1_ids.filter((id) => {
    const s = ctx.sources.get(id);
    return s && s.tier === 1 && s.status === 'stored';
  });
  if (!ids.length) throw new Error(`Claim ${claimId} has no stored tier 1 source`);
  return ids;
}

function locate(text, quote) {
  const i = text.indexOf(quote);
  if (i < 0) return null;
  const before = text.slice(0, i);
  const line = before.split('\n').length;
  const col = i - before.lastIndexOf('\n') - 1;
  return { line, col, length: quote.length, offset: i };
}

// A sentence may span a line break in the draft; quote the longest verbatim prefix if needed.
function verbatim(draft, sentence) {
  if (draft.includes(sentence)) return sentence;
  const words = sentence.split(' ');
  for (let n = words.length - 1; n >= 4; n--) {
    const s = words.slice(0, n).join(' ');
    if (draft.includes(s)) return s;
  }
  return null;
}

// ---------- main ----------
export function review({ text, type, ctx, draftPath = null, id = null, createdAt = null, previous = null }) {
  if (!['main', 'durham'].includes(type)) throw new Error('type must be main or durham');
  const answers = parseDraft(text);
  const counts = { q1: charCount(answers.q1), q2: charCount(answers.q2), q3: charCount(answers.q3) };
  counts.total = counts.q1 + counts.q2 + counts.q3;

  const sents = [];
  for (const q of ['q1', 'q2', 'q3']) {
    const ss = splitSentences(answers[q]);
    ss.forEach((s, i) => sents.push({ s, q, i }));
  }
  const F = sents.map(({ s, q, i }, k) => features(s, q, i, sents));
  // a named reading is engaged with if it, or the next sentence in the same answer, is critical/learned
  F.forEach((f, k) => {
    const next = F[k + 1] && F[k + 1].q === f.q ? F[k + 1] : null;
    f.descriptiveRead = f.named && /\bread\b|\breading\b/i.test(f.text) && !f.critical && !f.learned && !(next && (next.critical || next.learned));
    f.bridge = L.BRIDGE.test(f.text) || (f.phil && f.econ && f.critical);
    if (f.bridge) f.lead = 'both'; // philosophy-of-economics sentences belong to both subjects
  });

  const deductions = [];
  const notes = { opinions: [], advice: [], limitations: [] };
  let dn = 0;
  const ded = (criterion, severity, sentenceText, claimId, reason, selectorCare, extraQuotes = []) => {
    const quote = verbatim(text, sentenceText);
    if (!quote) return null; // no verbatim quote => deduction is not allowed
    const tier1_ids = tier1For(claimId, ctx);
    const d = {
      id: `D${++dn}`, criterion, severity, points: SEV[severity], quote, anchor: locate(text, quote),
      extra_quotes: extraQuotes.map((q) => verbatim(text, q)).filter(Boolean),
      claim_id: claimId, tier1_id: tier1_ids[0], tier1_ids, reason, selector_care: selectorCare, source: 'engine'
    };
    deductions.push(d);
    return d;
  };
  const longest = (arr) => arr.slice().sort((a, b) => b.chars - a.chars)[0];
  const firstOf = (q) => F.find((f) => f.q === q);
  const motivation = F.find((f) => f.q === 'q1' && f.academic) || firstOf('q1') || F[0];
  const isMain = type === 'main';

  // ----- checks (pass/fail) -----
  const checks = [];
  checks.push({ id: 'total_chars', name: '4000 characters total', pass: counts.total <= 4000, detail: `${counts.total} / 4000 characters (including spaces)`, claim_ids: ['C-001'], tier1_ids: tier1For('C-001', ctx) });
  const shortQs = ['q1', 'q2', 'q3'].filter((q) => counts[q] < 350);
  checks.push({ id: 'min_per_answer', name: '350 minimum per answer', pass: shortQs.length === 0, detail: ['q1', 'q2', 'q3'].map((q) => `${q.toUpperCase()} ${counts[q]}`).join(', ') + (shortQs.length ? ` (under 350: ${shortQs.join(', ').toUpperCase()})` : ''), claim_ids: ['C-002'], tier1_ids: tier1For('C-002', ctx) });
  const uniHits = [];
  for (const f of F) for (const u of L.UNIVERSITIES) {
    const m = f.text.match(u.re);
    if (m) uniHits.push({ name: u.name, match: m[0], quote: verbatim(text, f.text), q: f.q, ambiguous_place: !!u.ambiguousPlace });
  }
  checks.push({ id: 'no_university', name: 'No university named', pass: uniHits.length === 0, detail: uniHits.length ? uniHits.map((h) => `"${h.match}" in ${h.q.toUpperCase()}${h.ambiguous_place ? ' (could be a place name; check)' : ''}`).join('; ') : 'none found', quotes: uniHits.map((h) => h.quote), claim_ids: ['C-008'], tier1_ids: tier1For('C-008', ctx) });
  const careerQ1 = F.filter((f) => f.q === 'q1' && f.career);
  checks.push({ id: 'no_career_q1', name: 'No career plans in Q1', pass: careerQ1.length === 0 || !isMain, advisory: !isMain, detail: careerQ1.length ? `${careerQ1.length} career sentence(s) in Q1${isMain ? '' : ' (advisory for Durham: no tier 1 ban)'}` : 'none found', quotes: careerQ1.map((f) => verbatim(text, f.text)), claim_ids: ['C-009'], tier1_ids: tier1For('C-009', ctx) });
  const generic = [];
  const lower = text.toLowerCase();
  for (const p of L.GENERIC_HARD) { let i = lower.indexOf(p); while (i >= 0) { generic.push({ phrase: p, kind: 'hard', at: i }); i = lower.indexOf(p, i + p.length); } }
  for (const p of L.GENERIC_SOFT) { let i = lower.indexOf(p); while (i >= 0) { generic.push({ phrase: p, kind: 'soft', at: i }); i = lower.indexOf(p, i + p.length); } }
  // drop hard phrases nested inside a longer hard phrase at the same spot
  // drop phrases that overlap a longer (or earlier, equal-length) match: one stretch of text counts once
  const overlaps = (a, b) => a.at < b.at + b.phrase.length && b.at < a.at + a.phrase.length;
  const gen = generic.filter((g) => !generic.some((o) => o !== g && overlaps(o, g) && (o.phrase.length > g.phrase.length || (o.phrase.length === g.phrase.length && o.at < g.at))));
  gen.forEach((g) => { g.quote = text.slice(g.at, g.at + g.phrase.length); g.anchor = locate(text, g.quote); g.sentence = verbatim(text, (F.find((f) => f.text.toLowerCase().includes(g.phrase)) || {}).text || '') });
  const hard = gen.filter((g) => g.kind === 'hard');
  const soft = gen.filter((g) => g.kind === 'soft');
  checks.push({ id: 'generic_phrasing', name: 'Generic or AI-sounding phrasing (quoted)', pass: hard.length === 0 && soft.length < 3, detail: gen.length ? gen.map((g) => `"${g.quote}"`).join(', ') : 'none found', quotes: gen.map((g) => g.quote), note: 'Phrase list is a heuristic. A match is not proof of AI use; it is phrasing selectors read as generic.', claim_ids: ['C-013', 'C-014'], tier1_ids: [...new Set([...tier1For('C-013', ctx), ...tier1For('C-014', ctx)])] });

  // ----- 1 academic focus -----
  const acadChars = F.filter((f) => f.academic).reduce((a, f) => a + f.chars, 0);
  const allChars = F.reduce((a, f) => a + f.chars, 0) || 1;
  const share = acadChars / allChars;
  const nonAcad = F.filter((f) => !f.academic);
  if (isMain) {
    if (share < 0.8 && nonAcad.length) {
      const top = nonAcad.slice().sort((a, b) => b.chars - a.chars);
      if (share >= 0.7) ded('academic_focus', 'moderate', top[0].text, 'C-003', `About ${Math.round(share * 100)}% of the statement is about the subjects; LSE asks for at least 80%.`, 'LSE states the 80% figure explicitly, so a selector will notice a shortfall.', top.slice(1, 3).map((f) => f.text));
      else ded('academic_focus', 'major', top[0].text, 'C-003', `Only about ${Math.round(share * 100)}% of the statement is about the subjects; LSE asks for at least 80%.`, 'A clear miss on a published LSE threshold.', top.slice(1, 4).map((f) => f.text));
      if (share < 0.55 && top[1]) ded('academic_focus', 'moderate', top[1].text, 'C-007', 'Less than 55% academic content: the case for the programme is thin.', 'Edinburgh and LSE both reject statements that do not show subject commitment.', top.slice(2, 5).map((f) => f.text));
    }
  } else {
    const top = nonAcad.slice().sort((a, b) => b.chars - a.chars);
    if (share < 0.45 && top[0]) ded('academic_focus', 'major', top[0].text, 'C-007', `Only about ${Math.round(share * 100)}% of the substitute statement is about economics or study.`, 'Durham reads this instead of the main statement; little academic content leaves selectors nothing to assess.', top.slice(1, 3).map((f) => f.text));
    else if (share < 0.6 && top[0]) ded('academic_focus', 'moderate', top[0].text, 'C-021', `About ${Math.round(share * 100)}% academic content; Durham social sciences selectors look for engagement with reading.`, 'Noticeable but not decisive.', []);
  }

  // ----- 2 critical engagement -----
  const crit = F.filter((f) => f.critical && (isMain ? f.subject : f.econ || f.study));
  const target = 4;
  const missing = Math.max(0, target - crit.length);
  if (missing > 0) {
    // anchor on descriptive lines that the C-016 (unexamined reading) deductions below will NOT already quote
    const desc = F.filter((f) => f.subject && !f.critical).sort((a, b) => (a.descriptiveRead - b.descriptiveRead) || (L.DESCRIPTIVE.test(b.text) - L.DESCRIPTIVE.test(a.text)) || b.chars - a.chars);
    const anchor = desc[0] || motivation;
    if (crit.length === 0) {
      ded('critical_engagement', 'major', anchor.text, 'C-005', 'No sentence anywhere gives your own view with a reason or an objection.', 'This is the core of what LSE and Durham say they look for.', desc.slice(1, 3).map((f) => f.text));
      ded('critical_engagement', 'major', (desc[1] || anchor).text, 'C-004', 'No critical engagement with any idea, text or argument.', 'Selectors cannot see how you think.', []);
    } else if (crit.length === 1) {
      ded('critical_engagement', 'major', anchor.text, 'C-005', `Only one sentence gives a view with a reason (${crit[0].q.toUpperCase()}). The rest describes.`, 'A single view across a whole statement reads as thin engagement.', desc.slice(1, 3).map((f) => f.text));
    } else if (crit.length <= 3) {
      ded('critical_engagement', crit.length === 2 ? 'moderate' : 'minor', anchor.text, 'C-005', `${crit.length} sentences give a view with a reason; more of the statement describes than evaluates.`, 'Selectors want views throughout, not in isolated places.', []);
    }
  }
  const descReads = F.filter((f) => f.descriptiveRead);
  descReads.slice(0, 2).forEach((f) => ded('critical_engagement', 'minor', f.text, 'C-016', 'Names a reading but says nothing about what you learnt, doubted or concluded from it.', 'Durham says reading counts only when you say what you learnt.'));
  const anyExploration = F.some((f) => f.named || /\b(?:theory|concept|study|model|essay|argument)\b/i.test(f.text) && f.subject);
  if (!anyExploration) ded('critical_engagement', 'major', motivation.text, 'C-024', 'No named text, concept, study or argument anywhere: no evidence of exploring the subject.', 'Edinburgh scores knowledge and exploration of the subject.');
  if (isMain && crit.length >= 2) {
    const pc = crit.filter((f) => f.phil).length, ec = crit.filter((f) => f.econ).length;
    if (pc === 0 || ec === 0) ded('critical_engagement', 'moderate', crit[0].text, 'C-006', `Every evaluative sentence is about ${pc === 0 ? 'economics' : 'philosophy'}; the other subject is only described.`, 'Equal weight is an explicit LSE rule for joint degrees.');
  }

  // ----- 3 balance / fit with Economics -----
  const acad = F.filter((f) => f.academic);
  if (isMain) {
    // a sentence counts for the subject whose terms dominate it; ties count for both
    const pChars = acad.filter((f) => f.lead === 'phil' || f.lead === 'both').reduce((a, f) => a + f.chars, 0);
    const eChars = acad.filter((f) => f.lead === 'econ' || f.lead === 'both').reduce((a, f) => a + f.chars, 0);
    const ratio = Math.max(pChars, eChars) ? Math.min(pChars, eChars) / Math.max(pChars, eChars) : 0;
    const weaker = pChars < eChars ? 'philosophy' : 'economics';
    const strongSide = acad.filter((f) => (weaker === 'philosophy' ? f.econ && !f.phil : f.phil && !f.econ)).sort((a, b) => b.chars - a.chars);
    const weakSide = acad.filter((f) => (weaker === 'philosophy' ? f.phil : f.econ));
    const ex = strongSide[0] || acad[0] || motivation;
    if (ratio < 0.6) {
      const sev = ratio < 0.4 ? 'major' : 'moderate';
      ded('subject_balance', sev, ex.text, 'C-006', `${weaker[0].toUpperCase() + weaker.slice(1)} gets about ${Math.round(ratio * 100)}% as much space as the other subject.`, 'LSE: a statement weighted to one side is "significantly less competitive".', strongSide.slice(1, 3).map((f) => f.text));
      if (ratio < 0.2) ded('subject_balance', 'moderate', (weakSide[0] || ex).text, 'C-006', `${weaker[0].toUpperCase() + weaker.slice(1)} appears only in passing.`, 'One subject of a joint degree is close to absent.');
    }
    const bridges = acad.filter((f) => f.bridge);
    if (!bridges.length) ded('subject_balance', 'moderate', (weakSide[0] || ex).text, 'C-023', 'No sentence connects the two subjects; they are discussed separately.', 'The LSE degree has a compulsory Philosophy of Economics course (PH311), so the link is part of the degree.');
  } else {
    const econAcad = acad.filter((f) => f.lead === 'econ' || f.lead === 'both').reduce((a, f) => a + f.chars, 0);
    const aChars = acad.reduce((a, f) => a + f.chars, 0) || 1;
    const es = econAcad / aChars;
    const philOnly = acad.filter((f) => f.lead === 'phil').sort((a, b) => b.chars - a.chars);
    if (es < 0.6 && (philOnly[0] || acad[0])) ded('subject_balance', es < 0.4 ? 'major' : 'moderate', (philOnly[0] || acad[0]).text, 'C-020', `Only about ${Math.round(es * 100)}% of the academic content is about economics.`, 'The substitute replaces the main statement for an Economics degree; non-economics material does not count for it.', philOnly.slice(1, 3).map((f) => f.text));
    const econCrit = crit.filter((f) => f.econ);
    if (!econCrit.length) ded('subject_balance', 'moderate', (acad.find((f) => f.econ) || motivation).text, 'C-007', 'No evaluative sentence about economics itself.', 'Durham selectors need to see you think about economics, not around it.');
  }

  // ----- 4 degree fit -----
  const strands = isMain ? L.STRANDS_MAIN : L.STRANDS_DURHAM;
  const engaged = F.filter((f) => f.academic && (f.critical || f.learned || (f.study && f.reflection) || f.reflection && f.subject));
  const hits = Object.fromEntries(Object.entries(strands).map(([k, re]) => [k, engaged.find((f) => re.test(f.text)) || null]));
  const missingStrands = Object.keys(hits).filter((k) => !hits[k]);
  const allowedMissing = isMain ? 1 : 1;
  const claimFit = isMain ? 'C-023' : 'C-022';
  const quantKey = isMain ? 'quantitative methods' : 'data and quantitative methods';
  let extraMissing = missingStrands.length - allowedMissing;
  if (missingStrands.includes(quantKey) && missingStrands.length > 0) {
    ded('degree_fit', 'moderate', motivation.text, claimFit, `Nothing engages with ${quantKey}, a compulsory part of the degree as taught.`, 'Quantitative methods are core in every named programme; selectors check for readiness.');
    extraMissing -= 1;
  }
  missingStrands.filter((k) => k !== quantKey).slice(0, Math.max(0, extraMissing)).forEach((k) => ded('degree_fit', 'minor', motivation.text, claimFit, `Nothing engages with ${k}, which the degree teaches.`, 'A gap a selector comparing you to the course outline would notice.'));
  const todo = ctx.config.statements[type].choices.filter((c) => c.university === 'TODO').length;
  if (todo) notes.limitations.push(`${todo} choice(s) are TODO in config/applicant.json, so fit across choices covers only the named choices. Nothing was guessed.`);

  // ----- 5 question content -----
  if (isMain) careerQ1.forEach((f) => ded('question_content', 'major', f.text, 'C-009', 'Career plans in Question 1. LSE asks applicants to keep them out of Q1.', 'Directly contradicts LSE guidance for the priority choice.'));
  if (!F.some((f) => f.q === 'q1' && f.academic)) ded('question_content', 'major', (firstOf('q1') || F[0]).text, 'C-028', 'Q1 never says what in the subject motivates you.', 'Q1 is where selectors look for motivation first.');
  F.filter((f) => f.q === 'q2' && f.grades).slice(0, 2).forEach((f, i) => ded('question_content', i === 0 ? 'moderate' : 'minor', f.text, 'C-011', 'Restates grades or predictions; selectors already see these elsewhere.', 'Wastes space UCAS explicitly says not to spend.'));
  if (!F.some((f) => f.q === 'q2' && (f.study || f.subject) && f.academic)) { const s = firstOf('q2'); if (s) ded('question_content', 'moderate', s.text, 'C-027', 'Q2 does not discuss what you studied or learned in your courses.', 'Q2 is the only place for recent study.'); }
  const q3 = F.filter((f) => f.q === 'q3');
  const q3Extra = q3.filter((f) => f.extra || !f.academic);
  if (q3Extra.length && !q3.some((f) => f.learned || (f.reflection && f.subject))) ded('question_content', 'moderate', longest(q3Extra).text, 'C-012', 'Q3 lists activities without reflecting on why any of them is useful for the course.', 'UCAS asks for reflection, not a list; Durham notes list-like statements as a concern.');
  // repetition across questions: identical 5-word sequences or the same aim restated
  const grams = {};
  for (const f of F) { const ws = f.text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean); for (let i = 0; i + 5 <= ws.length; i++) { const g = ws.slice(i, i + 5).join(' '); (grams[g] ||= new Set()).add(f.q + ':' + f.idx); } }
  const repeated = Object.entries(grams).filter(([g, set]) => new Set([...set].map((x) => x.split(':')[0])).size > 1);
  const careerQs = new Set(F.filter((f) => f.career).map((f) => f.q));
  let reps = 0;
  if (repeated.length) { const [g, set] = repeated[0]; const later = [...set].sort().pop().split(':'); const f = F.find((x) => x.q === later[0] && String(x.idx) === later[1]); if (f && ded('question_content', 'minor', f.text, 'C-010', `Repeats wording from another answer ("${g}").`, 'Each answer should add something new.')) reps++; }
  if (careerQs.size > 1 && reps < 2) { const f = F.filter((x) => x.career).pop(); ded('question_content', 'minor', f.text, 'C-010', 'The same career aim is restated in more than one answer.', 'Repetition uses space without adding anything.'); }

  // ----- 6 writing and space -----
  if (hard.length) {
    const sev = hard.length >= 6 ? 'major' : hard.length >= 3 ? 'moderate' : 'minor';
    const sentencesWith = [...new Set(hard.map((g) => g.sentence).filter(Boolean))];
    ded('writing_space', sev, sentencesWith[0], 'C-014', `${hard.length} stock or AI-associated phrase(s): ${hard.map((g) => `"${g.quote}"`).join(', ')}.`, hard.length >= 3 ? 'Durham selectors say they can often spot AI-like writing; clusters of stock phrases read that way.' : 'Noticeable, unlikely to decide anything alone.', sentencesWith.slice(1, 6));
  }
  if (soft.length >= 3) ded('writing_space', 'minor', soft[0].sentence, 'C-013', `Connector padding: ${soft.map((g) => `"${g.quote}"`).join(', ')}.`, 'Minor.');
  const lists = F.filter((f) => isList(f.text) && !f.reason && !f.critical && !f.learned);
  lists.slice(0, 2).forEach((f) => ded('writing_space', 'minor', f.text, 'C-015', 'A list of items with nothing said about any of them.', 'Durham selectors named list-like writing as a growing problem.'));
  if (counts.total > 4000) ded('writing_space', 'major', F[F.length - 1].text, 'C-001', `${counts.total} characters: over the 4000 limit. UCAS will not accept it.`, 'Cannot be submitted as is.');
  shortQs.forEach((q) => { const s = firstOf(q); if (s) ded('writing_space', 'major', s.text, 'C-002', `${q.toUpperCase()} has ${counts[q]} characters; the minimum is 350.`, 'Cannot be submitted as is.'); });

  // ----- opinions (no source, zero impact) -----
  if (counts.total < 3400) notes.opinions.push({ text: `Opinion (no published source): ${4000 - counts.total} characters unused. Space could carry more evidence of thinking.`, score_impact: 0 });
  F.filter((f) => f.text.split(/\s+/).length > 50).slice(0, 2).forEach((f) => notes.opinions.push({ text: 'Opinion (no published source): a sentence over 50 words is hard to follow on first read.', quote: verbatim(text, f.text), score_impact: 0 }));

  // ----- tier 2/3 advice (zero impact) -----
  const adv = (claimId, why) => { const c = ctx.claims.get(claimId); if (c && c.use === 'advice') notes.advice.push({ claim_id: claimId, tier: c.origin_tier, source_id: c.origin, text: c.text, status: c.label === 'confirmed' ? 'confirmed by tier 1' : 'not officially confirmed', why, score_impact: 0 }); };
  if (q3Extra.length >= 3) adv('A-002', 'Q3 covers several activities briefly.');
  if (!F.some((f) => f.named)) adv('A-003', 'No named text or concept anywhere.');
  if (isMain) adv('C-026', 'Edinburgh asks for awareness of career implications; if you include it, it belongs in Q2 or Q3, never Q1.');

  // ----- fact-check queue (zero impact until checked) -----
  const factChecks = F.filter((f) => f.named || /\b(?:study|experiment|survey|paper)\b[^.]*\b(?:where|found|showed|increased|reduced|raised|lowered)\b/i.test(f.text)).map((f, i) => ({ id: `F${i + 1}`, quote: verbatim(text, f.text), status: 'unverified', verdict: null, source_url: null, note: 'Check this claim about a text, author or idea against a reliable source before relying on it. Run by the /review-ps step "fact-check".' }));

  // ----- score, moderate -----
  const criteria = ctx.rubric.criteria.map((c) => ({ id: c.id, name: (c[type].name || c.name), claim_ids: c[type].claims, tier1_ids: [...new Set(c[type].claims.flatMap((cid) => tier1For(cid, ctx)))] }));
  const pct = (x) => `${Math.round(x * 100)}%`;
  const q1F = F.filter((f) => f.q === 'q1');
  const q1Non = q1F.filter((f) => !f.academic).reduce((a, f) => a + f.chars, 0) / (q1F.reduce((a, f) => a + f.chars, 0) || 1);
  const pChars = acad.filter((f) => f.lead === 'phil' || f.lead === 'both').reduce((a, f) => a + f.chars, 0), eChars = acad.filter((f) => f.lead === 'econ' || f.lead === 'both').reduce((a, f) => a + f.chars, 0);
  const probes = {
    academic_focus: `academic share ${pct(share)} (LSE guidance 80%${isMain ? '' : '; no Durham figure'}); Q1 non-academic share ${pct(q1Non)}`,
    critical_engagement: `${crit.length} evaluative sentence(s) (philosophy ${crit.filter((f) => f.phil).length}, economics ${crit.filter((f) => f.econ).length}); ${descReads.length} named reading(s) with nothing learned; own position stated: ${crit.some((f) => f.ownView) ? 'yes' : 'no'}`,
    subject_balance: isMain ? `philosophy ${pChars} vs economics ${eChars} characters of academic content; ${F.filter((f) => f.bridge).length} connecting sentence(s)` : `economics ${eChars} of ${acad.reduce((a, f) => a + f.chars, 0)} academic characters; ${crit.filter((f) => f.econ).length} evaluative economics sentence(s)`,
    degree_fit: `strands engaged: ${Object.keys(hits).filter((k) => hits[k]).join(', ') || 'none'}; missing: ${missingStrands.join(', ') || 'none'}; ${todo} TODO choice(s) not assessable`,
    question_content: `Q1 career sentences ${careerQ1.length}; Q2 grade sentences ${F.filter((f) => f.q === 'q2' && f.grades).length}; Q3 reflective sentences ${q3.filter((f) => f.learned || (f.reflection && f.subject)).length}/${q3.length}; repeated 5-word sequences ${repeated.length}`,
    writing_space: `${hard.length} stock phrase(s), ${soft.length} connector(s), ${lists.length} list-like sentence(s), ${counts.total}/4000 characters, shortest answer ${Math.min(counts.q1, counts.q2, counts.q3)}`
  };
  const moderation = moderate({ F, deductions, criteria, ctx, type, share, crit, text, ded, hard, soft, probes });
  const scores = {};
  for (const c of criteria) {
    const ds = deductions.filter((d) => d.criterion === c.id && !d.refunded);
    scores[c.id] = Math.max(0, Math.min(10, 10 - ds.reduce((a, d) => a + d.points, 0)));
  }
  const average = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / criteria.length) * 100) / 100;

  // ----- strengths (evidence only, no quota) -----
  const strengths = [];
  crit.slice(0, 3).forEach((f) => strengths.push({ text: 'Gives a view with a reason.', quote: verbatim(text, f.text), claim_id: 'C-005', tier1_ids: tier1For('C-005', ctx) }));
  const br = F.find((f) => f.bridge && f.academic);
  if (isMain && br) strengths.push({ text: 'Connects philosophy and economics.', quote: verbatim(text, br.text), claim_id: 'C-023', tier1_ids: tier1For('C-023', ctx) });
  const q3r = q3.find((f) => f.learned);
  if (q3r) strengths.push({ text: 'Reflects on what an activity taught you.', quote: verbatim(text, q3r.text), claim_id: 'C-012', tier1_ids: tier1For('C-012', ctx) });
  if (isMain && share >= 0.8) strengths.push({ text: `About ${Math.round(share * 100)}% academic content, meeting LSE's 80% guidance.`, quote: null, claim_id: 'C-003', tier1_ids: tier1For('C-003', ctx) });

  // ----- issues by importance, questions, examples -----
  const live = deductions.filter((d) => !d.refunded);
  const issues = [];
  checks.filter((c) => !c.pass).forEach((c) => issues.push({ id: `I-${c.id}`, importance: 'critical', kind: 'check', title: `Check failed: ${c.name}`, detail: c.detail, quote: (c.quotes || [])[0] || null, anchor: (c.quotes || [])[0] ? locate(text, c.quotes[0]) : null, claim_ids: c.claim_ids, tier1_ids: c.tier1_ids }));
  live.slice().sort((a, b) => b.points - a.points).forEach((d) => issues.push({ id: `I-${d.id}`, importance: d.points >= 3 ? 'high' : d.points >= 2 ? 'medium' : 'low', kind: 'deduction', deduction_id: d.id, criterion: d.criterion, title: d.reason, detail: d.selector_care, quote: d.quote, anchor: d.anchor, claim_ids: [d.claim_id], tier1_ids: d.tier1_ids, question: questionFor(d), example: EXAMPLES[d.claim_id] || null }));
  const questions = [...new Set(issues.map((i) => i.question).filter(Boolean))];

  const r = {
    id, type, created_at: createdAt, engine_version: ENGINE_VERSION, draft_path: draftPath,
    disclaimer: "These scores are this tool's reading of published admissions criteria. They are not a prediction of offers.",
    statement: type === 'main' ? ctx.config.statements.main.course + ' (main UCAS statement)' : 'Durham substitute statement: ' + ctx.config.statements.durham.course,
    char_counts: counts, academic_share: Math.round(share * 1000) / 1000,
    checks, scores, average, criteria,
    deductions, moderation, strengths, issues, questions,
    fact_checks: factChecks, advice: notes.advice, opinions: notes.opinions, limitations: notes.limitations,
    sentence_stats: { sentences: F.length, critical: crit.length, descriptive_reads: descReads.length, bridges: F.filter((f) => f.bridge).length }
  };
  r.change_since_last = diffReviews(previous, r);
  return r;
}

// ---------- moderation ----------
function moderate({ F, deductions, criteria, type, share, crit, text, ded, probes }) {
  const out = [];
  const isMain = type === 'main';
  const scoreOf = (cid) => Math.max(0, 10 - deductions.filter((d) => d.criterion === cid && !d.refunded).reduce((a, d) => a + d.points, 0));
  for (const c of criteria) {
    const before = scoreOf(c.id);
    const adj = [];
    let high = { answer: 'no', reasoning: '' };
    let low = { answer: 'no', reasoning: '' };
    const mine = () => deductions.filter((d) => d.criterion === c.id && !d.refunded);

    // TOO LOW? 1) double counting: same quote + same claim in two criteria -> refund the later one
    for (const d of mine()) {
      const twin = deductions.find((o) => o !== d && !o.refunded && o.criterion !== c.id && o.quote === d.quote && o.claim_id === d.claim_id && o.id < d.id);
      if (twin) { d.refunded = true; d.refund_reason = `Same line and same claim already penalised in ${twin.criterion} (${twin.id}).`; adj.push({ action: 'refund', deduction_id: d.id, points: +d.points, reason: d.refund_reason }); }
    }
    // 2) criterion-specific over-penalty tests
    if (c.id === 'critical_engagement' && crit.length >= 6) {
      const c16 = mine().filter((d) => d.claim_id === 'C-016');
      c16.slice(1).forEach((d) => { d.refunded = true; d.refund_reason = `${crit.length} evaluative sentences elsewhere: one unexamined reading is a minor point, not two.`; adj.push({ action: 'refund', deduction_id: d.id, points: +d.points, reason: d.refund_reason }); });
    }
    if (c.id === 'academic_focus') {
      for (const d of mine()) {
        const f = F.find((x) => d.quote && x.text.startsWith(d.quote.slice(0, 40)));
        if (f && f.subject && (f.learned || f.reflection) && d.severity !== 'minor') { d.points -= 1; d.adjusted = `Quoted line links an activity to the subject; reduced by 1.`; adj.push({ action: 'reduce', deduction_id: d.id, points: +1, reason: d.adjusted }); }
      }
    }
    const lowAdj = adj.filter((a) => a.points > 0).length;
    low = lowAdj ? { answer: 'yes', reasoning: adj.map((a) => a.reason).join(' ') + ` Probe: ${probes[c.id]}.` } : { answer: 'no', reasoning: (mine().length ? `Each of ${mine().length} deduction(s) quotes a distinct line against a confirmed tier 1 claim and none double-counts another criterion` : 'No deductions to remove') + `. Probe: ${probes[c.id]}.` };

    // TOO HIGH? look for unpenalised, sourced problems
    const now = scoreOf(c.id);
    if (c.id === 'academic_focus' && isMain && !mine().length) {
      const q1 = F.filter((f) => f.q === 'q1'); const q1n = q1.filter((f) => !f.academic);
      const q1share = q1n.reduce((a, f) => a + f.chars, 0) / (q1.reduce((a, f) => a + f.chars, 0) || 1);
      if (q1share > 0.25) { const d = ded(c.id, 'minor', q1n[0].text, 'C-003', `Overall share passes, but ${Math.round(q1share * 100)}% of Q1 is non-academic.`, 'Q1 carries the motivation; selectors read it first.'); if (d) { d.source = 'moderation'; adj.push({ action: 'add', deduction_id: d.id, points: -d.points, reason: d.reason }); } }
    }
    if (c.id === 'critical_engagement' && crit.length >= 1 && !crit.some((f) => f.ownView)) {
      const d = ded(c.id, 'minor', crit[0].text, 'C-005', 'Evaluative sentences report objections but never state your own position.', 'Selectors ask for your views specifically.'); if (d) { d.source = 'moderation'; adj.push({ action: 'add', deduction_id: d.id, points: -d.points, reason: d.reason }); }
    }
    if (c.id === 'writing_space' && !mine().length) {
      const longQ = F.filter((f) => f.text.split(/\s+/).length > 50).length;
      if (longQ) high = { answer: 'no', reasoning: `${longQ} long sentence(s) found, but no tier 1 source covers sentence length, so they are logged as opinion with no score impact.` };
    }
    const added = adj.filter((a) => a.action === 'add');
    if (added.length) high = { answer: 'yes', reasoning: added.map((a) => a.reason).join(' ') + ` Probe: ${probes[c.id]}.` };
    else if (!high.reasoning) high = { answer: 'no', reasoning: (now >= 9 ? 'No unpenalised problem that a tier 1 source supports' : `Score already reflects ${mine().length} sourced deduction(s); no further sourced problem found`) + `. Probe: ${probes[c.id]}.` };
    else high.reasoning += ` Probe: ${probes[c.id]}.`;
    out.push({ criterion: c.id, before, too_high: high, too_low: low, adjustments: adj, after: scoreOf(c.id) });
  }
  return out;
}

function questionFor(d) {
  const m = {
    'C-003': 'Which of the non-academic lines here tells a selector something about how you think about the subjects? If none, what would?',
    'C-005': 'Where in this answer do you take a side? What is your reason, and what is the best objection to it?',
    'C-004': 'Pick one idea you mention. What would someone who disagrees say, and why are they wrong or right?',
    'C-016': 'What did this reading change in your thinking? Is there a claim in it you doubt?',
    'C-024': 'What one text, study or concept has actually shaped how you see the subject?',
    'C-006': 'What is the strongest thing you can say about the weaker subject, in your own terms?',
    'C-023': 'Where does a question in one subject depend on an answer from the other?',
    'C-022': 'Which part of the degree as taught (methods, data, theory) have you already tried, and what did you find hard?',
    'C-009': 'What in the subject itself drives you, setting aside where it might lead?',
    'C-028': 'What is the first thing in the subject you would want to argue about?',
    'C-011': 'What did you learn in that subject that your grade does not show?',
    'C-027': 'Which piece of recent study prepared you most, and how?',
    'C-012': 'What did this activity change in how you think about the course?',
    'C-010': 'What new information could this space carry instead?',
    'C-014': 'If you said this aloud to a teacher, what would you actually say?',
    'C-013': 'Do these connectors add logic, or just signal it?',
    'C-015': 'Which one item on this list matters most, and why?',
    'C-001': 'Which sentence adds least? What happens if it goes?',
    'C-002': 'What is missing from this answer that the question asks for?',
    'C-007': 'How does this connect to what the degree actually teaches?',
    'C-020': 'How does this material bear on economics specifically?',
    'C-021': 'Where do you show independent thought rather than summary?',
    'C-017': 'Are you using this term in the sense the subject uses it?'
  };
  return m[d.claim_id] || null;
}

export function diffReviews(prev, cur) {
  if (!prev) return { previous_id: null, summary: 'First review of this statement; nothing to compare.' };
  const scoreDelta = Object.fromEntries(Object.keys(cur.scores).map((k) => [k, Math.round(((cur.scores[k] ?? 0) - (prev.scores?.[k] ?? 0)) * 10) / 10]));
  const key = (i) => `${i.criterion || i.id}|${(i.claim_ids || []).join(',')}|${i.title}`;
  const prevKeys = new Set((prev.issues || []).map(key));
  const curKeys = new Set(cur.issues.map(key));
  return {
    previous_id: prev.id,
    char_delta: cur.char_counts.total - (prev.char_counts?.total ?? 0),
    average_delta: Math.round((cur.average - (prev.average ?? 0)) * 100) / 100,
    score_delta: scoreDelta,
    resolved: (prev.issues || []).filter((i) => !curKeys.has(key(i))).map((i) => i.title),
    new: cur.issues.filter((i) => !prevKeys.has(key(i))).map((i) => i.title)
  };
}

// Apply a fact-check verdict. 'incorrect' adds a sourced deduction and re-scores.
export function applyFactCheck(r, ctx, { id, verdict, sourceUrl, note }) {
  const fc = r.fact_checks.find((f) => f.id === id);
  if (!fc) throw new Error(`No fact check ${id}`);
  if (!['correct', 'incorrect', 'unclear'].includes(verdict)) throw new Error('verdict must be correct|incorrect|unclear');
  if (!sourceUrl) throw new Error('A source URL is required for a fact-check verdict');
  Object.assign(fc, { status: 'checked', verdict, source_url: sourceUrl, note: note || fc.note });
  if (verdict === 'incorrect') {
    const tier1_ids = tier1For('C-017', ctx);
    const n = r.deductions.length + 1;
    const d = { id: `D${n}`, criterion: 'critical_engagement', severity: 'minor', points: 1, quote: fc.quote, anchor: null, extra_quotes: [], claim_id: 'C-017', tier1_id: tier1_ids[0], tier1_ids, reason: `Fact-check ${id}: the claim about the text or idea is wrong (${sourceUrl}).`, selector_care: 'An admissions tutor in the subject is likely to know the text.', source: 'fact-check' };
    r.deductions.push(d);
    const m = r.moderation.find((x) => x.criterion === 'critical_engagement');
    m.adjustments.push({ action: 'add', deduction_id: d.id, points: -1, reason: d.reason });
    m.too_high = { answer: 'yes', reasoning: (m.too_high.reasoning + ' ' + d.reason).trim() };
    m.after = Math.max(0, m.after - 1);
    r.scores.critical_engagement = m.after;
    r.average = Math.round((Object.values(r.scores).reduce((a, b) => a + b, 0) / Object.keys(r.scores).length) * 100) / 100;
    r.issues.push({ id: `I-${d.id}`, importance: 'low', kind: 'deduction', deduction_id: d.id, criterion: d.criterion, title: d.reason, detail: d.selector_care, quote: d.quote, anchor: null, claim_ids: ['C-017'], tier1_ids, question: 'What does the text actually say here? Check the source before you rely on it.', example: null });
  }
  return r;
}
