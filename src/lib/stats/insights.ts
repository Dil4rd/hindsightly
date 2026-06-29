// The insight layer: interpret the raw signals into answers to the four retro
// questions. Pure — computed from the same in-scope data as the metrics, so it
// follows the time / project / priority filters.

import type { ActivityEvent, CompletedItem, OpenTask, Project } from '../todoist/types'
import { classify, countedBuckets, suppressedDueChanges } from './events'
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
              meta: `${n}×`,
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
  const hi = mttc.get(4)
  const lo = mttc.get(1)
  if (hi?.n && lo?.n) {
    const hiAvg = hi.total / hi.n
    const loAvg = lo.total / lo.n
    out.push(
      hiAvg <= loAvg
        ? {
            category: 'prioritization',
            tone: 'good',
            title: `P1 finishes faster (${fmtDur(hiAvg)} vs P4 ${fmtDur(loAvg)})`,
            detail: 'High-priority tasks complete sooner than low — priorities are guiding execution.',
          }
        : {
            category: 'prioritization',
            tone: 'warn',
            title: `P1 is slower than P4 (${fmtDur(hiAvg)} vs ${fmtDur(loAvg)})`,
            detail: 'High-priority tasks take longer than low — priorities may not reflect what you do.',
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
    const stale = scopedOpen.filter((t) => nowMs - Date.parse(t.added_at) > STALE_MS)
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

  // ---- Per-priority completion rate (closed/opened by priority) ----
  const openedByPri = new Map<number, number>()
  const closedByPri = new Map<number, number>()
  for (const e of evs) {
    const p = e.extra_data?.priority ?? 1 // default priority when unset
    const buckets = classify(e)
    if (buckets.includes('opened')) openedByPri.set(p, (openedByPri.get(p) ?? 0) + 1)
    if (buckets.includes('closed')) closedByPri.set(p, (closedByPri.get(p) ?? 0) + 1)
  }
  const rate = (p: number) => {
    const o = openedByPri.get(p) ?? 0
    return o ? Math.round((100 * (closedByPri.get(p) ?? 0)) / o) : null
  }
  const r1 = rate(4) // P1 (highest)
  const r4 = rate(1) // P4 (lowest)
  if (r1 != null && r4 != null) {
    out.push(
      r1 >= r4
        ? {
            category: 'prioritization',
            tone: 'good',
            title: `P1 completion ${r1}% ≥ P4 ${r4}%`,
            detail: 'You close a higher share of high-priority tasks than low — priorities drive completion.',
          }
        : {
            category: 'prioritization',
            tone: 'warn',
            title: `P1 completion ${r1}% < P4 ${r4}%`,
            detail: 'You close a smaller share of high-priority tasks than low — high-priority work may be stalling.',
          },
    )
  }

  return out
}
