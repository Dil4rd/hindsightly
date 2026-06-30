# Insight methodology

How each insight is computed — what it captures, and (just as important) **what
it deliberately does not**. The open-source code in `src/lib/stats/insights.ts`
is the ultimate source of truth; this page explains the intent and the caveats so
the numbers are interpretable without reading the code.

All insights respect the active **filters** (time window, project subtree,
priority) unless a card says otherwise. Priorities use Todoist's internal scale
where **4 = P1 (highest)** and **1 = P4 (lowest)**.

> **Worked examples** (small, visual "this data → this value, and note it misses
> X") are planned but not written yet — see the roadmap. For now each card lists
> its rule and blind spots in prose.

Data sources referenced below:
- **Activity log** — `GET /api/v1/activities` (item events: added / updated /
  completed). Due-date and priority changes are detected by the presence of
  `last_due_date` / `last_priority`.
- **Completed items** — `GET /api/v1/tasks/completed/by_completion_date` (has
  `added_at` + `completed_at`; **excludes recurring** completions).
- **Open-tasks snapshot** — `GET /api/v1/tasks` (current open tasks with
  `dueDate`, `isRecurring`).

---

## Are you tracking the right tasks?

### Serial postponers

- **Measures:** distinct tasks **manually postponed ≥ 3 times** in the window (a
  postpone = a due-date edit moving the due to a strictly *later* calendar day).
  Lists the offenders (recurring ones marked `recurring`). If postpones happened
  but none reached 3, shows "No chronic postponers".
- **Ignores / doesn't capture:** rapid edits to the same task within the dedup
  window (default **10 min**, `VITE_RESCHEDULE_DEDUP_MIN`) collapse to one — typo
  corrections don't inflate the count. Recurrence **auto-advances are not
  postpones** (they live in the completed event), so routine recurring behaviour
  is excluded; only *manual* pushes count.
- **Source:** activity log.
- **Caveats:** window-bounded (only postpones whose event date is in the period);
  the "3+" threshold is fixed.

### Backlog balance

- **Measures:** `opened − closed` in the window → "Backlog grew/shrank by N" or
  "held steady".
- **Ignores:** *which* tasks; it's a raw count of added vs completed events.
- **Source:** activity log.
- **Caveats:** `closed` includes recurring completions, so a habit-heavy week can
  look like backlog shrinkage.

### Stale open tasks

- **Measures:** currently-open tasks created **> 30 days** before the window end
  that are **not actively scheduled**. Lists them with age.
- **Ignores / doesn't capture:** **recurring** tasks (living routines) and tasks
  with a **future due date** (planned, not stuck) are excluded. Overdue and
  undated old tasks are included.
- **Source:** open-tasks snapshot (`added_at`, `dueDate`, `isRecurring`).
- **Caveats:** "now" = the window's end date; the 30-day threshold is fixed.

---

## Does your project structure make sense?

### Inactive projects

- **Measures:** live projects (not archived/deleted, not Inbox) with **zero
  activity events** in the window. Lists them.
- **Ignores:** archived/deleted/Inbox projects.
- **Source:** projects list + per-project activity counts.
- **Caveats:** "activity" is any classified task event attributed to that project
  via `parent_project_id`; a parent whose work all sits in sub-projects can read
  as inactive.

### Project concentration

- **Measures:** flags when a **single project holds ≥ 50%** of all activity in
  the window.
- **Ignores:** how that activity splits across the remaining projects.
- **Source:** per-project activity counts.
- **Caveats:** only considered when activity spans more than one project.

### Inbox usage

- **Measures:** flags when **≥ 30%** of activity stayed in the Inbox project.
- **Source:** per-project activity counts.
- **Caveats:** high Inbox share suggests tasks aren't being organised, but
  capture-then-process workflows may legitimately run hot here.

### Projects with many stale tasks

- **Measures:** projects holding **≥ 5 stale tasks** (same "stale" definition as
  above — old, not recurring, not future-dated), ranked by count.
- **Source:** open-tasks snapshot.
- **Caveats:** shares the stale definition's exclusions; threshold fixed at 5.

---

## Are you prioritizing well?

### Completion speed by priority

- **Measures:** mean **time-to-complete** (`completed_at − added_at`) per priority
  present, shown as a gradient (e.g. `P1 1d · P2 4d · P3 9d · P4 20d`). Marked
  **good** if monotonic (higher priority finishes faster), else **warn**.
- **Ignores:** recurring tasks (the completed-items source excludes them).
- **Source:** completed items.
- **Caveats:** needs at least two priorities with completions in the window; a
  few outliers can skew a small-sample average.

### Reprioritization churn

- **Measures:** flags when reprioritizations are **≥ 20%** of opened+closed.
- **Source:** activity log (priority-change events).
- **Caveats:** some reprioritization is healthy triage; this only flags volume.

### Completion reliability by priority

- **Measures:** of work **due in this period**, the share you **completed**, per
  priority (compares P1 vs P4). Bounded 0–100%.
  - *Numerator* — completions whose `completed_due_date` falls in the window
    (credits **earlier-created** tasks and **recurring** occurrences).
  - *Denominator* — that, plus still-open tasks due in the window, **plus tasks
    postponed/rescheduled out of the window** (so deferring instead of completing
    can't quietly inflate the rate).
- **Ignores:** tasks never scheduled into the period.
- **Source:** activity log (`completed_due_date`, due-date changes) + open-tasks
  snapshot.
- **Caveats:** needs ≥ 3 due tasks per priority to report; a task due at the very
  end of the window and not yet done counts against you.

---

## Are you executing well?

### Closed vs opened

- **Measures:** `closed / opened` as a percentage; **good** at ≥ 90%.
- **Source:** activity log.
- **Caveats:** opened and closed are different task sets, so this is a *flow
  balance*, not a per-task completion rate.

### Push vs do

- **Measures:** flags when postpones are **≥ 40%** of postpones+closes.
- **Source:** activity log.
- **Caveats:** a lot of pushing relative to doing; subject to the same postpone
  debounce as serial postponers.

### Throughput trend

- **Measures:** compares tasks closed in the **recent half** vs the **earlier
  half** of the window — improving / declining / steady (≥ 1.25× either way).
- **Source:** activity log.
- **Caveats:** only computed with **≥ 6** closes in the window; halves are by
  calendar time, so an uneven period can read as a trend.
