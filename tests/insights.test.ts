import { describe, expect, it } from 'vitest'
import { computeInsights } from '../src/lib/stats/insights'
import type { Filters } from '../src/lib/stats/filters'
import type {
  ActivityEvent,
  ActivityExtraData,
  CompletedItem,
  OpenTask,
  Project,
} from '../src/lib/todoist/types'

function ev(
  event_type: ActivityEvent['event_type'],
  object_id: string,
  extra_data: ActivityExtraData = {},
  project = 'P1',
  date = '2026-06-10T10:00:00Z',
): ActivityEvent {
  return {
    id: Math.random(),
    event_date: date,
    event_type,
    object_type: 'item',
    object_id,
    parent_project_id: project,
    parent_item_id: null,
    extra_data,
  }
}

function done(added: string, completed: string, priority: number): CompletedItem {
  return { id: added + priority, content: '', project_id: 'P1', priority, added_at: added, completed_at: completed, due: null }
}

function proj(id: string): Project {
  return { id, name: `proj ${id}`, parent_id: null, child_order: 0, is_archived: false, is_deleted: false }
}

function open(
  id: string,
  added: string,
  priority = 1,
  dueDate: string | null = null,
  isRecurring = false,
): OpenTask {
  return { id, content: '', project_id: 'P1', priority, added_at: added, dueDate, isRecurring }
}

const filters: Filters = {
  since: new Date('2026-06-01T00:00:00Z'),
  until: new Date('2026-06-30T23:59:59Z'),
  projectIds: null,
  priority: null,
}

const has = (titles: string[], re: RegExp) => titles.some((t) => re.test(t))

