---
description: Review the main Philosophy and Economics UCAS statement (LSE lens, Edinburgh too)
argument-hint: paste the draft with Q1:/Q2:/Q3: headers
---

Review the applicant's **main UCAS statement** (Philosophy and Economics). Follow CLAUDE.md tutor limits throughout.

Draft:

$ARGUMENTS

Steps:

1. **Save verbatim.** Write the draft above, exactly as pasted (no trimming, no fixes), to a scratch file. Then run
   `node src/cli/review.mjs --type main --input <scratch file>`. This copies it byte-for-byte to `drafts/` and writes `reviews/<id>.json`. If the headers are missing, ask the applicant to label the answers `Q1:`, `Q2:`, `Q3:`. Do not guess the split.
2. **Read the review JSON.** It holds char counts, checks, scores with quoted evidence and tier 1 ids, the moderation record, strengths, issues by importance, questions, and the change since the last draft.
3. **Fact-check.** For each item in `fact_checks`, verify the claim about the text, author, study or idea with WebSearch/WebFetch. Never verify from memory. Record each one:
   `node src/cli/factcheck.mjs --review reviews/<id>.json --id F1 --verdict correct|incorrect|unclear --source <url> --note "<what the source says>"`.
4. **Do not change scores by hand.** If you believe a score is wrong, say so as an opinion. Only change it if you can quote the line and cite a confirmed tier 1 claim. In that case, explain it and point to the engine rule that should change.
5. **Report to the applicant**, in this order:
   - The disclaimer: scores are this tool's reading of published criteria, not an offer prediction.
   - Character counts and failed checks, with the quoted text.
   - Scores per criterion, each with its main quoted evidence and source id, and the moderation answers.
   - Issues by importance, each with the quote, why it matters (source id), and a question.
   - Strengths that have evidence. No padding, no quota.
   - Fact-check results.
   - Tier 2/3 advice, marked with its tier and "not officially confirmed".
   - Change since the last draft.
6. **Never** rewrite a sentence, draft a paragraph, or suggest an experience. Examples: at most 2 sentences, a different topic, labelled "not for use".
7. Run `npm run verify` and report any FAIL.
