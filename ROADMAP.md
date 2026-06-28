# Roadmap

Hindsight — a retrospective instrument for a Todoist-based GTD practice:
"did it work out, and what should I adjust?"

## Done

- [x] Passkey (WebAuthn PRF) security core — token encrypted at rest, no backend
- [x] Single-file build + strict CSP; Docker build + deployment guide
- [x] Todoist data layer (projects, completed, activity log; cursor pagination)
- [x] Stats engine — opened / closed / postponed / rescheduled / scheduled /
      unscheduled / reprioritized + mean time to complete
- [x] Filters: time window, project subtree, priority
- [x] Dashboard: stat cards + uPlot trend (weekend shading, weekly buckets)
- [x] Recurring-task handling (`recurringClosed` subset)
- [x] Release-on-tag workflow
- [x] Performance: 200/page + encrypted, per-account IndexedDB cache
      (hydrate + incremental top-up)
- [x] Branding: logo + favicon

## Next — the insight layer

Interpret the raw signals against the four retro questions:

- [ ] Tracking the *right* tasks? — serial postponers, never-closed/stale tasks
- [ ] Project structure sane? — dead projects, over-stuffed projects, depth vs. use
- [ ] Prioritizing correctly? — completion rate & MTTC by priority, priority churn
- [ ] Executing correctly? — opened-vs-closed balance, postponement rate, trends

## Later

- [ ] Recurring tasks: optional toggle to include/exclude recurring completions
- [ ] Longer windows: chunk the completed endpoint past its ~3-month range cap
- [ ] Custom date ranges (beyond week/month/quarter/year presets)
- [ ] Export / share a snapshot (CSV or image)

## Distant / someday

- [ ] **Multi-account** — hold more than one Todoist account at once (today the
      vault stores a single token; switching accounts needs Reset + re-enroll).
      Would require a per-account vault and an account switcher in the UI.