describe('computeInsights', () => {
  const events: ActivityEvent[] = [
    ...['o1', 'o2', 'o3', 'o4', 'o5'].map((id) => ev('added', id)),
    ...['c1', 'c2'].map((id) => ev('completed', id)),
    // 3 postpones of task A, days apart (not debounced)
    ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-10' }, 'P1', '2026-06-08T10:00:00Z'),
    ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-11' }, 'P1', '2026-06-09T10:00:00Z'),
    ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-12' }, 'P1', '2026-06-10T10:00:00Z'),
  ]
  const completed = [
    done('2026-06-09T00:00:00Z', '2026-06-10T00:00:00Z', 4), // P1, 1 day
    done('2026-06-01T00:00:00Z', '2026-06-06T00:00:00Z', 1), // P4, 5 days
  ]
  const projects = [proj('P1'), proj('P2')] // P2 has no activity
  const openTasks = [
    open('t1', '2026-04-01T00:00:00Z'), // ~90 days before window end → stale
    open('t2', '2026-06-20T00:00:00Z'), // recent → not stale
  ]

  const insights = computeInsights(events, completed, projects, openTasks, filters)
  const titles = insights.map((i) => i.title)

  it('flags a serial postponer (task A postponed 3x)', () => {
    expect(has(titles, /postponed 3\+ times/)).toBe(true)
  })
  it('reports backlog growth (opened 5, closed 2)', () => {
    expect(has(titles, /Backlog grew by 3/)).toBe(true)
  })
  it('flags a project with no activity', () => {
    expect(has(titles, /1 project with no activity/)).toBe(true)
  })
  it('recognizes the priority speed gradient (P1 faster than P4)', () => {
    expect(has(titles, /Higher priorities finish faster/)).toBe(true)
  })
  it('every insight carries a known docId (anchor in docs/INSIGHTS.md)', () => {
    const KNOWN = new Set([
      'serial-postponers',
      'backlog-balance',
      'stale-open-tasks',
      'inactive-projects',
      'project-concentration',
      'inbox-usage',
      'projects-with-many-stale-tasks',
      'completion-speed-by-priority',
      'reprioritization-churn',
      'completion-reliability-by-priority',
      'closed-vs-opened',
      'push-vs-do',
      'throughput-trend',
    ])
    for (const i of insights) {
      expect(i.docId, i.title).toBeTruthy()
      expect(KNOWN.has(i.docId), `unknown docId: ${i.docId}`).toBe(true)
    }
  })
  it('reports the closed-vs-opened ratio', () => {
    expect(has(titles, /Closed 40% of what you opened/)).toBe(true)
  })
  it('flags stale open tasks older than 30 days', () => {
    expect(has(titles, /open task.*older than 30 days/)).toBe(true)
  })
  it('dead-projects insight lists the offending projects', () => {
    const ins = insights.find((i) => /project.*no activity/.test(i.title))
    expect(ins?.items?.some((it) => it.id === 'P2' && it.href.includes('/project/P2'))).toBe(true)
  })
  it('serial-postponer insight lists the offending tasks', () => {
    const ins = insights.find((i) => /postponed 3\+/.test(i.title))
    expect(ins?.items?.some((it) => it.id === 'A' && it.href.includes('/task/A'))).toBe(true)
  })

  it('debounces rapid reschedules of the same task (within 10 min)', () => {
    const burst = [
      ev('updated', 'B', { last_due_date: '2026-06-01', due_date: '2026-06-10' }, 'P1', '2026-06-10T10:00:00Z'),
      ev('updated', 'B', { last_due_date: '2026-06-01', due_date: '2026-06-11' }, 'P1', '2026-06-10T10:03:00Z'),
      ev('updated', 'B', { last_due_date: '2026-06-01', due_date: '2026-06-12' }, 'P1', '2026-06-10T10:06:00Z'),
    ]
    const res = computeInsights(burst, [], [proj('P1')], [], filters) // default 10-min dedup
    expect(res.some((i) => /postponed 3\+/.test(i.title))).toBe(false)
  })

  it('does not flag recurring tasks as stale', () => {
    const res = computeInsights([], [], [proj('P1')], [open('r1', '2026-04-01T00:00:00Z', 1, '2026-07-01', true)], filters)
    expect(res.some((i) => /older than 30 days/.test(i.title))).toBe(false)
    expect(res.some((i) => /No stale open tasks/.test(i.title))).toBe(true)
  })
  it('does not flag future-scheduled tasks as stale', () => {
    const res = computeInsights([], [], [proj('P1')], [open('f1', '2026-04-01T00:00:00Z', 1, '2026-07-15')], filters)
    expect(res.some((i) => /older than 30 days/.test(i.title))).toBe(false)
  })

  it('per-priority reliability counts work due this period; postpone-out still counts', () => {
    const completedDue = (id: string, pri: number) =>
      ev('completed', id, { priority: pri, completed_due_date: '2026-06-10' })
    const evts = [
      completedDue('c1', 4), completedDue('c2', 4), completedDue('c3', 4), // 3 P1 done (due in window)
      ev('updated', 'c4', { priority: 4, last_due_date: '2026-06-13', due_date: '2026-07-05' }), // P1 postponed OUT
      completedDue('d1', 1), // 1 P4 done
    ]
    const opens = [
      open('d2', '2026-05-01T00:00:00Z', 1, '2026-06-20'),
      open('d3', '2026-05-01T00:00:00Z', 1, '2026-06-21'),
      open('d4', '2026-05-01T00:00:00Z', 1, '2026-06-22'),
    ]
    const res = computeInsights(evts, [], [proj('P1')], opens, filters)
    // P1: 3 done / (3 done + 1 postponed-out) = 75%; P4: 1 done / (1 + 3 open due) = 25%
    expect(res.some((i) => /P1 reliability 75%.*P4 25%/.test(i.title))).toBe(true)
  })

  it('flags projects accumulating many stale tasks', () => {
    const many = Array.from({ length: 5 }, (_, i) => open(`s${i}`, '2026-04-01T00:00:00Z'))
    const res = computeInsights([], [], [proj('P1')], many, filters)
    const ins = res.find((i) => /project.*many stale tasks/.test(i.title))
    expect(ins?.items?.some((it) => it.id === 'P1' && it.meta === '5 stale')).toBe(true)
  })
})
