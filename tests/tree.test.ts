import { describe, expect, it } from 'vitest'
import { buildTree, descendantIds } from '../src/lib/stats/tree'
import type { Project } from '../src/lib/todoist/types'

function proj(id: string, parent_id: string | null, child_order = 0, extra: Partial<Project> = {}): Project {
  return { id, name: `p${id}`, parent_id, child_order, is_archived: false, is_deleted: false, ...extra }
}

// p1 ─ p2 ─ p3
// p4 (root)
// p5 (deleted) ignored
const projects: Project[] = [
  proj('1', null, 1),
  proj('2', '1', 0),
  proj('3', '2', 0),
  proj('4', null, 0),
  proj('5', null, 2, { is_deleted: true }),
]

describe('buildTree', () => {
  it('nests children and orders roots by child_order', () => {
    const tree = buildTree(projects)
    expect(tree.map((n) => n.id)).toEqual(['4', '1']) // child_order 0 then 1
    const p1 = tree.find((n) => n.id === '1')!
    expect(p1.children.map((c) => c.id)).toEqual(['2'])
    expect(p1.children[0].children.map((c) => c.id)).toEqual(['3'])
  })

  it('drops deleted/archived projects', () => {
    const ids = buildTree(projects).map((n) => n.id)
    expect(ids).not.toContain('5')
  })
})

describe('descendantIds', () => {
  it('returns the project plus all descendants', () => {
    expect([...descendantIds(projects, '1')].sort()).toEqual(['1', '2', '3'])
    expect([...descendantIds(projects, '2')].sort()).toEqual(['2', '3'])
    expect([...descendantIds(projects, '4')].sort()).toEqual(['4'])
  })
})
