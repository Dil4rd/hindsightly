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

- [ ] **Goal-alignment lens (5th retro question: "Are you moving toward your
      goals?")** — close the GTD Horizons gap between 1y/5y goals and daily
      tasks. Needs a **goal-mapping layer** (goal → top-level project(s), plus
      optional goal → label for cross-cutting work), stored encrypted per
      account — a direct generalization of the waiting-for label-picker pattern.
      Then, on the existing **quarter** window, report: **coverage** (mapped vs
      "orphan" effort — orphan share rising = drift) and **goal balance/drift**
      (effort share per goal, quarter-over-quarter; flag a starving goal, e.g.
      "Goal X: 2% this quarter, down from 15%"). *Confirmed* — reuses project
      tree, `labels[]`, and per-project/label counts we already compute.
      Deliberate boundary: measures **effort**, not **outcomes** — it flags a
      neglected goal, not an ineffective one; the goal statements still need a
      human review. Explored 2026-08 (design agreed, build deferred).
- [ ] **Label-role layer: someday / context** — *waiting-for aging shipped, with
      a runtime label picker* (choose your waiting labels in-app; stored encrypted
      per account). What's left: model the other GTD roles — **someday** (a review
      of the parked pile) and **context** — reusing the same picker pattern. Opt-in.
      *Confirmed* `labels[]`.
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
