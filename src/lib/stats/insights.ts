// The insight layer: interpret the raw signals into answers to the four retro
// questions. Pure — computed from the same in-scope data as the metrics, so it
// follows the time / project / priority filters.

import type { ActivityEvent, CompletedItem, OpenTask, Project } from '../todoist/types'
import { classify, countedBuckets, suppressedDueChanges, toDay } from './events'
import { completedInScope, eventInScope, type Filters } from './filters'
import { RESCHEDULE_DEDUP_MS } from '../config'

export type InsightTone = 'good' | 'warn' | 'info'
export type InsightCategory = 'right-tasks' | 'structure' | 'prioritization' | 'execution'

export interface InsightItem {
  id: string
  label?: string // task/project name when known (in-memory only; absent after reload)
  meta?: string // e.g. "4×" or "37d"
  href: string // deep link into Todoist
}

export interface Insight {
  category: InsightCategory
  tone: InsightTone
  title: string
  detail: string
  items?: InsightItem[] // offenders, for the actionable drill-down drawer
}

const taskHref = (id: string) => `https://app.todoist.com/app/task/${id}`
const projectHref = (id: string) => `https://app.todoist.com/app/project/${id}`

export const INSIGHT_CATEGORIES: InsightCategory[] = [
  'right-tasks',
  'structure',
  'prioritization',
  'execution',
]

export const INSIGHT_QUESTIONS: Record<InsightCategory, string> = {
  'right-tasks': 'Are you tracking the right tasks?',
  structure: 'Does your project structure make sense?',
  prioritization: 'Are you prioritizing well?',
  execution: 'Are you executing well?',
}

const DAY = 86_400_000
const fmtDur = (ms: number) =>
  ms >= 2 * DAY ? `${(ms / DAY).toFixed(1)}d` : `${Math.round(ms / 3_600_000)}h`
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0)

