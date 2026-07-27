import { describe, expect, it } from 'vitest'
import { taskNameIndex } from '../src/lib/stats/names'
import type { ActivityEvent, CompletedItem, OpenTask } from '../src/lib/todoist/types'

const ev = (object_id: string, content?: string): ActivityEvent => ({
  id: Math.floor(Math.abs(Date.parse('2026-06-10') + object_id.charCodeAt(0))),
  event_date: '2026-06-10T10:00:00Z',
  event_type: 'updated',
  object_type: 'item',
  object_id,
  parent_project_id: 'p',
  parent_item_id: null,
  extra_data: content ? { content } : {},
})
const comp = (id: string, content: string): CompletedItem => ({
  id,
  content,
  project_id: 'p',
  priority: 1,
  added_at: '2026-06-01',
  completed_at: '2026-06-05',
  due: null,
})
const open = (id: string, content: string): OpenTask => ({
  id,
  content,
  project_id: 'p',
  priority: 1,
  added_at: '2026-06-01',
  dueDate: null,
  isRecurring: false,
  labels: [],
})

describe('taskNameIndex', () => {
  it('resolves from event content', () => {
    expect(taskNameIndex([ev('a', 'Alpha')], [], []).get('a')).toBe('Alpha')
  })

  it('open-tasks snapshot wins over event/completed (freshest title)', () => {
    const m = taskNameIndex([ev('a', 'old')], [comp('a', 'mid')], [open('a', 'current')])
    expect(m.get('a')).toBe('current')
  })

  it('falls back to completed/open when the event is name-free (stripped cache)', () => {
    expect(taskNameIndex([ev('a')], [], [open('a', 'FromOpen')]).get('a')).toBe('FromOpen')
    expect(taskNameIndex([ev('b')], [comp('b', 'FromDone')], []).get('b')).toBe('FromDone')
  })

  it('unknown id → undefined (link-only, no name)', () => {
    expect(taskNameIndex([ev('a')], [], []).get('a')).toBeUndefined()
  })
})
