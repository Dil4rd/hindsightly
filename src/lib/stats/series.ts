// Time-series shaping for the trend chart. Day buckets for short ranges, week
// buckets for long ranges, so weekly seasonality disappears at quarter/year.

import type { ActivityEvent } from '../todoist/types'
import { classify } from './events'
import { eventInScope, type Filters, type TimePreset } from './filters'

export type Granularity = 'day' | 'week'

export function granularityFor(preset: TimePreset): Granularity {
  return preset === 'week' || preset === 'month' ? 'day' : 'week'
}

export interface TrendSeries {
  /** x values in SECONDS (uPlot time axis), one per bucket. */
  t: number[]
  opened: number[]
  closed: number[]
  granularity: Granularity
}

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const floorDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS

/** Monday 00:00 UTC of the week containing `ms`. */
function floorWeek(ms: number): number {
  const day = floorDay(ms)
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7 // 0=Sun..6=Sat -> days since Mon
  return day - sinceMonday * DAY_MS
}

const bucketStart = (ms: number, g: Granularity) => (g === 'week' ? floorWeek(ms) : floorDay(ms))
const stepMs = (g: Granularity) => (g === 'week' ? WEEK_MS : DAY_MS)

export function trendSeries(events: ActivityEvent[], filters: Filters, g: Granularity): TrendSeries {
  const start = bucketStart(filters.since.getTime(), g)
  const end = bucketStart(filters.until.getTime(), g)

  const t: number[] = []
  const opened: number[] = []
  const closed: number[] = []
  const indexByBucket = new Map<number, number>()

  for (let b = start; b <= end; b += stepMs(g)) {
    indexByBucket.set(b, t.length)
    t.push(b / 1000)
    opened.push(0)
    closed.push(0)
  }

  for (const ev of events) {
    if (!eventInScope(ev, filters)) continue
    const i = indexByBucket.get(bucketStart(Date.parse(ev.event_date), g))
    if (i == null) continue
    for (const bucket of classify(ev)) {
      if (bucket === 'opened') opened[i]++
      else if (bucket === 'closed') closed[i]++
    }
  }

  return { t, opened, closed, granularity: g }
}
