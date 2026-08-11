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
  labels: string[] = [],
): OpenTask {
  return { id, content: '', project_id: 'P1', priority, added_at: added, dueDate, isRecurring, labels }
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
      'on-time-by-priority',
      'closed-vs-opened',
      'push-vs-do',
      'throughput-trend',
      'overdue-now',
      'waiting-for-aging',
      'plan-kept',
      'pushed-forward',
      'typical-day',
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

  it('on-time-by-priority splits dated completions by was_overdue', () => {
    const c = (id: string, pri: number, overdue: boolean) =>
      ev('completed', id, { priority: pri, completed_due_date: '2026-06-10', was_overdue: overdue })
    const evts = [
      c('a1', 4, false), c('a2', 4, false), c('a3', 4, false), c('a4', 4, true), // P1: 3/4 on-time
      c('b1', 1, false), c('b2', 1, true), c('b3', 1, true), c('b4', 1, true), // P4: 1/4 on-time
    ]
    const res = computeInsights(evts, [], [proj('P1')], [], filters)
    expect(res.some((i) => /P1 on-time 75%.*P4 25%/.test(i.title))).toBe(true)
  })

  it('flags overdue open tasks (past due, excludes recurring/future)', () => {
    const opens = [
      open('o1', '2026-05-01T00:00:00Z', 1, '2026-06-05'), // past due → overdue
      open('o2', '2026-05-01T00:00:00Z', 1, '2026-07-15'), // future → not
      open('o3', '2026-05-01T00:00:00Z', 1, '2026-06-05', true), // recurring → excluded
    ]
    const res = computeInsights([], [], [proj('P1')], opens, filters)
    const ins = res.find((i) => /overdue/.test(i.title))
    expect(ins?.title).toMatch(/1 task overdue/)
    expect(ins?.items?.some((it) => it.id === 'o1')).toBe(true)
  })

  const WAITING = new Set(['waiting'])
  it('flags an aged waiting-for item and excludes it from stale', () => {
    // Tagged @waiting, created ~59 days before window end → aged (>14d).
    const opens = [open('w1', '2026-05-01T00:00:00Z', 1, null, false, ['waiting'])]
    const res = computeInsights([], [], [proj('P1')], opens, filters, undefined, WAITING)
    const ins = res.find((i) => /waiting-for item.*to chase/.test(i.title))
    expect(ins?.title).toMatch(/1 waiting-for item to chase/)
    expect(ins?.items?.some((it) => it.id === 'w1')).toBe(true)
    // The same task must NOT be double-counted as stale.
    expect(res.some((i) => /older than 30 days/.test(i.title))).toBe(false)
  })
  it('reports a fresh waiting-for list when nothing has aged', () => {
    const opens = [open('w2', '2026-06-25T00:00:00Z', 1, null, false, ['waiting'])]
    const res = computeInsights([], [], [proj('P1')], opens, filters, undefined, WAITING)
    expect(res.some((i) => /Waiting-for list is fresh/.test(i.title))).toBe(true)
  })
  it('is off by default (no waiting labels selected → no card)', () => {
    // Same @waiting-tagged task, but no set passed → dormant, and it falls
    // back to being a normal stale task.
    const opens = [open('w1', '2026-05-01T00:00:00Z', 1, null, false, ['waiting'])]
    const res = computeInsights([], [], [proj('P1')], opens, filters)
    expect(res.some((i) => /waiting-for/i.test(i.title))).toBe(false)
    expect(res.some((i) => /older than 30 days/.test(i.title))).toBe(true)
  })
  it('excludes a waiting-labelled task from serial postponers', () => {
    const postpones = [
      ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-10' }, 'P1', '2026-06-08T10:00:00Z'),
      ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-11' }, 'P1', '2026-06-09T10:00:00Z'),
      ev('updated', 'A', { last_due_date: '2026-06-01', due_date: '2026-06-12' }, 'P1', '2026-06-10T10:00:00Z'),
    ]
    const opens = [open('A', '2026-06-01T00:00:00Z', 1, null, false, ['waiting'])]
    const res = computeInsights(postpones, [], [proj('P1')], opens, filters, undefined, WAITING)
    const ins = res.find((i) => /postponed 3\+/.test(i.title))
    expect(ins?.items?.some((it) => it.id === 'A')).toBeFalsy()
  })

  it('flags projects accumulating many stale tasks', () => {
    const many = Array.from({ length: 5 }, (_, i) => open(`s${i}`, '2026-04-01T00:00:00Z'))
    const res = computeInsights([], [], [proj('P1')], many, filters)
    const ins = res.find((i) => /project.*many stale tasks/.test(i.title))
    expect(ins?.items?.some((it) => it.id === 'P1' && it.meta === '5 stale')).toBe(true)
  })
})

