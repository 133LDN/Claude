import React, { useMemo, useState } from 'react';
import data from './data.json';

const CRIT_ORDER = ['academic_focus', 'critical_engagement', 'subject_balance', 'degree_fit', 'question_content', 'writing_space'];
const IMPORTANCE = { critical: 'bg-red-600 text-white', high: 'bg-orange-500 text-white', medium: 'bg-amber-300 text-stone-900', low: 'bg-stone-300 text-stone-900 dark:bg-stone-700 dark:text-stone-100' };
const card = 'rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900';

function Disclaimer() {
  return (
    <p className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      Scores are this tool's reading of published admissions criteria. They are not a prediction of offers.
    </p>
  );
}

function ScoreBar({ v }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 rounded bg-stone-200 dark:bg-stone-800"><div className="h-2 rounded bg-teal-600" style={{ width: `${v * 10}%` }} /></div>
      <span className="tabular-nums text-sm">{v}</span>
    </div>
  );
}

function Latest({ r }) {
  if (!r) return <div className={card}>No reviews yet. Paste a draft with <code>/review-ps</code> or <code>/review-durham</code>. Calibration reviews are on the Calibration tab.</div>;
  const name = (id) => r.criteria.find((c) => c.id === id)?.name || id;
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{r.statement}</h2>
          <span className="text-sm text-stone-500">{r.id} · {r.created_at?.slice(0, 16).replace('T', ' ')}</span>
        </div>
        <p className="mt-1 text-sm">Characters: Q1 {r.char_counts.q1} · Q2 {r.char_counts.q2} · Q3 {r.char_counts.q3} · total {r.char_counts.total}/4000 · academic share {Math.round(r.academic_share * 100)}%</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">Average {r.average}</p>
      </div>
      <div className={card}>
        <h3 className="mb-2 font-semibold">Checks</h3>
        <ul className="space-y-1 text-sm">{r.checks.map((c) => <li key={c.id}><span className={`mr-2 rounded px-1.5 text-xs font-bold ${c.pass ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'}`}>{c.pass ? 'PASS' : 'FAIL'}</span>{c.name}: <span className="text-stone-600 dark:text-stone-400">{c.detail}</span>{c.advisory && <em> (advisory)</em>}</li>)}</ul>
      </div>
      <div className={card}>
        <h3 className="mb-2 font-semibold">Scores, evidence and moderation</h3>
        {CRIT_ORDER.map((cid) => {
          const m = r.moderation.find((x) => x.criterion === cid);
          const ds = r.deductions.filter((d) => d.criterion === cid);
          return (
            <details key={cid} className="border-t border-stone-200 py-2 dark:border-stone-800">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span>{name(cid)}</span><ScoreBar v={r.scores[cid]} /></summary>
              <ul className="mt-2 space-y-2 text-sm">
                {ds.length === 0 && <li className="text-stone-500">No sourced deductions.</li>}
                {ds.map((d) => (
                  <li key={d.id} className={d.refunded ? 'line-through opacity-60' : ''}>
                    <b>−{d.points}</b> ({d.severity}) {d.reason} <span className="text-stone-500">[{d.claim_id} · {d.tier1_ids.join(', ')}]</span>
                    <blockquote className="mt-1 border-l-2 border-teal-600 pl-2 italic">"{d.quote}"</blockquote>
                    {d.refunded && <span className="not-italic"> Refunded: {d.refund_reason}</span>}
                  </li>
                ))}
                <li className="rounded bg-stone-100 p-2 dark:bg-stone-800">
                  <div><b>Too high?</b> {m.too_high.answer}. {m.too_high.reasoning}</div>
                  <div><b>Too low?</b> {m.too_low.answer}. {m.too_low.reasoning}</div>
                  <div>Before {m.before} → after {m.after}</div>
                </li>
              </ul>
            </details>
          );
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h3 className="mb-2 font-semibold">Issues by importance</h3>
          <ol className="space-y-2 text-sm">{r.issues.map((i) => <li key={i.id}><span className={`mr-2 rounded px-1.5 text-xs ${IMPORTANCE[i.importance]}`}>{i.importance}</span>{i.title}{i.anchor && <span className="text-stone-500"> (line {i.anchor.line})</span>}{i.example && <div className="mt-1 rounded border border-dashed border-stone-400 p-1 text-xs"><b>Example, {i.example.label}</b> ({i.example.topic}): {i.example.text}</div>}</li>)}</ol>
        </div>
        <div className="space-y-4">
          <div className={card}><h3 className="mb-2 font-semibold">Strengths</h3><ul className="space-y-1 text-sm">{r.strengths.length ? r.strengths.map((s, k) => <li key={k}>{s.text}{s.quote && <span className="italic"> "{s.quote}"</span>} <span className="text-stone-500">[{s.claim_id}]</span></li>) : <li className="text-stone-500">None with evidence.</li>}</ul></div>
          <div className={card}><h3 className="mb-2 font-semibold">Questions for you</h3><ul className="list-disc space-y-1 pl-5 text-sm">{r.questions.map((q, k) => <li key={k}>{q}</li>)}</ul></div>
          <div className={card}><h3 className="mb-2 font-semibold">Fact-checks</h3><ul className="space-y-1 text-sm">{r.fact_checks.map((f) => <li key={f.id}><b>{f.id}</b> {f.status}{f.verdict ? ` · ${f.verdict}` : ''}: <span className="italic">"{f.quote}"</span>{f.source_url && <a className="ml-1 text-teal-700 underline" href={f.source_url}>source</a>}</li>)}</ul></div>
          <div className={card}><h3 className="mb-2 font-semibold">Advice (no score impact)</h3><ul className="space-y-1 text-sm">{r.advice.map((a, k) => <li key={k}>Tier {a.tier} · {a.status}: {a.text}</li>)}{r.opinions.map((o, k) => <li key={'o' + k}>{o.text}</li>)}{r.limitations.map((l, k) => <li key={'l' + k} className="text-stone-500">{l}</li>)}</ul></div>
          <div className={card}><h3 className="mb-2 font-semibold">Change since last draft</h3><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(r.change_since_last, null, 1)}</pre></div>
        </div>
      </div>
    </div>
  );
}

function Draft({ r }) {
  if (!r || !r.draft_text) return <div className={card}>No draft to show.</div>;
  const lines = r.draft_text.split('\n');
  const marks = r.issues.filter((i) => i.anchor && i.anchor.offset != null);
  let off = 0;
  return (
    <div className={card + ' overflow-x-auto'}>
      <p className="mb-2 text-sm text-stone-500">Draft saved verbatim at {r.draft_path}. Highlighted text is quoted by an issue; the issue is listed under the line.</p>
      <div className="font-mono text-sm">
        {lines.map((line, n) => {
          const start = off; const end = off + line.length; off = end + 1;
          const here = marks.filter((m) => m.anchor.offset < end && m.anchor.offset + m.anchor.length > start);
          const segs = []; let cur = 0;
          const ranges = here.map((m) => [Math.max(0, m.anchor.offset - start), Math.min(line.length, m.anchor.offset + m.anchor.length - start)]).sort((a, b) => a[0] - b[0]);
          for (const [a, b] of ranges) { if (a > cur) segs.push([line.slice(cur, a), false]); if (b > Math.max(a, cur)) segs.push([line.slice(Math.max(a, cur), b), true]); cur = Math.max(cur, b); }
          if (cur < line.length) segs.push([line.slice(cur), false]);
          return (
            <div key={n} className="grid grid-cols-[3rem_1fr] gap-2">
              <span className="select-none text-right text-stone-400">{n + 1}</span>
              <div>
                <span className="whitespace-pre-wrap">{segs.map(([t, h], k) => h ? <mark key={k} className="bg-amber-200 dark:bg-amber-800 dark:text-stone-100">{t}</mark> : <span key={k}>{t}</span>)}</span>
                {here.filter((m) => m.anchor.line === n + 1).map((m) => <div key={m.id} className="font-sans text-xs text-orange-700 dark:text-orange-300">↳ [{m.importance}] {m.title}</div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function History({ reviews }) {
  if (!reviews.length) return <div className={card}>No reviews yet.</div>;
  return (
    <div className={card + ' overflow-x-auto'}>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="pr-3">Review</th><th className="pr-3">Type</th>{CRIT_ORDER.map((c) => <th key={c} className="pr-3">{c.replace('_', ' ')}</th>)}<th>Avg</th><th>Chars</th></tr></thead>
        <tbody>{reviews.map((r) => <tr key={r.id} className="border-t border-stone-200 dark:border-stone-800"><td className="pr-3">{r.id}</td><td className="pr-3">{r.type}</td>{CRIT_ORDER.map((c) => <td key={c} className="pr-3 tabular-nums">{r.scores[c]}</td>)}<td className="font-semibold tabular-nums">{r.average}</td><td className="tabular-nums">{r.char_counts.total}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Sources() {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{data.capture_note}</p>
      <div className={card + ' overflow-x-auto'}>
        <h3 className="mb-2 font-semibold">Sources</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="pr-2">Tier</th><th className="pr-2">Status</th><th className="pr-2">Id</th><th>Title, governs, extracts</th></tr></thead>
          <tbody>{data.sources.map((s) => (
            <tr key={s.id} className="border-t border-stone-200 align-top dark:border-stone-800">
              <td className="pr-2">T{s.tier}</td>
              <td className={`pr-2 ${s.status === 'missing' ? 'text-red-600' : ''}`}>{s.status}{s.fetch_method ? ` (${s.fetch_method})` : ''}</td>
              <td className="pr-2 font-mono text-xs">{s.id}</td>
              <td>
                {s.url ? <a className="text-teal-700 underline dark:text-teal-400" href={s.url}>{s.title}</a> : s.title} <span className="text-stone-500">· {s.date_captured}</span>
                {s.governs && <div className="text-xs">Governs: {s.governs}</div>}
                {s.missing_reason && <div className="text-xs text-red-600">{s.missing_reason}</div>}
                {s.notes && <div className="text-xs text-stone-500">{s.notes}</div>}
                {s.extracts?.length > 0 && <details className="text-xs"><summary className="cursor-pointer">{s.extracts.length} extract(s)</summary><ul className="list-disc pl-5">{s.extracts.map((e, k) => <li key={k}>{e}</li>)}</ul></details>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className={card + ' overflow-x-auto'}>
        <h3 className="mb-2 font-semibold">Cross-checked claims</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="pr-2">Id</th><th className="pr-2">Label</th><th className="pr-2">Origin</th><th className="pr-2">Use</th><th>Claim</th></tr></thead>
          <tbody>{data.claims.map((c) => (
            <tr key={c.id} className="border-t border-stone-200 align-top dark:border-stone-800">
              <td className="pr-2 font-mono text-xs">{c.id}</td>
              <td className={`pr-2 ${c.label === 'contradicted' ? 'text-red-600' : c.label === 'unconfirmed' ? 'text-amber-600' : 'text-teal-700 dark:text-teal-400'}`}>{c.label}</td>
              <td className="pr-2">T{c.origin_tier} {c.origin}</td>
              <td className="pr-2">{c.use}</td>
              <td>{c.text}{c.label === 'unconfirmed' && <em> Not officially confirmed.</em>} <span className="text-xs text-stone-500">[{(c.tier1_ids || []).join(', ')}]</span>{c.disagreement && <div className="text-xs">Tier 1 disagreement: {c.disagreement.detail} {c.disagreement.governs}</div>}{c.note && <div className="text-xs text-stone-500">{c.note}</div>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('latest');
  const [pick, setPick] = useState(null);
  const latest = data.reviews[data.reviews.length - 1] || null;
  const current = useMemo(() => (pick ? [...data.reviews, ...data.calibration].find((r) => r.id === pick) : latest), [pick, latest]);
  const tabs = [['latest', 'Review'], ['draft', 'Draft'], ['history', 'Score history'], ['sources', 'Sources'], ['calibration', 'Calibration']];
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Personal statement tutor <span className="text-sm font-normal text-stone-500">read-only</span></h1>
        <Disclaimer />
        <nav className="flex flex-wrap gap-2">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded px-3 py-1 text-sm ${tab === k ? 'bg-teal-700 text-white' : 'bg-stone-200 dark:bg-stone-800'}`}>{l}</button>)}</nav>
        {current && <p className="text-xs text-stone-500">Showing: {current.id}{pick && <button className="ml-2 underline" onClick={() => setPick(null)}>back to latest</button>}</p>}
      </header>
      {tab === 'latest' && <Latest r={current} />}
      {tab === 'draft' && <Draft r={current} />}
      {tab === 'history' && <History reviews={data.reviews} />}
      {tab === 'sources' && <Sources />}
      {tab === 'calibration' && (
        <div className={card}>
          <p className="mb-2 text-sm">Synthetic fixtures reviewed by the same engine. Required: strong ≥ 8.5, weak ≤ 4.5, middling 1.5+ from both.</p>
          <ul className="space-y-1 text-sm">{data.calibration.map((r) => <li key={r.id}><button className="underline" onClick={() => { setPick(r.id); setTab('latest'); }}>{r.calibration_fixture}</button>: average {r.average}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
