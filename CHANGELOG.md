# Changelog

All notable changes to Hindsightly are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com); versioning is
[SemVer](https://semver.org). Releases are cut by pushing a `vX.Y.Z` tag, which
builds and attaches the single-file artifact (see `.github/workflows/release.yml`).

## [Unreleased]

### Added

- Daily overview — a new **day** preset (calendar today, local midnight → now)
  as an end-of-day reflection. Statistical insights that starve on one day of
  data (trends, per-priority rates, staleness, structure) are hidden; instead
  the day view shows: **plan kept** (of tasks due today: done / pushed / still
  open, with the unresolved ones listed), **pushed forward** (everything moved
  to a later day, with its new date — the mirror of the done list), and
  **typical day** (today's closes vs your median daily closes over the recent
  history, so the count has a personal baseline). Metric cards + drilldowns,
  backlog balance, overdue-now, and waiting-for aging remain. The trend chart is
  hidden (two bars aren't a trend). Works on free accounts (second ungated
  preset besides week).

- Waiting-for aging insight — open tasks tagged as a GTD "waiting-for"
  (delegated / blocked / awaiting a reply) that have been pending over 14 days,
  listed oldest-first to chase or drop. The card stays dormant until a task
  carries a selected label. Labels are held in memory only — never written to
  the encrypted cache.
- Waiting-for label picker — a top-bar control to choose which of your Todoist
  labels mean "waiting-for" (multi-select of your account's labels), so there's
  no env var to set or page to rebuild. The choice is stored encrypted per
  account (a new IndexedDB `settings` store, AES-GCM under the passkey-derived
  key; only opaque label ids at rest). Nothing is pre-selected — the waiting-for
  insight is off until you pick at least one label.

### Changed

- Tasks tagged as a waiting-for are now excluded from the stale-open-tasks and
  serial-postponer signals — a labelled waiting-for is parked on purpose, so
  re-nudging it no longer reads as avoidance.

## [0.2.0] - 2026-07-13

### Added

- Deeper insights — stale open tasks, projects accumulating many stale tasks,
  throughput trend (improving/declining), a per-priority speed gradient (mean
  time to complete, P1→P4), and per-priority reliability (share of work due in
  the period that you complete).
- On-time completion by priority — of dated completions, the share finished by
  their due date (via `was_overdue`), P1 vs P4.
- Overdue open tasks — currently past-due open tasks (distinct from stale =
  old + unscheduled), listed oldest-first with days overdue and Todoist links.
- Light theme with a toggle (persists; defaults to the OS preference). The chart
  follows the theme.
- Plan awareness — month/quarter/year are disabled on free Todoist accounts
  (their activity log keeps only ~7 days); detected via `is_premium`.
- Actionable insights — clicking an insight opens a drawer listing the specific
  offenders (dead projects, serial postponers, stale tasks) with deep links into
  Todoist. Task titles are kept in memory only; the cache stores ids, not text.
- Clickable metric cards — clicking a count (opened, closed, postponed, …; not
  mean-time-to-complete) opens a drawer of the underlying tasks, deduped one row
  per task with its frequency + date span (`3× · Jul 7–11`), most-frequent
  first, with Todoist deep links.
- Reschedule debounce — multiple due-date changes on the same task within a
  window count as one (typo-correction noise); window via
  `VITE_RESCHEDULE_DEDUP_MIN` (default 10 min).
- Insight methodology docs (`docs/INSIGHTS.md`) — one card per insight covering
  what it measures, what it ignores, the data source, and caveats. Each insight
  in the app links (ⓘ) to its section.

### Changed

- Insights now lead the dashboard; the stat cards + trend chart moved into a
  collapsible "Metrics" section below (expanded by default).
- Dropped the passkey-label field on first run — it's auto-labelled now (the
  label is only the authenticator's display name), which also stops password
  managers autofilling that text box.
- Project filter moved from the left sidebar into a dropdown in the top filter
  row (its label shows the selected project + subproject count; opens/closes on
  click, closes on selection), reclaiming full width for the content. Selecting a
  project scopes the insights to that subtree; the whole-system "structure"
  insights show a note while a project is in focus.
- Trend chart is now a grouped bar histogram (opened vs. closed per day/week)
  with y-axis headroom so the tallest bar isn't clipped.
- Docker is the primary dev workflow (`compose.yaml`: `docker compose up dev`).

### Fixed

- Light theme now applies to text inputs (they were hardcoded dark, so the
  first-run token field stayed black in light mode).
- Trend-chart hover no longer shows a meaningless `00:00 UTC` for day buckets.
- Per-priority completion reworked into a bounded reliability rate: of work
  *due* in the period, the share completed (credits earlier-created and recurring
  completions; tasks postponed out of the period still count as not done). Earlier
  closed÷opened could read absurd values like 1850%.
- Stale-tasks insight no longer flags recurring tasks or future-scheduled tasks
  (they're alive/planned, not stuck). Manual postpones of recurring tasks are
  still counted by the serial-postponer insight (marked "recurring").

- Chart x-axis gridlines now sit at day/week boundaries (between bar groups), so
  each label sits centered in its slot instead of directly under a line that cut
  through the middle of the group.
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

[Unreleased]: https://github.com/Dil4rd/hindsightly/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Dil4rd/hindsightly/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Dil4rd/hindsightly/releases/tag/v0.1.0
