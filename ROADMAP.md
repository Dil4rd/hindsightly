# Roadmap

Forward-looking only — shipped work lives in [CHANGELOG.md](./CHANGELOG.md).

Hindsight is a retrospective instrument for a Todoist-based GTD practice:
"did it work out, and what should I adjust?" Items below earn their place by
serving that goal; this list is curated, not a backlog dump.

## Next — the insight layer

Turn the raw metrics into answers to the four retro questions:

- [ ] Tracking the *right* tasks? — serial postponers, never-closed / stale tasks
- [ ] Project structure sane? — dead projects, over-stuffed projects, depth vs. use
- [ ] Prioritizing correctly? — completion rate & MTTC by priority, priority churn
- [ ] Executing correctly? — opened-vs-closed balance, postponement rate, trends

## Later

- [ ] **MTTC over long windows** (correctness) — the completed endpoint caps each
      request at ~3 months, so quarter/year mean-time-to-complete is currently
      truncated; chunk the range to cover it fully.
- [ ] **Recurring toggle** — let the user include or exclude recurring completions
      from `closed`.

## Distant / someday

- [ ] **Multi-account** — hold more than one Todoist account at once. Today the
      vault stores a single token; switching accounts needs Reset + re-enroll.
      Needs a per-account vault and an account switcher.
