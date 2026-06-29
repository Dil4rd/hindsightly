import { describe, expect, it } from 'vitest'
import { classify, countedBuckets, suppressedDueChanges, toDay } from '../src/lib/stats/events'
import type { ActivityEvent, ActivityExtraData } from '../src/lib/todoist/types'

function ev(
  event_type: ActivityEvent['event_type'],
  extra_data: ActivityExtraData = {},
  object_type: ActivityEvent['object_type'] = 'item',
): ActivityEvent {
  return {
    id: 1,
    event_date: '2026-06-28T10:00:00Z',
    event_type,
    object_type,
    object_id: 'x',
    parent_project_id: 'p',
    parent_item_id: null,
    extra_data,
  }
}

describe('toDay', () => {
  it('extracts the calendar day from various due formats', () => {
    expect(toDay('2026-06-10')).toBe('2026-06-10')
    expect(toDay('2026-06-10T15:00:00Z')).toBe('2026-06-10')
    expect(toDay(null)).toBeNull()
    expect(toDay(undefined)).toBeNull()
  })
})

describe('classify', () => {
  it('opened / closed', () => {
    expect(classify(ev('added'))).toEqual(['opened'])
    expect(classify(ev('completed'))).toEqual(['closed'])
  })

  it('postponed vs rescheduled by direction (day granularity)', () => {
    expect(classify(ev('updated', { last_due_date: '2026-06-01', due_date: '2026-06-10' }))).toEqual(['postponed'])
    expect(classify(ev('updated', { last_due_date: '2026-06-10', due_date: '2026-06-01' }))).toEqual(['rescheduled'])
  })

  it('same-day time-only change is neither', () => {
    expect(
      classify(ev('updated', { last_due_date: '2026-06-10T09:00:00', due_date: '2026-06-10T15:00:00' })),
    ).toEqual([])
  })

  it('scheduled (none->date) and unscheduled (date->none)', () => {
    expect(classify(ev('updated', { last_due_date: null, due_date: '2026-06-10' }))).toEqual(['scheduled'])
    expect(classify(ev('updated', { last_due_date: '2026-06-10', due_date: null }))).toEqual(['unscheduled'])
  })

  it('reprioritized', () => {
    expect(classify(ev('updated', { last_priority: 1, priority: 4 }))).toEqual(['reprioritized'])
    // no actual change -> nothing
    expect(classify(ev('updated', { last_priority: 4, priority: 4 }))).toEqual([])
  })

  it('a single event can hit due-change AND reprioritized', () => {
    expect(
      classify(ev('updated', { last_due_date: '2026-06-01', due_date: '2026-06-10', last_priority: 1, priority: 2 })),
    ).toEqual(['postponed', 'reprioritized'])
  })

  it('updated with no last_* keys is neutral', () => {
    expect(classify(ev('updated', { content: 'whatever' }))).toEqual([])
  })

  it('ignores non-item objects', () => {
    expect(classify(ev('added', {}, 'project'))).toEqual([])
    expect(classify(ev('completed', {}, 'note'))).toEqual([])
  })
})

describe('reschedule debounce', () => {
  const due = (id: number, object_id: string, date: string): ActivityEvent => ({
    id,
    event_date: date,
    event_type: 'updated',
    object_type: 'item',
    object_id,
    parent_project_id: 'p',
    parent_item_id: null,
    extra_data: { last_due_date: '2026-06-01', due_date: '2026-06-10' }, // postponed
  })

  it('suppresses rapid same-task due changes within the window', () => {
    const evs = [
      due(1, 'A', '2026-06-10T10:00:00Z'),
      due(2, 'A', '2026-06-10T10:05:00Z'), // 5 min after kept #1 → suppressed
      due(3, 'A', '2026-06-10T11:00:00Z'), // 55 min later → kept
    ]
    const s = suppressedDueChanges(evs, 10 * 60_000)
    expect(s.has(1)).toBe(false)
    expect(s.has(2)).toBe(true)
    expect(s.has(3)).toBe(false)
  })

  it('does not suppress across different tasks', () => {
    const evs = [due(1, 'A', '2026-06-10T10:00:00Z'), due(2, 'B', '2026-06-10T10:01:00Z')]
    expect(suppressedDueChanges(evs, 10 * 60_000).size).toBe(0)
  })

  it('window 0 disables debounce', () => {
    const evs = [due(1, 'A', '2026-06-10T10:00:00Z'), due(2, 'A', '2026-06-10T10:01:00Z')]
    expect(suppressedDueChanges(evs, 0).size).toBe(0)
  })

  it('countedBuckets drops due-change for suppressed events only', () => {
    const e = due(2, 'A', '2026-06-10T10:05:00Z')
    expect(countedBuckets(e, new Set([2]))).toEqual([]) // postponed dropped
    expect(countedBuckets(e, new Set())).toEqual(['postponed']) // kept
  })
})
