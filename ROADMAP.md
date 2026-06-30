# Roadmap

Forward-looking only — shipped work lives in [CHANGELOG.md](./CHANGELOG.md).

Hindsightly is a retrospective instrument for a Todoist-based GTD practice:
"did it work out, and what should I adjust?" Items below earn their place by
serving that goal; this list is curated, not a backlog dump.

## Next

- [ ] **Worked examples in [docs/INSIGHTS.md](./docs/INSIGHTS.md)** — short,
      ideally visual "this data → this value, and note it misses X" snippets.
      Possibly cross-insight (one scenario illustrating several at once). Decide
      the format before writing.
- [ ] **Workload balance across P1–P4** — flag a skewed priority mix (e.g. 90%
      P1, or no P3s). Distinct from the existing speed/reliability insights.

## Later

- [ ] **Recurring toggle** — let the user include or exclude recurring completions
      from `closed`.
- [ ] **Project turnover insight** — projects created vs archived per window, as a
      repeatable-workflow signal. (Todoist exposes no readable *template* data —
      the template API is write-only, with no list and no per-project origin — so
      turnover is the closest feasible proxy, not "template usage".)

## Distant / someday

- [ ] **Multi-account** — hold more than one Todoist account at once. Today the
      vault stores a single token; switching accounts needs Reset + re-enroll.
      Needs a per-account vault and an account switcher.
