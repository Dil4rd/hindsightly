# Changelog

All notable changes to Hindsightly are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com); versioning is
[SemVer](https://semver.org). Releases are cut by pushing a `vX.Y.Z` tag, which
builds and attaches the single-file artifact (see `.github/workflows/release.yml`).

## [Unreleased]

### Added

- Deeper insights — stale open tasks, projects accumulating many stale tasks,
  throughput trend (improving/declining), and per-priority completion rate.
- Light theme with a toggle (persists; defaults to the OS preference). The chart
  follows the theme.
- Plan awareness — month/quarter/year are disabled on free Todoist accounts
  (their activity log keeps only ~7 days); detected via `is_premium`.
- Actionable insights — clicking an insight opens a drawer listing the specific
  offenders (dead projects, serial postponers, stale tasks) with deep links into
  Todoist. Task titles are kept in memory only; the cache stores ids, not text.
- Reschedule debounce — multiple due-date changes on the same task within a
  window count as one (typo-correction noise); window via
  `VITE_RESCHEDULE_DEDUP_MIN` (default 10 min).

### Changed

- Trend chart is now a grouped bar histogram (opened vs. closed per day/week)
  with y-axis headroom so the tallest bar isn't clipped.
- Docker is the primary dev workflow (`compose.yaml`: `docker compose up dev`).

### Fixed

- Per-priority completion is now a true cohort rate (tasks created in the window
  that are now completed), bounded 0–100% — was closed÷opened, which mixed
  cohorts and could read absurd values like 1850%.
- Stale-tasks insight no longer flags recurring tasks or future-scheduled tasks
  (they're alive/planned, not stuck). Manual postpones of recurring tasks are
  still counted by the serial-postponer insight (marked "recurring").

- Weekend shading now aligns with each day's bars (was offset half a day, which
  also mislabeled the hovered day).
- Removed chart drag-to-zoom (unclear as navigation).

## [0.1.0] - 2026-06-29

Initial release.

### Added

- Passkey (WebAuthn PRF) auth — Todoist token encrypted at rest, no backend,
  multi-credential enrollment.
- Single-file static build (Vite + `vite-plugin-singlefile`) with a strict,
  build-time CSP; Docker build and deployment guide.
- Todoist API v1 client — projects, completed items (chunked under the 3-month
  range cap), activity log (cursor pagination, 200/page).
- Stats engine — opened, closed, postponed, rescheduled, scheduled,
  unscheduled, reprioritized, and mean time to complete.
- Filters — time window (week / month / quarter / year), project subtree,
  priority.
- Dashboard — stat cards with hover tooltips and a uPlot opened-vs-closed trend
  (weekend shading, day/week buckets, hover readout, integer axis).
- Insight layer — interpretive read of the four retro questions (right tasks,
  project structure, prioritization, execution).
- Recurring-task handling — `recurringClosed` shown as a subset of closed.
- Encrypted, per-account IndexedDB cache — hydrate on reload + incremental
  top-up; range switches don't refetch.
- Deployment — Vercel (push to `main`) at hindsightly.vercel.app; release-on-tag
  GitHub workflow that builds and attaches the single-file artifact.
- Logo + favicon.

[Unreleased]: https://github.com/Dil4rd/hindsightly/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Dil4rd/hindsightly/releases/tag/v0.1.0