describe('day mode (day preset window)', () => {
  // Calendar today: 2026-06-10, window midnight → 18:00.
  const dayFilters: Filters = {
    since: new Date('2026-06-10T00:00:00Z'),
    until: new Date('2026-06-10T18:00:00Z'),
    projectIds: null,
    priority: null,
  }
  const at = (h: number) => `2026-06-10T${String(h).padStart(2, '0')}:00:00Z`

  it('hides statistical insights (serial postponers, structure, ratios)', () => {
    const evts = [
      // 3 postpones of the same task, hours apart → would flag weekly, not daily
      ev('updated', 'A', { last_due_date: '2026-06-11', due_date: '2026-06-12' }, 'P1', at(9)),
      ev('updated', 'A', { last_due_date: '2026-06-11', due_date: '2026-06-13' }, 'P1', at(12)),
      ev('updated', 'A', { last_due_date: '2026-06-11', due_date: '2026-06-14' }, 'P1', at(15)),
      ...['o1', 'o2', 'o3'].map((id) => ev('added', id, {}, 'P1', at(10))),
    ]
    const res = computeInsights(evts, [], [proj('P1'), proj('P2')], [], dayFilters)
    expect(res.some((i) => /postponed 3\+/.test(i.title))).toBe(false)
    expect(res.some((i) => /no activity/.test(i.title))).toBe(false) // structure hidden
    expect(res.some((i) => /Closed \d+% of what you opened/.test(i.title))).toBe(false)
  })

  it('plan-kept: counts due-today tasks as done / pushed / still open', () => {
    const evts = [
      ev('completed', 'd1', { completed_due_date: '2026-06-10' }, 'P1', at(11)),
      // due today, pushed to the 12th
      ev('updated', 'p1', { last_due_date: '2026-06-10', due_date: '2026-06-12' }, 'P1', at(14)),
    ]
    const opens = [open('s1', '2026-06-01T00:00:00Z', 1, '2026-06-10')] // still open, due today
    const res = computeInsights(evts, [], [proj('P1')], opens, dayFilters)
    const ins = res.find((i) => i.docId === 'plan-kept')
    expect(ins?.title).toBe('Kept 1 of 3 due today')
    expect(ins?.items?.some((it) => it.id === 's1' && it.meta === 'still open')).toBe(true)
    expect(ins?.items?.some((it) => it.id === 'p1' && /→ Jun 12/.test(it.meta ?? ''))).toBe(true)
  })

  it('pushed-forward lists pushes with their target day', () => {
    const evts = [
      ev('added', 'o1', {}, 'P1', at(9)),
      ev('updated', 'A', { last_due_date: '2026-06-10', due_date: '2026-06-15' }, 'P1', at(10)),
    ]
    const res = computeInsights(evts, [], [proj('P1')], [], dayFilters)
    const ins = res.find((i) => i.docId === 'pushed-forward')
    expect(ins?.title).toMatch(/Pushed 1 task forward/)
    expect(ins?.items?.some((it) => it.id === 'A' && /→ Jun 15/.test(it.meta ?? ''))).toBe(true)
  })

  it('pushed-forward shows the good card when active but nothing pushed', () => {
    const res = computeInsights([ev('completed', 'c1', {}, 'P1', at(11))], [], [proj('P1')], [], dayFilters)
    expect(res.some((i) => /Nothing pushed forward today/.test(i.title))).toBe(true)
  })

  it('typical-day compares today against the median of prior days', () => {
    const dayEv = (id: string, date: string) =>
      ev('completed', id, {}, 'P1', `${date}T10:00:00Z`)
    const evts = [
      // prior days: 1, 2, 3 closes → median 2
      dayEv('a1', '2026-06-07'),
      dayEv('b1', '2026-06-08'), dayEv('b2', '2026-06-08'),
      dayEv('c1', '2026-06-09'), dayEv('c2', '2026-06-09'), dayEv('c3', '2026-06-09'),
      // today: 2 closes
      ev('completed', 't1', {}, 'P1', at(9)),
      ev('completed', 't2', {}, 'P1', at(16)),
    ]
    const res = computeInsights(evts, [], [proj('P1')], [], dayFilters)
    const ins = res.find((i) => i.docId === 'typical-day')
    expect(ins?.title).toBe('Closed 2 today — typical day is 2')
    expect(ins?.tone).toBe('good')
  })

  it('typical-day stays silent without enough history (<3 prior days)', () => {
    const evts = [
      ev('completed', 'y1', {}, 'P1', '2026-06-09T10:00:00Z'),
      ev('completed', 't1', {}, 'P1', at(9)),
    ]
    const res = computeInsights(evts, [], [proj('P1')], [], dayFilters)
    expect(res.some((i) => i.docId === 'typical-day')).toBe(false)
  })
})
