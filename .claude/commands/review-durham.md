---
description: Review the Durham substitute statement for Economics
argument-hint: paste the substitute draft with Q1:/Q2:/Q3: headers
---

Review the applicant's **Durham substitute statement** (Economics). Durham selectors read this **instead of** the UCAS statement (`durham-substitute`). Follow CLAUDE.md tutor limits throughout.

Draft:

$ARGUMENTS

Steps:

1. **Save verbatim.** Write the draft above, exactly as pasted, to a scratch file. Then run `node src/cli/review.mjs --type durham --input <scratch file>`. This copies it to `drafts/` and writes `reviews/<id>.json`.
2. **Read the review JSON.** For Durham, criterion 3 is "Fit with Economics" (C-020, C-022, C-007). There is no published Durham percentage, so academic focus uses C-007/C-021, not the LSE 80% rule. "No career plans in Q1" is advisory only: no tier 1 source bans it for Durham.
3. **Fact-check** every item in `fact_checks` with WebSearch/WebFetch, never from memory, and record each with `node src/cli/factcheck.mjs ...` and its source URL.
4. **Do not change scores by hand**, except with a quoted line and a confirmed tier 1 claim.
5. **Report** in the same order as /review-ps: disclaimer, counts and checks, scores with evidence, moderation, issues, strengths, fact-checks, tier 2/3 advice marked "not officially confirmed", and change since the last Durham draft.
6. Also note material that only suits Philosophy. The substitute exists because the Durham course differs from the main statement.
7. **Never** rewrite, draft or invent. Examples: at most 2 sentences, a different topic, labelled "not for use".
8. Run `npm run verify` and report any FAIL.
