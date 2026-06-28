// Filters: time window (default a week), project subtree, priority.

import type { ActivityEvent, CompletedItem } from '../todoist/types'

export interface Filters {
  since: Date
  until: Date
  /** Expanded subtree of project ids; null = all projects. */
  projectIds: Set<string> | null
  /** Todoist priority 1..4 (4 = highest / UI p1); null = all. */
  priority: number | null
}

export type TimePreset = 'week' | 'month' | 'quarter' | 'year'

const DAYS: Record<TimePreset, number> = { week: 7, month: 30, quarter: 90, year: 365 }

/** Rolling window ending at `now`. Default classifier is 'week'. */
export function presetWindow(preset: TimePreset, now: Date): { since: Date; until: Date } {
  const until = now
  const since = new Date(now.getTime() - DAYS[preset] * 86_400_000)
  return { since, until }
}

function inRange(iso: string, f: Filters): boolean {
  const t = Date.parse(iso)
  return t >= f.since.getTime() && t <= f.until.getTime()
}

export function eventInScope(ev: ActivityEvent, f: Filters): boolean {
  if (!inRange(ev.event_date, f)) return false
  if (f.projectIds && !(ev.parent_project_id && f.projectIds.has(ev.parent_project_id))) {
    return false
  }
  if (f.priority != null && ev.extra_data?.priority !== f.priority) return false
  return true
}

export function completedInScope(it: CompletedItem, f: Filters): boolean {
  if (!inRange(it.completed_at, f)) return false
  if (f.projectIds && !f.projectIds.has(it.project_id)) return false
  if (f.priority != null && it.priority !== f.priority) return false
  return true
}
