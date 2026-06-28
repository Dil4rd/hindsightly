// Aggregate filtered activity events + completed items into the final metrics.

import type { ActivityEvent, CompletedItem } from '../todoist/types'
import { classify } from './events'
import { completedInScope, eventInScope, type Filters } from './filters'
import { METRIC_BUCKETS, type MetricBucket, type Metrics } from './types'

export function emptyCounts(): Record<MetricBucket, number> {
  return Object.fromEntries(METRIC_BUCKETS.map((b) => [b, 0])) as Record<MetricBucket, number>
}

export function computeMetrics(
  events: ActivityEvent[],
  completed: CompletedItem[],
  filters: Filters,
): Metrics {
  const counts = emptyCounts()
  for (const ev of events) {
    if (!eventInScope(ev, filters)) continue
    for (const bucket of classify(ev)) counts[bucket]++
  }

  // Mean time to complete: completed_at - added_at over in-scope completed items.
  let total = 0
  let n = 0
  for (const it of completed) {
    if (!completedInScope(it, filters)) continue
    const added = Date.parse(it.added_at)
    const done = Date.parse(it.completed_at)
    if (Number.isFinite(added) && Number.isFinite(done) && done >= added) {
      total += done - added
      n++
    }
  }

  return { counts, meanTimeToCompleteMs: n ? total / n : null }
}
