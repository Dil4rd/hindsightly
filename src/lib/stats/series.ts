// Time-series shaping for the trend chart. Day-part buckets for the single day
// (hourly is too sparse to be informative), day buckets for short ranges, week
// buckets for long ranges, so weekly seasonality disappears at quarter/year.

import type { ActivityEvent } from '../todoist/types'
import { classify } from './events'
import { eventInScope, type Filters, type TimePreset } from './filters'

export type Granularity = 'daypart' | 'day' | 'week'

export function granularityFor(preset: TimePreset): Granularity {
  if (preset === 'day') return 'daypart'
  return preset === 'quarter' || preset === 'year' ? 'week' : 'day'
}

/** Five coarse slots of the day, in LOCAL clock hours: [from, to). */
export interface DayPart {
  label: string
  from: number
  to: number
}
export const DAY_PARTS: DayPart[] = [
  { label: 'Night', from: 0, to: 6 },
  { label: 'Morning', from: 6, to: 11 },
  { label: 'Noon', from: 11, to: 14 },
  { label: 'Afternoon', from: 14, to: 18 },
  { label: 'Evening', from: 18, to: 24 },
]

export interface TrendSeries {
  /**
   * x values, one per bucket: SECONDS (uPlot time axis) for day/week
   * granularity, or DAY_PARTS indices (0..4, categorical) for 'daypart'.
   */
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
  // Day view: categorical day-part histogram, bucketed by LOCAL clock hour
  // ("when in the day" is a local-time question). All 5 slots always present.
  if (g === 'daypart') {
    const opened = DAY_PARTS.map(() => 0)
    const closed = DAY_PARTS.map(() => 0)
    for (const ev of events) {
      if (!eventInScope(ev, filters)) continue
      const h = new Date(Date.parse(ev.event_date)).getHours()
      const i = DAY_PARTS.findIndex((p) => h >= p.from && h < p.to)
      if (i < 0) continue
      for (const bucket of classify(ev)) {
        if (bucket === 'opened') opened[i]++
        else if (bucket === 'closed') closed[i]++
      }
    }
    return { t: DAY_PARTS.map((_, i) => i), opened, closed, granularity: g }
  }
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
