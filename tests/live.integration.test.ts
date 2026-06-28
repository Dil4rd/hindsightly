// Live end-to-end validation against the real account. Skipped by default;
// run with: TODOIST_LIVE=1 npx vitest run tests/live.integration.ts
//
// PRIVACY: this only ever logs AGGREGATE numbers (counts, means, list sizes).
// It never logs task content, project names, or any string values.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TodoistClient } from '../src/lib/todoist/client'
import { computeMetrics } from '../src/lib/stats/metrics'
import { presetWindow } from '../src/lib/stats/filters'
import { buildTree } from '../src/lib/stats/tree'

const run = process.env.TODOIST_LIVE === '1' ? describe : describe.skip

function token(): string {
  if (process.env.TODOIST_API_TOKEN) return process.env.TODOIST_API_TOKEN
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  return env.match(/TODOIST_API_TOKEN\s*=\s*(\S+)/)![1]
}

run('live pipeline (aggregates only)', () => {
  it('fetches and computes weekly metrics', async () => {
    const client = new TodoistClient(token())
    const now = new Date()
    const { since, until } = presetWindow('week', now)

    const [projects, events, completed] = await Promise.all([
      client.listProjects(),
      client.listActivities(since),
      client.listCompleted(since, until),
    ])

    const m = computeMetrics(events, completed, { since, until, projectIds: null, priority: null })

    console.log('projects:', projects.length, '| tree roots:', buildTree(projects).length)
    console.log('item events in window:', events.length, '| completed:', completed.length)
    console.log('counts:', m.counts)
    console.log(
      'mean time to complete (days):',
      m.meanTimeToCompleteMs ? (m.meanTimeToCompleteMs / 86_400_000).toFixed(2) : null,
    )

    expect(projects.length).toBeGreaterThan(0)
    expect(Object.values(m.counts).every((n) => n >= 0)).toBe(true)
  }, 60_000)
})
