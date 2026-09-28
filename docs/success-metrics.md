# Personal Analytics — Personal Success Metrics (V1)

_Last updated: 2026-09-29_

These metrics answer the question: **"Did V1 prove the core loop is worth continuing?"**  
They are evaluated at the end of the two-week personal-use test before any Milestone 2 work begins.

---

## Primary gate metrics (all must pass to proceed to Milestone 2)

| # | Metric | Target | How measured |
|---|--------|--------|--------------|
| G1 | **Days logged per week** | ≥ 5 out of 7 | Count of `DailyLog` rows with ≥ 1 task or metric in any given week |
| G2 | **Consecutive weeks of use** | 2 complete weeks | Both week 1 and week 2 individually pass G1 |
| G3 | **Offline load** | App loads fully offline after first visit | Open DevTools → Network → Offline; hard-reload; page renders |
| G4 | **Data survives reload** | All tasks and metrics persist after browser restart | Close browser, reopen, navigate to Today — same data present |
| G5 | **Task math correctness** | 3 of 6 tasks = 50 %; 3 of 10 problems = 30 % | Manual check on a real logged day |

---

## Secondary quality metrics (inform V2 decisions, not a hard gate)

| # | Metric | Target | Notes |
|---|--------|--------|-------|
| Q1 | **Dashboard useful** | Spotted ≥ 1 real pattern | Subjective; record in `context.md` what the pattern was |
| Q2 | **Today page friction** | Daily log takes < 2 min | Timed on a normal day; if > 2 min, note what slowed you down |
| Q3 | **Backup round-trip** | Export → import → same data | Tested once per week manually |
| Q4 | **Streak calendar accurate** | Matches your memory of days worked | Spot-check 5 random days in the calendar view |
| Q5 | **No silent data loss** | Zero `undefined` or `NaN` in any chart | Visual scan of dashboard; no unexplained gaps for logged days |

---

## Failure modes that auto-block Milestone 2

If any of these occur, fix it before proceeding — regardless of the gate metrics:

- Any plaintext personal data transmitted to a server
- Task completion % or target progress % calculated incorrectly (off by > 0 %)
- App crashes on offline reload (service worker failure)
- Encrypted backup cannot be re-imported after export

---

## How to record results

At the end of the two-week test, append a section to `context.md`:

```markdown
### YYYY-MM-DD — Two-week test results

| Metric | Target | Result | Pass? |
|--------|--------|--------|-------|
| G1 Week 1 | ≥ 5 days | X days | ✅ / ❌ |
| G1 Week 2 | ≥ 5 days | X days | ✅ / ❌ |
...

**Decision:** Go / No-go for Milestone 2.
**Notes:** [what worked, what didn't, what to improve]
```

---

## Non-metrics (do not evaluate these in the gate)

- Speed benchmarks or Lighthouse scores — premature optimisation
- Number of features — more features ≠ more value
- Any server-side metric — V1 has no personal-data backend
