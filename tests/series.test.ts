import { describe, expect, it } from 'vitest'
import { granularityFor, trendSeries } from '../src/lib/stats/series'
import type { Filters } from '../src/lib/stats/filters'
import type { ActivityEvent } from '../src/lib/todoist/types'

const DAY = 86_400_000

function ev(type: ActivityEvent['event_type'], date: string): ActivityEvent {
  return {
    id: 1,
    event_date: date,
    event_type: type,
    object_type: 'item',
    object_id: 'x',
    parent_project_id: 'A',
    parent_item_id: null,
    extra_data: {},
  }
}

const filters = (over: Partial<Filters> = {}): Filters => ({
  since: new Date('2026-06-01T00:00:00Z'),
  until: new Date('2026-06-30T23:59:59Z'),
  projectIds: null,
  priority: null,
  ...over,
})

describe('granularityFor', () => {
  it('uses day for short ranges and week for long ranges', () => {
    expect(granularityFor('week')).toBe('day')
    expect(granularityFor('month')).toBe('day')
    expect(granularityFor('quarter')).toBe('week')
    expect(granularityFor('year')).toBe('week')
  })
})

describe('trendSeries', () => {
  it('daypart buckets split the day into 5 local-time slots', () => {
    // Construct dates from LOCAL components so the local-hour bucketing is
    // deterministic regardless of the test machine's timezone.
    const local = (h: number, m = 0) => new Date(2026, 5, 10, h, m).toISOString()
    const evs = [
      ev('added', local(7)), // Morning (06–11)
      ev('added', local(10, 30)), // Morning
      ev('completed', local(15)), // Afternoon (14–18)
    ]
    const f = filters({ since: new Date(2026, 5, 10), until: new Date(2026, 5, 10, 18) })
    const s = trendSeries(evs, f, 'daypart')
    expect(s.granularity).toBe('daypart')
    expect(s.t).toEqual([0, 1, 2, 3, 4]) // all 5 slots, always
    expect(s.opened[1]).toBe(2)
    expect(s.closed[3]).toBe(1)
    expect(s.opened[0] + s.opened[2] + s.opened[4]).toBe(0)
  })

  it('day buckets count opened/closed per calendar day', () => {
    const evs = [
      ev('added', '2026-06-10T10:00:00Z'),
      ev('added', '2026-06-10T20:00:00Z'),
      ev('completed', '2026-06-11T09:00:00Z'),
    ]
    const s = trendSeries(evs, filters(), 'day')
    expect(s.granularity).toBe('day')
    const i10 = s.t.indexOf(Date.parse('2026-06-10T00:00:00Z') / 1000)
    const i11 = s.t.indexOf(Date.parse('2026-06-11T00:00:00Z') / 1000)
    expect(s.opened[i10]).toBe(2)
    expect(s.closed[i11]).toBe(1)
  })

  it('week buckets collapse a Monday-aligned week into one point', () => {
    // Construct two events in the same ISO week (Monday start), robustly.
    const mondayOf = (ms: number) => {
      const d = Math.floor(ms / DAY) * DAY
      return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY
    }
    const mon = mondayOf(Date.parse('2026-06-15T00:00:00Z'))
    const evs = [
      ev('added', new Date(mon + 1 * DAY + 10 * 3_600_000).toISOString()),
      ev('added', new Date(mon + 3 * DAY + 10 * 3_600_000).toISOString()),
    ]
    const f = filters({ since: new Date(mon - 7 * DAY), until: new Date(mon + 8 * DAY) })
    const s = trendSeries(evs, f, 'week')
    expect(s.granularity).toBe('week')
    const i = s.t.indexOf(mon / 1000)
    expect(i).toBeGreaterThanOrEqual(0)
    expect(s.opened[i]).toBe(2)
  })
})
