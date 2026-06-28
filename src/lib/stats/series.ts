// Daily time-series shaping for the trend chart (opened vs closed per day).

import type { ActivityEvent } from '../todoist/types'
import { classify } from './events'
import { eventInScope, type Filters } from './filters'

const DAY_MS = 86_400_000

export interface DailySeries {
  /** x values in SECONDS (uPlot time axis), one per day in the window. */
  t: number[]
  opened: number[]
  closed: number[]
}

const floorDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS

export function dailySeries(events: ActivityEvent[], filters: Filters): DailySeries {
  const start = floorDay(filters.since.getTime())
  const end = floorDay(filters.until.getTime())

  const t: number[] = []
  const opened: number[] = []
  const closed: number[] = []
  const indexByDay = new Map<number, number>()

  for (let d = start; d <= end; d += DAY_MS) {
    indexByDay.set(d, t.length)
    t.push(d / 1000)
    opened.push(0)
    closed.push(0)
  }

  for (const ev of events) {
    if (!eventInScope(ev, filters)) continue
    const i = indexByDay.get(floorDay(Date.parse(ev.event_date)))
    if (i == null) continue
    for (const bucket of classify(ev)) {
      if (bucket === 'opened') opened[i]++
      else if (bucket === 'closed') closed[i]++
    }
  }

  return { t, opened, closed }
}
