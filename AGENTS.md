# AGENTS.md — cold-start briefing

Everything a fresh agent needs to pick up the next task in this repo with no
prior session context. Rules and invariants live in [CLAUDE.md](./CLAUDE.md) —
read it first; this file is the *knowledge* layer (architecture, semantics,
state). If they ever disagree, CLAUDE.md wins.

**Non-negotiable, restated:** task names/content and label names never leave
the browser and are never persisted — ids + dates/timelines only. When probing
the live API (token may be in `.env`), print counts/ids/dates, never content.

## What this is

**Hindsightly** — a self-contained single-HTML-file dashboard that turns a
Todoist account into a GTD *retrospective instrument*: "did it work out, what
should I adjust?". It answers four questions — are you tracking the right
tasks? does your project structure make sense? are you prioritizing well? are
you executing well? Raw metrics are the signal layer; the *insight* layer
interprets them. Privacy-first: no backend, token encrypted with a passkey,
task text never at rest.

Stack (locked): Svelte 5 (runes), Vite 6 + `vite-plugin-singlefile` (+ strict
build-time CSP via `build/csp-plugin.ts`), TypeScript, uPlot, date-fns,
Vitest, Node 22. Docker is the primary dev workflow.

## Current state (2026-08-11)

- `package.json` 0.2.0; only `v0.1.0` is tagged so far — the `v0.2.0` tag is
  cut AFTER the release PR merges. **PR #1 (dev→main) is open** and bundles
  v0.2.0 plus everything under `[Unreleased]` in CHANGELOG.md — merging is the
  user's call (protected main; a self-authored PR cannot be merged by the
  agent). Given the unreleased additions, the merged state may warrant going
  straight to v0.3.0 (user decides).
- Unreleased on `dev`: waiting-for aging insight + in-app label picker
  (encrypted per-account settings), the **day** preset (daily reflections +
  time-of-day chart), CLAUDE.md, this file.
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
- `lib/stats/metrics.ts` — `computeMetrics` + `metricBreakdown` (same
  suppression path — breakdown lengths MUST equal counts; a test locks this).
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
- Priorities: internal 1..4 where **4 = P1 (highest)**.
- `extra_data` on activity events: `content`/`last_content` (in-memory only),
  `due_date`/`last_due_date` (presence = due change), `priority`/
  `last_priority` (presence = priority change), `is_recurring`,
  `completed_due_date`, `was_overdue`.
- Completed-items endpoint EXCLUDES recurring completions; activity log has
  them. MTTC uses completed items (`completed_at − added_at`).

## Insight engine (`lib/stats/insights.ts`)

Pure function; every insight = `{ category, tone: good|warn|info, title,
detail, docId, items? }`. `docId` must match a heading slug in
`docs/INSIGHTS.md` (KNOWN-set test). Categories = the four questions
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
- The completed endpoint 400s on ranges > ~3 months (client chunks by 84d).
- uPlot: axis `incrs` + `scale.time` are fixed at construction — rebuild on
  granularity change; `{#each}` over per-event lists keys by index.
- `metricBreakdown` and `computeMetrics` must share the suppression path or
  drawer contents diverge from card counts.

## Where the next task likely comes from

`ROADMAP.md` (curated, feasibility-probed): Next = worked examples in
INSIGHTS.md, cohort survival, recurring habit adherence, P1–P4 workload
balance, day-view follow-ups (reactive share, P1 check). Later = goal-
alignment lens (design agreed 2026-08: goal→project/label mapping reusing the
label-picker pattern, coverage + per-goal drift on quarter view), someday/
context label roles, tasks-that-are-really-projects, deadline-vs-due
discipline, section WIP, tz correctness, postpone distance, recurring toggle,
project turnover. Ship checklist for any feature: code + tests + INSIGHTS.md
card (if a new insight) + CHANGELOG `[Unreleased]` + commit per stage, push
to `dev`.
