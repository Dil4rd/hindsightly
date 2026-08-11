# AGENTS.md

Single source of truth for agents working in this repo: rules first, then the
knowledge a cold-start session needs. Claude Code auto-loads this via the
`@AGENTS.md` import in [CLAUDE.md](./CLAUDE.md); other tools read it directly.

## What this is

**Hindsightly** — a self-contained, single-HTML-file, privacy-first
retrospective dashboard for a Todoist-based GTD practice: "did it work out,
what should I adjust?". It answers four questions — are you tracking the
right tasks? does your project structure make sense? are you prioritizing
well? are you executing well? Raw metrics are the signal layer; the *insight*
layer interprets them. No backend; token encrypted with a passkey; task text
never at rest. New features earn their place by serving the retro goal.

Stack (locked): Svelte 5 (runes), Vite 6 + `vite-plugin-singlefile` (+ strict
build-time CSP via `build/csp-plugin.ts`), TypeScript, uPlot, date-fns,
Vitest, Node 22. Docker is the primary dev workflow.

## Commands

- `docker compose up dev` — primary dev workflow (Vite dev server)
- `npm run check` — svelte-check + tsc; must be 0 errors AND 0 warnings
- `npm test` — Vitest suite
- `npm run build` — single-file `dist/index.html` (vite-plugin-singlefile)

All three must pass before every commit.

## Privacy — hard rules

- Task names/content and label names must NEVER leave the browser or be
  persisted. Not in the encrypted cache, not in logs, not in assistant/probe
  output, not in any network call except the browser→Todoist API itself.
  Only task/project/label **ids and dates/timelines** are OK outside RAM.
- Anything persisted goes through the `strip*` functions in
  `src/lib/todoist/cache.ts` (titles AND `labels[]` zeroed) and is AES-GCM
  encrypted under the passkey-derived key. Same for `settings.ts` (label ids
  only, never names).
- When debugging against the live API (a token may be available in `.env`),
  print counts/ids/dates only — never task content.
- Stay inside this repo folder.

## Invariants (each one exists because of a real bug)

- Task titles resolve ONLY through `taskNameIndex` (`src/lib/stats/names.ts`).
  Never read `extra_data.content` directly in UI code — the cache is name-free,
  so names silently vanish after a reload.
- Every `Insight` carries a `docId` matching a heading slug in
  `docs/INSIGHTS.md`; the KNOWN set in `tests/insights.test.ts` enforces it.
  A new insight ships with its methodology card (Measures / Ignores / Source /
  Caveats) in the same commit.
- Colors come from CSS vars in `src/app.css` (`:root` dark +
  `:root[data-theme="light"]`). No hardcoded colors in components — hardcoded
  dark values have twice shipped invisible-in-light-theme bugs.
- Drawer/list `{#each}` blocks over per-event items must NOT key by task id —
  ids repeat across events and Svelte 5 throws on duplicate keys. Key by index.
- uPlot axis `incrs`/`scale.time` are baked at construction: rebuild the chart
  on granularity change, `setData` is not enough.
- `metricBreakdown` and `computeMetrics` must share the same suppression path
  or drawer contents diverge from card counts (a test locks this).
- Todoist priorities are internal scale: **4 = P1 (highest), 1 = P4**.
- Todoist API is unified v1 (`/api/v1/...`), cursor pagination; the completed
  endpoint rejects ranges > ~3 months (chunked in `client.ts`); free accounts
  keep only ~7 days of activity (`is_premium` gates long presets).

## Workflow

- `main` is protected. Work on `dev`; one PR `dev`→`main` per release; a
  `vX.Y.Z` tag fires the release workflow (single-file artifact). A
  self-authored PR cannot be merged by the agent — merging is the user's call.
- Commit at the end of each stage of work; short commit messages; push to
  `dev` after each commit so the user can verify.
- User-facing changes go to `CHANGELOG.md` under `[Unreleased]`
  (Keep-a-Changelog). Parked/vetted ideas go to `ROADMAP.md` — it is curated,
  not a backlog dump; record probe-confirmed feasibility notes with each item.
- Ship checklist for any feature: code + tests + INSIGHTS.md card (if a new
  insight) + CHANGELOG `[Unreleased]` + refresh of this file (see maintenance
  note below) + commit per stage, push to `dev`.

## Current state (2026-08-11)

