# Roadmap

Forward-looking only — shipped work lives in [CHANGELOG.md](./CHANGELOG.md).

Hindsightly is a retrospective instrument for a Todoist-based GTD practice:
"did it work out, and what should I adjust?" Items below earn their place by
serving that goal; this list is curated, not a backlog dump.

Candidate insights below were vetted in a design review with the API affordances
probe-confirmed (2026-07): the "confirmed" ones only need build work.

## Next

- [ ] **Worked examples in [docs/INSIGHTS.md](./docs/INSIGHTS.md)** — short,
      ideally visual "this data → this value, and note it misses X" snippets.
      Possibly cross-insight (one scenario illustrating several at once). Decide
      the format before writing.
- [ ] **Cohort completion / survival** — of the tasks you *created*, what share
      you ever finish, decaying by age (created-month cohorts: done vs still
      open). The honest per-task rate that closed-vs-opened deliberately isn't.
      *Confirmed* (added_at/completed_at + open snapshot).
- [ ] **Recurring habit adherence** — of recurring occurrences due, the share
      completed (and on-time). Turns the app's biggest deliberate blind spot into
      a subject. *Confirmed* via `completed` activity events; Pro-gated (7-day
      free activity cap makes streaks unmeasurable).
- [ ] **Workload balance across P1–P4** — flag a skewed priority mix (e.g. 90%
      P1, or no P3s). Distinct from the existing speed/reliability insights.

## Later

- [ ] **Label-role layer: someday / context (+ runtime settings)** —
      *waiting-for aging shipped* (label set via `VITE_WAITING_LABELS`). What's
      left: model the other GTD roles — **someday** (a review of the parked pile)
      and **context** — and replace the build-time env with a small in-app
      settings step that maps labels → roles, stored locally. Opt-in; the most
      GTD-native surface still open. *Confirmed* `labels[]`.
- [ ] **Tasks that are really projects** — open tasks with many open subtasks (or
      deep nesting) = an undecomposed project. *Confirmed* `parent_id`.
- [ ] **Deadline vs due discipline** — flag hard `deadline`s with no plan-date
      (`due`), or a `due` scheduled past the `deadline`. The GTD do-date/due-date
      split we use none of today. *Confirmed* field + change history; only useful
      for users who populate `deadline`.
- [ ] **Section WIP health** — group open tasks by section; flag an overloaded
      in-progress column or ballooning waiting/someday piles. *Confirmed*
      `/sections` + `section_id`; snapshot only (no stage-move history).
- [ ] **Timezone / week-start correctness** — read `tz_info` + `start_day` and
      use them for day-boundary math (postpone detection, weekend shading, week
      bucketing). Not a new card — a correctness upgrade to several insights.
- [ ] **Small refinements** — undated-backlog share (committed vs uncommitted
      open tasks); postpone *distance* + pull-ins (how far you push, and moves
      earlier). Both *confirmed* with data we already fetch.
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