export function computeInsights(
  events: ActivityEvent[],
  completed: CompletedItem[],
  projects: Project[],
  openTasks: OpenTask[],
  filters: Filters,
  dedupMs: number = RESCHEDULE_DEDUP_MS,
): Insight[] {
  const evs = events.filter((e) => eventInScope(e, filters))
  const done = completed.filter((c) => completedInScope(c, filters))
  const suppress = suppressedDueChanges(evs, dedupMs)
  const out: Insight[] = []

  let opened = 0
  let closed = 0
  let postponed = 0
  let reprioritized = 0
  const postponesByItem = new Map<string, number>()
  const activityByProject = new Map<string, number>()
  const contentByItem = new Map<string, string>() // task title when present in events

  for (const e of evs) {
    const buckets = countedBuckets(e, suppress)
    for (const b of buckets) {
      if (b === 'opened') opened++
      else if (b === 'closed') closed++
      else if (b === 'postponed') postponed++
      else if (b === 'reprioritized') reprioritized++
    }
    if (buckets.length && e.parent_project_id) {
      activityByProject.set(
        e.parent_project_id,
        (activityByProject.get(e.parent_project_id) ?? 0) + 1,
      )
    }
    if (buckets.includes('postponed')) {
      postponesByItem.set(e.object_id, (postponesByItem.get(e.object_id) ?? 0) + 1)
    }
    if (e.extra_data?.content) contentByItem.set(e.object_id, e.extra_data.content)
  }

  // Best-known task title by id: event content, then completed items, then the
  // current open-tasks snapshot (freshest — wins). In-memory only; empty after
  // a reload until data refetches.
  const nameById = new Map<string, string>(contentByItem)
  for (const c of completed) if (c.content) nameById.set(c.id, c.content)
  for (const t of openTasks) if (t.content) nameById.set(t.id, t.content)
  const recurringIds = new Set(openTasks.filter((t) => t.isRecurring).map((t) => t.id))

  // ---- Are you tracking the right tasks? ----
  if (postponed > 0) {
    const serial = [...postponesByItem.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])
    out.push(
      serial.length > 0
        ? {
            category: 'right-tasks',
            tone: 'warn',
            title: `${serial.length} task${serial.length > 1 ? 's' : ''} postponed 3+ times`,
            detail:
              'Repeatedly pushed tasks are often the wrong task, too big, or avoided — break them down or drop them.',
            items: serial.map(([id, n]) => ({
              id,
              label: nameById.get(id),
              meta: recurringIds.has(id) ? `${n}× · recurring` : `${n}×`,
              href: taskHref(id),
            })),
          }
        : {
            category: 'right-tasks',
            tone: 'good',
            title: 'No chronic postponers',
            detail: 'No task was pushed to a later day three or more times.',
          },
    )
  }
  if (opened || closed) {
    const net = opened - closed
    out.push({
      category: 'right-tasks',
      tone: net > 0 ? 'warn' : 'good',
      title: net > 0 ? `Backlog grew by ${net}` : net < 0 ? `Backlog shrank by ${-net}` : 'Backlog held steady',
      detail: `Opened ${opened}, closed ${closed} in this period.`,
    })
  }

  // ---- Does your project structure make sense? ----
  const liveProjects = projects.filter(
    (p) => !p.is_deleted && !p.is_archived && !p.inbox_project,
  )
  if (liveProjects.length) {
    const dead = liveProjects.filter((p) => !activityByProject.get(p.id))
    if (dead.length > 0) {
      out.push({
        category: 'structure',
        tone: 'info',
        title: `${dead.length} project${dead.length > 1 ? 's' : ''} with no activity`,
        detail: 'Inactive projects add noise — consider archiving them.',
        items: dead.map((p) => ({ id: p.id, label: p.name, href: projectHref(p.id) })),
      })
    }
  }
  const totalActivity = [...activityByProject.values()].reduce((a, b) => a + b, 0)
  if (activityByProject.size > 1) {
    let topId = ''
    let topN = 0
    for (const [id, n] of activityByProject) if (n > topN) [topN, topId] = [n, id]
    const share = pct(topN, totalActivity)
    if (share >= 50) {
      const name = projects.find((p) => p.id === topId)?.name ?? 'one project'
      out.push({
        category: 'structure',
        tone: 'info',
        title: `${share}% of activity in “${name}”`,
        detail: 'Most of your activity is concentrated in a single project.',
      })
    }
  }
  const inbox = projects.find((p) => p.inbox_project)
  if (inbox && totalActivity > 0) {
    const share = pct(activityByProject.get(inbox.id) ?? 0, totalActivity)
    if (share >= 30) {
      out.push({
        category: 'structure',
        tone: 'warn',
        title: `${share}% of activity stayed in Inbox`,
        detail: 'Tasks lingering in Inbox usually means they aren’t organized into projects.',
      })
    }
  }

  // ---- Are you prioritizing well? (Todoist priority 4 = P1 highest) ----
  const mttc = new Map<number, { total: number; n: number }>()
  for (const c of done) {
    const a = Date.parse(c.added_at)
    const d = Date.parse(c.completed_at)
    if (Number.isFinite(a) && Number.isFinite(d) && d >= a) {
      const g = mttc.get(c.priority) ?? { total: 0, n: 0 }
      g.total += d - a
      g.n++
      mttc.set(c.priority, g)
    }
  }
  // Speed gradient — P1 should finish fastest, P4 slowest.
  const PRI: Array<[number, string]> = [
    [4, 'P1'],
    [3, 'P2'],
    [2, 'P3'],
    [1, 'P4'],
  ]
  const speed = PRI.map(([p, label]) => {
    const g = mttc.get(p)
    return g?.n ? { label, avg: g.total / g.n } : null
  }).filter((x): x is { label: string; avg: number } => x != null)
  if (speed.length >= 2) {
    const parts = speed.map((s) => `${s.label} ${fmtDur(s.avg)}`).join(' · ')
    let monotonic = true
    for (let i = 1; i < speed.length; i++) if (speed[i].avg < speed[i - 1].avg) monotonic = false
    out.push(
      monotonic
        ? {
            category: 'prioritization',
            tone: 'good',
            title: 'Higher priorities finish faster',
            detail: `Mean time to complete by priority: ${parts}.`,
          }
        : {
            category: 'prioritization',
            tone: 'warn',
            title: 'Priority doesn’t track completion speed',
            detail: `Expected P1 fastest → P4 slowest; actual: ${parts}.`,
          },
    )
  }
  if (reprioritized > 0 && opened + closed > 0 && pct(reprioritized, opened + closed) >= 20) {
    out.push({
      category: 'prioritization',
      tone: 'warn',
      title: `${reprioritized} reprioritizations`,
      detail: 'Frequent priority changes suggest priorities aren’t clear when tasks are created.',
    })
  }

  // ---- Are you executing well? ----
  if (opened > 0) {
    const ratio = closed / opened
    out.push({
      category: 'execution',
      tone: ratio >= 0.9 ? 'good' : 'warn',
      title: `Closed ${Math.round(ratio * 100)}% of what you opened`,
      detail:
        ratio >= 1
          ? 'You closed at least as many tasks as you opened — keeping pace.'
          : 'You opened more than you closed — the gap becomes backlog.',
    })
  }
  if (postponed > 0 && postponed + closed > 0 && pct(postponed, postponed + closed) >= 40) {
    out.push({
      category: 'execution',
      tone: 'warn',
      title: `${pct(postponed, postponed + closed)}% push-vs-do`,
      detail: `You postponed ${postponed} task(s) vs closing ${closed} — a lot of pushing relative to doing.`,
    })
  }

  // ---- Stale open tasks (current snapshot; project/priority filtered) ----
  const nowMs = filters.until.getTime()
  const STALE_MS = 30 * DAY
  const STALE_PROJECT_MIN = 5 // flag projects accumulating this many stale tasks
  const scopedOpen = openTasks.filter(
    (t) =>
      (!filters.projectIds || filters.projectIds.has(t.project_id)) &&
      (filters.priority == null || t.priority === filters.priority),
  )
  if (scopedOpen.length) {
    // Stale = old AND not actively scheduled: skip recurring tasks (alive
    // routines) and tasks with a future due date (they're planned, not stuck).
    const today = toDay(new Date(nowMs).toISOString()) ?? ''
    const futureScheduled = (t: OpenTask) => t.dueDate != null && (toDay(t.dueDate) ?? '') >= today
    const stale = scopedOpen.filter(
      (t) => !t.isRecurring && !futureScheduled(t) && nowMs - Date.parse(t.added_at) > STALE_MS,
    )
    if (stale.length) {
      const byAge = [...stale].sort((a, b) => Date.parse(a.added_at) - Date.parse(b.added_at))
      const oldest = nowMs - Date.parse(byAge[0].added_at)
      out.push({
        category: 'right-tasks',
        tone: 'warn',
        title: `${stale.length} open task${stale.length > 1 ? 's' : ''} older than 30 days`,
        detail: `Long-open tasks may be stuck, stale, or need breaking down (oldest: ${Math.round(oldest / DAY)} days).`,
        items: byAge.map((t) => ({
          id: t.id,
          label: t.content || undefined,
          meta: `${Math.round((nowMs - Date.parse(t.added_at)) / DAY)}d`,
          href: taskHref(t.id),
        })),
      })
    } else {
      out.push({
        category: 'right-tasks',
        tone: 'good',
        title: 'No stale open tasks',
        detail: 'Every open task in scope is under 30 days old.',
      })
    }

    // Projects accumulating many stale tasks (structure signal).
    const staleByProject = new Map<string, number>()
    for (const t of stale) staleByProject.set(t.project_id, (staleByProject.get(t.project_id) ?? 0) + 1)
    const heavy = [...staleByProject.entries()]
      .filter(([, n]) => n >= STALE_PROJECT_MIN)
      .sort((a, b) => b[1] - a[1])
    if (heavy.length) {
      out.push({
        category: 'structure',
        tone: 'warn',
        title: `${heavy.length} project${heavy.length > 1 ? 's' : ''} with many stale tasks`,
        detail: 'Projects piling up long-open tasks may be overloaded, stalled, or need pruning.',
        items: heavy.map(([id, n]) => ({
          id,
          label: projects.find((p) => p.id === id)?.name,
          meta: `${n} stale`,
          href: projectHref(id),
        })),
      })
    }
  }

  // ---- Throughput trend (closed: recent half vs earlier half of the window) ----
  const mid = (filters.since.getTime() + nowMs) / 2
  let closedEarly = 0
  let closedLate = 0
  for (const e of evs) {
    if (classify(e).includes('closed')) {
      if (Date.parse(e.event_date) < mid) closedEarly++
      else closedLate++
    }
  }
  if (closedEarly + closedLate >= 6) {
    if (closedLate >= closedEarly * 1.25) {
      out.push({
        category: 'execution',
        tone: 'good',
        title: 'Throughput improving',
        detail: `Closed ${closedLate} in the recent half vs ${closedEarly} earlier in this period.`,
      })
    } else if (closedEarly >= closedLate * 1.25) {
      out.push({
        category: 'execution',
        tone: 'warn',
        title: 'Throughput declining',
        detail: `Closed ${closedLate} in the recent half vs ${closedEarly} earlier in this period.`,
      })
    } else {
      out.push({
        category: 'execution',
        tone: 'info',
        title: 'Throughput steady',
        detail: 'Your closing pace is roughly flat across this period.',
      })
    }
  }

  // ---- Per-priority reliability (of work DUE this period, what share done) ----
  // "Scheduled for this period" = due in the window at any point — INCLUDING
  // tasks postponed/rescheduled OUT of it, so deferring instead of completing
  // doesn't quietly inflate the rate. Bounded 0–100%.
  const winStart = filters.since.getTime()
  const winEnd = nowMs
  const inWin = (s?: string | null) => {
    if (!s) return false
    const t = Date.parse(s)
    return Number.isFinite(t) && t >= winStart && t <= winEnd
  }
  const scheduledDue = new Map<number, Set<string>>() // due this period, by priority
  const completedDue = new Map<number, Set<string>>() // ...and completed
  const mark = (m: Map<number, Set<string>>, p: number, id: string) => {
    const s = m.get(p) ?? new Set<string>()
    s.add(id)
    m.set(p, s)
  }
  for (const e of evs) {
    const x = e.extra_data ?? {}
    const p = x.priority ?? 1
    if (classify(e).includes('closed') && inWin(x.completed_due_date)) {
      mark(scheduledDue, p, e.object_id)
      mark(completedDue, p, e.object_id)
    }
    // Due moved OUT of the window (was due in, now isn't) — scheduled, not done.
    if ('last_due_date' in x && inWin(x.last_due_date) && !inWin(x.due_date)) {
      mark(scheduledDue, p, e.object_id)
    }
  }
  for (const t of openTasks) if (inWin(t.dueDate)) mark(scheduledDue, t.priority, t.id)

  const MIN_DUE = 3 // ignore tiny, noisy cohorts
  const reliability = (p: number): number | null => {
    const all = scheduledDue.get(p)
    if (!all || all.size < MIN_DUE) return null
    return Math.round((100 * (completedDue.get(p)?.size ?? 0)) / all.size)
  }
  const rel1 = reliability(4) // P1 (highest)
  const rel4 = reliability(1) // P4 (lowest)
  if (rel1 != null && rel4 != null) {
    out.push(
      rel1 >= rel4
        ? {
            category: 'prioritization',
            tone: 'good',
            title: `P1 reliability ${rel1}% ≥ P4 ${rel4}%`,
            detail:
              'Of work due this period, you complete a higher share at high priority than low — priorities are reliable. (Tasks postponed out of the period still count as not done.)',
          }
        : {
            category: 'prioritization',
            tone: 'warn',
            title: `P1 reliability ${rel1}% < P4 ${rel4}%`,
            detail:
              'Of work due this period, you complete a smaller share at high priority than low — high-priority commitments may be slipping.',
          },
    )
  }

  return out
}
