---
description: Refetch the official guidance, show a diff, and replace the store only after confirmation
---

The guidance store in `guidance/` is fetched once and reused. This command is the only way to refresh it.

1. Copy `guidance/sources.json` to `guidance/sources.next.json`.
2. For each source in it, try a **full fetch** of its URL with WebFetch. Ask for verbatim extracts only, no paraphrase. If a fetch fails, try WebSearch restricted to that domain for quoted text.
   - Full page fetched: set `fetch_method: "full_fetch"`, update `extracts`, `date_captured`, `notes`.
   - Only search extracts available: keep `fetch_method: "web_search_extract"`.
   - Neither: set `status: "missing"` with a `missing_reason` that names the failure (e.g. "network policy blocked host").
   - Nothing from memory.
3. Add any new tier 1 pages the applicant's choices need, and tier 2/3 sources if found, each with tier and a stable id.
4. Run `node scripts/refresh-guidance.mjs` to print the diff (added, removed, changed sources and extracts). **Show the diff to the applicant and stop for confirmation.**
5. Only after a clear yes, run `node scripts/refresh-guidance.mjs --apply`. This backs up the old store to `guidance/history/`.
6. Re-cross-check `guidance/claims.json` against the new extracts. Relabel any claim whose tier 1 support changed (confirmed / unconfirmed / contradicted). Contradicted claims are dropped and stay in the log. Tier 1 disagreements stay, with `governs` set.
7. Run `npm run verify`. If calibration moves, fix the reviewer, never the thresholds.
