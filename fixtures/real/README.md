# Real-outcome fixtures

Real statements with known outcomes, used to test the reviewer against what selectors actually did.
The synthetic fixtures in `fixtures/` were written alongside the reviewer, so they cannot show whether it is accurate. These can.

For each statement add two files with the same name:

- `<name>.txt`: the statement with `Q1:` / `Q2:` / `Q3:` headers. **Git-ignored**: it is someone else's private writing.
  Never publish it: a public copy can also trip UCAS similarity checks for anyone who later reads it.
- `<name>.json`: committed metadata:

```json
{ "type": "main", "outcome": "offer", "universities": ["LSE"], "course": "BSc Philosophy and Economics",
  "entry_year": 2026, "consent": true, "note": "who supplied it, with permission" }
```

Rules used by `npm run verify` (check 9):
- An `offer` from the priority choice (LSE for `main`, Durham for `durham`) is expected to score in the strong band (average >= 8.5, the same bar as the strong synthetic fixture).
  If it does not, the reviewer is wrong: fix the reviewer, never this bar or the statement.
- Other outcomes are reported, not judged: offers and rejections depend on grades, tests, interviews and competition too.
- A fixture without `"consent": true` is skipped.
