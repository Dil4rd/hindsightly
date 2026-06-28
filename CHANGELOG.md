# Changelog

All notable changes to Hindsight are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com); versioning is
[SemVer](https://semver.org). Releases are cut by pushing a `vX.Y.Z` tag, which
builds and attaches the single-file artifact (see `.github/workflows/release.yml`).

## [Unreleased]

## [0.1.0] - 2026-06-28

Initial release.

### Added

- Passkey (WebAuthn PRF) auth — Todoist token encrypted at rest, no backend,
  multi-credential enrollment.
- Single-file static build (Vite + `vite-plugin-singlefile`) with a strict,
  build-time CSP; Docker build and deployment guide.
- Todoist API v1 client — projects, completed items, activity log (cursor
  pagination, 200/page).
- Stats engine — opened, closed, postponed, rescheduled, scheduled,
  unscheduled, reprioritized, and mean time to complete.
- Filters — time window (week / month / quarter / year), project subtree,
  priority.
- Dashboard — stat cards with hover tooltips and a uPlot opened-vs-closed trend
  (weekend shading, day/week buckets, hover readout, integer axis).
- Recurring-task handling — `recurringClosed` shown as a subset of closed.
- Encrypted, per-account IndexedDB cache — hydrate on reload + incremental
  top-up; range switches don't refetch.
- Release-on-tag GitHub workflow.
- Logo + favicon.

[Unreleased]: https://example.com/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/releases/tag/v0.1.0
