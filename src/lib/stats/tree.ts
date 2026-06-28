// Project tree: build a nested structure from the flat project list, and
// expand a project id to its full subtree (for descendant rollup filtering).

import type { Project } from '../todoist/types'

export interface ProjectNode {
  id: string
  name: string
  children: ProjectNode[]
}

function liveProjects(projects: Project[]): Project[] {
  return projects.filter((p) => !p.is_deleted && !p.is_archived)
}

export function buildTree(projects: Project[]): ProjectNode[] {
  const live = liveProjects(projects)
  const byId = new Map<string, ProjectNode>()
  for (const p of live) byId.set(p.id, { id: p.id, name: p.name, children: [] })

  const roots: ProjectNode[] = []
  for (const p of live) {
    const node = byId.get(p.id)!
    const parent = p.parent_id ? byId.get(p.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const order = new Map(live.map((p) => [p.id, p.child_order]))
  const sort = (nodes: ProjectNode[]) => {
    nodes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

/** A project's id plus all of its descendant ids. */
export function descendantIds(projects: Project[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const p of projects) {
    if (!p.parent_id) continue
    const arr = childrenOf.get(p.parent_id) ?? []
    arr.push(p.id)
    childrenOf.set(p.parent_id, arr)
  }

  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    for (const c of childrenOf.get(id) ?? []) stack.push(c)
  }
  return out
}