> **Maintenance (agents): keep this file true.** At the end of each work
> iteration, before the final commit: update this "Current state" section
> (date, versions/tags, PR status, what's unreleased) and fix any other
> section your changes made stale (new insight → docId list; new file →
> file map; new bug-born rule → Invariants). This file is only useful if a
> cold-start agent can trust it blindly.

- `package.json` 0.2.0; only `v0.1.0` is tagged so far — the `v0.2.0` tag is
  cut AFTER the release PR merges. **PR #1 (dev→main) is open** and bundles
  v0.2.0 plus everything under `[Unreleased]` in CHANGELOG.md. Given the
  unreleased additions, the merged state may warrant going straight to v0.3.0
  (user decides).
- Unreleased on `dev`: waiting-for aging insight + in-app label picker
  (encrypted per-account settings), the **day** preset (daily reflections +
  time-of-day chart), this file.
- Deploy: Vercel serves `main` at hindsightly.vercel.app; pushing a `v*` tag
  runs `.github/workflows/release.yml` (Docker build → single-file HTML
  attached to a GitHub Release).

## Architecture & data flow

```
App.svelte        theme (localStorage hindsightly:theme, data-theme attr on <html>)
 └─ Unlock.svelte     first run: token + registerCredential → enroll()
 │                    later: unlock() via WebAuthn PRF → { token, cacheKey }
 └─ Dashboard.svelte  owns ALL state; everything below is $derived
     ├─ sync(preset)  1) hydrate encrypted cache once (instant on reload)
     │                   + loadSettings (waiting label ids)
     │                2) live snapshots once/session: projects, openTasks,
     │                   labels, isPremium
     │                3) top-up activity/completed newer than cached
     │                4) extend range if preset window < fetchedSince
     │                then persist() → saveCache (stripped + encrypted)
     ├─ computeMetrics / metricBreakdown  (counts + per-task drilldown)
     ├─ trendSeries(granularityFor(preset))  → TrendChart
     ├─ computeInsights(events, completed, projects, openTasks, filters,
     │                  undefined, waitingLabelNames)  → InsightList
     └─ DetailDrawer (shared: insight items OR metric breakdown, DrawerPanel)
```

Auth details: WebAuthn PRF extension output is the key material; the Todoist
token is AES-GCM-wrapped per credential (`vault.ts` — multi-credential
capable); a separate PRF-derived `cacheKey` encrypts the dataset cache and
settings. `accountKey(token)` = first 8 bytes of SHA-256, hex — non-reversible
per-account id used to scope cache/settings.

Persistence: IndexedDB db `hindsightly` **v3**, single-record stores `vault`,
`cache`, `settings` (`src/lib/auth/idb.ts`). Bumping DB version must keep
`onupgradeneeded` additive (existing users keep vault/cache without
re-enrolling).

## File map (src/)

- `App.svelte` — auth gate + theme; token/cacheKey live only here in memory.
- `components/Dashboard.svelte` — state owner: filters (preset, priority,
  project subtree, waiting labels), sync pipeline, drawer panels, layout
  (insights first, collapsible "Metrics" `<details>`, top-bar pickers).
- `components/Unlock.svelte` — enroll/unlock/reset; token input carries
  password-manager-ignore attrs (`data-1p-ignore` etc.).
- `components/TrendChart.svelte` — uPlot grouped bars; granularity-aware
  (daypart/day/week); gridlines at bucket *boundaries* via a background
  plugin; weekend shading on day view; custom hover legend; rebuilds on theme
  OR granularity change (options are baked at construction).
- `components/DetailDrawer.svelte` — slide-in drawer for `DrawerPanel`
  (`lib/ui.ts`); items keyed by INDEX (per-event ids repeat).
- `components/{InsightList,StatCard,ProjectTree,LabelPicker,ThemeToggle,Logo}`
  — presentational; StatCard becomes a `<button>` when `onOpen` passed.
- `lib/todoist/client.ts` — API v1 client: projects, labels, open tasks,
  activities (newest-first pages, stop when older than window), completed
  (≤84-day chunks, parallel, deduped), isPremium.
- `lib/todoist/types.ts` — Project, ActivityEvent(+extra_data), CompletedItem,
  OpenTask (incl. `dueDate`, `isRecurring`, `labels[]`), Label.
- `lib/todoist/cache.ts` — CachePayload + `strip*` (titles AND labels zeroed)
  + AES-GCM load/save; `mergeById`.
- `lib/todoist/settings.ts` — encrypted per-account `{ waitingLabelIds }`.
- `lib/auth/{webauthn,vault,idb}.ts` — PRF plumbing, token vault, IDB wrapper.
- `lib/stats/events.ts` — `classify()` event→buckets, `toDay()`,
  `suppressedDueChanges()` (reschedule debounce), `countedBuckets()`,
  `isRecurringCompletion()`.
- `lib/stats/metrics.ts` — `computeMetrics` + `metricBreakdown`.
- `lib/stats/insights.ts` — the insight engine (below).
- `lib/stats/series.ts` — `granularityFor` (day→daypart, week/month→day,
  quarter/year→week), `DAY_PARTS` (5 local-clock slots), `trendSeries`.
- `lib/stats/{filters,names,tree}.ts` — window/scope predicates ('day' =
  calendar today, local midnight→now; others rolling); `taskNameIndex` (the
  ONLY title resolver); project tree + `descendantIds`.
- `lib/config.ts` — `RESCHEDULE_DEDUP_MS` (env `VITE_RESCHEDULE_DEDUP_MIN`,
  default 10 min), `INSIGHTS_DOC_URL`.

## Domain semantics (locked)

- Buckets (`stats/types.ts`): opened, closed, postponed (due → later day),
  rescheduled (due → earlier day) — mutually exclusive by day-granularity
  direction; scheduled (none→date), unscheduled (date→none), reprioritized
  (independent axis). Recurring auto-advance lives in the `completed` event —
  it is NOT a postpone; `recurringClosed` is a surfaced subset of closed.
- Debounce: multiple due-changes on one task within the window collapse to
  one (typo correction), see `suppressedDueChanges`.
- `extra_data` on activity events: `content`/`last_content` (in-memory only),
  `due_date`/`last_due_date` (presence = due change), `priority`/
  `last_priority` (presence = priority change), `is_recurring`,
  `completed_due_date`, `was_overdue`.
- Completed-items endpoint EXCLUDES recurring completions; activity log has
  them. MTTC uses completed items (`completed_at − added_at`).

## Insight engine (`lib/stats/insights.ts`)

Pure function; every insight = `{ category, tone: good|warn|info, title,
detail, docId, items? }`. Categories = the four questions
(`right-tasks | structure | prioritization | execution`).

Signature quirk: `computeInsights(events, completed, projects, openTasks,
filters, dedupMs?, waitingLabels?)` — `waitingLabels` is a Set of lowercased
label NAMES (Dashboard resolves the user's saved label IDs → current names
live, so renames don't strand the pick). Empty set = waiting-for feature off
(fully opt-in, no default list — deliberate user decision).

Current insights by docId: serial-postponers, backlog-balance,
stale-open-tasks, inactive-projects, project-concentration, inbox-usage,
projects-with-many-stale-tasks, completion-speed-by-priority,
reprioritization-churn, completion-reliability-by-priority,
on-time-by-priority, closed-vs-opened, push-vs-do, throughput-trend,
overdue-now, waiting-for-aging, plan-kept, pushed-forward, typical-day.

**Day mode**: inferred (window ≤ 36 h). Statistical insights are hidden
(starve at n=1 day); day-only reflections appear instead: plan-kept (due
today: done/pushed/still-open), pushed-forward (postpones with target date),
typical-day (today's closes vs median of prior fetched days, ≥3 days
required). Waiting-labelled tasks are excluded from stale + serial-postponer
(parked on purpose, not avoided).

## Testing

`tests/*.test.ts`, run `npm test` (Vitest, node env). Key guards:
`insights.test.ts` (per-insight behavior + KNOWN docId set — extend BOTH when
adding an insight), `metrics.test.ts` (breakdown == counts), `cache.test.ts`
(strip functions drop titles/labels), `names.test.ts` (resolver fallback
order), `filters/series` (windows, granularity, daypart), `vault.prf/webauthn`
(crypto plumbing, mocked). `live.integration.test.ts` is skipped unless a
token env is present. Tests that depend on local time build dates from local
components (`new Date(y, m, d, h)`) to stay timezone-proof.

## Sharp edges & known debt

- Timezone: most day math is UTC (`toDay`), but the day-preset window and
  day-part chart buckets are LOCAL — deliberate split; full tz correctness
  (`tz_info`, `start_day`) is a roadmap item.
- Open-tasks snapshot is fetched once per session — day-view logic subtracts
  event-derived changes (see plan-kept) rather than trusting the snapshot.
- Free plan: ~7 days of activity → only `day`/`week` presets enabled
  (`FREE_PRESETS`), detected via `isPremium()`.

## Where the next task likely comes from

`ROADMAP.md` (curated, feasibility-probed): Next = worked examples in
INSIGHTS.md, cohort survival, recurring habit adherence, P1–P4 workload
balance, day-view follow-ups (reactive share, P1 check). Later = goal-
alignment lens (design agreed 2026-08: goal→project/label mapping reusing the
label-picker pattern, coverage + per-goal drift on quarter view), someday/
context label roles, tasks-that-are-really-projects, deadline-vs-due
discipline, section WIP, tz correctness, postpone distance, recurring toggle,
project turnover.
