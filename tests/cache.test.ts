import { describe, expect, it } from 'vitest'
import { accountKey, mergeById, stripCompleted, stripEvent } from '../src/lib/todoist/cache'
import type { ActivityEvent, CompletedItem } from '../src/lib/todoist/types'

describe('mergeById', () => {
  it('dedupes by id, incoming wins', () => {
    const a = [{ id: 1, v: 'a' }, { id: 2, v: 'a' }]
    const b = [{ id: 2, v: 'b' }, { id: 3, v: 'b' }]
    const m = mergeById(a, b).sort((x, y) => x.id - y.id)
    expect(m).toEqual([{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 3, v: 'b' }])
  })
})

describe('strip', () => {
  it('drops task text from events but keeps stats fields', () => {
    const e: ActivityEvent = {
      id: 1,
      event_date: '2026-06-10T10:00:00Z',
      event_type: 'updated',
      object_type: 'item',
      object_id: 'x',
      parent_project_id: 'P',
      parent_item_id: null,
      extra_data: {
        content: 'secret task',
        last_content: 'old secret',
        due_date: '2026-06-12',
        last_due_date: '2026-06-10',
        priority: 4,
        last_priority: 1,
        is_recurring: true,
      },
    }
    const s = stripEvent(e)
    expect(s.extra_data.content).toBeUndefined()
    expect(s.extra_data.last_content).toBeUndefined()
    expect(s.extra_data.due_date).toBe('2026-06-12')
    expect(s.extra_data.last_priority).toBe(1)
    expect(s.parent_project_id).toBe('P')
  })

  it('drops content from completed items', () => {
    const c: CompletedItem = {
      id: 'a',
      content: 'secret',
      project_id: 'P',
      priority: 2,
      added_at: '2026-06-01T00:00:00Z',
      completed_at: '2026-06-03T00:00:00Z',
      due: null,
    }
    const s = stripCompleted(c)
    expect(s.content).toBe('')
    expect(s.project_id).toBe('P')
    expect(s.completed_at).toBe('2026-06-03T00:00:00Z')
  })
})

describe('accountKey', () => {
  it('is deterministic and differs per token', async () => {
    const a1 = await accountKey('token-a')
    const a2 = await accountKey('token-a')
    const b = await accountKey('token-b')
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
    expect(a1).toMatch(/^[0-9a-f]{16}$/)
  })
})
