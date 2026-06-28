import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../src/lib/stats/metrics'
import type { Filters } from '../src/lib/stats/filters'
import type { ActivityEvent, ActivityExtraData, CompletedItem } from '../src/lib/todoist/types'

const DAY = 86_400_000

function ev(
  event_type: ActivityEvent['event_type'],
  date: string,
  project: string,
  extra_data: ActivityExtraData = {},
): ActivityEvent {
  return {
    id: Math.floor(Date.parse(date) / 1000),
    event_date: date,
    event_type,
    object_type: 'item',
    object_id: 'x',
    parent_project_id: project,
    parent_item_id: null,
    extra_data,
  }
}

function done(project: string, added: string, completed: string, priority = 1): CompletedItem {
  return { id: added, content: '', project_id: project, priority, added_at: added, completed_at: completed, due: null }
}

const filters = (over: Partial<Filters> = {}): Filters => ({
  since: new Date('2026-06-01T00:00:00Z'),
  until: new Date('2026-06-30T23:59:59Z'),
  projectIds: null,
  priority: null,
  ...over,
})

describe('computeMetrics', () => {
  const events: ActivityEvent[] = [
    ev('added', '2026-06-10T10:00:00Z', 'A'),
    ev('completed', '2026-06-11T10:00:00Z', 'A'),
    ev('updated', '2026-06-12T10:00:00Z', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-20' }), // postponed
    ev('updated', '2026-06-13T10:00:00Z', 'B', { last_priority: 1, priority: 4 }), // reprioritized
    ev('added', '2026-05-01T10:00:00Z', 'A'), // out of window
  ]
  const completed: CompletedItem[] = [
    done('A', '2026-06-08T00:00:00Z', '2026-06-10T00:00:00Z'), // 2 days
    done('B', '2026-06-09T00:00:00Z', '2026-06-13T00:00:00Z'), // 4 days
  ]

  it('counts buckets and ignores out-of-window events', () => {
    const m = computeMetrics(events, completed, filters())
    expect(m.counts.opened).toBe(1)
    expect(m.counts.closed).toBe(1)
    expect(m.counts.postponed).toBe(1)
    expect(m.counts.reprioritized).toBe(1)
    expect(m.counts.rescheduled).toBe(0)
  })

  it('computes mean time to complete', () => {
    const m = computeMetrics(events, completed, filters())
    expect(m.meanTimeToCompleteMs).toBe((2 * DAY + 4 * DAY) / 2) // 3 days
  })

  it('filters by project subtree', () => {
    const m = computeMetrics(events, completed, filters({ projectIds: new Set(['B']) }))
    expect(m.counts.opened).toBe(0)
    expect(m.counts.reprioritized).toBe(1)
    expect(m.meanTimeToCompleteMs).toBe(4 * DAY)
  })

  it('filters by priority', () => {
    const m = computeMetrics(events, completed, filters({ priority: 4 }))
    expect(m.counts.reprioritized).toBe(1) // event has priority:4
    expect(m.meanTimeToCompleteMs).toBeNull() // no completed item is priority 4
  })

  it('returns null MTTC when nothing matches', () => {
    const m = computeMetrics([], [], filters())
    expect(m.meanTimeToCompleteMs).toBeNull()
  })
})
