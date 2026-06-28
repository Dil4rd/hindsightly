// Locked metric definitions (see memory: todoist-stats-project).
// postponed and rescheduled are MUTUALLY EXCLUSIVE, split by due-date move
// direction at DAY granularity (in the task's due timezone).

export type MetricBucket =
  | 'opened' // item:added
  | 'closed' // item:completed
  | 'postponed' // existing due date -> later calendar day
  | 'rescheduled' // existing due date -> earlier calendar day
  | 'scheduled' // none -> date
  | 'unscheduled' // date -> none
  | 'reprioritized' // priority changed

export const METRIC_BUCKETS: MetricBucket[] = [
  'opened',
  'closed',
  'postponed',
  'rescheduled',
  'scheduled',
  'unscheduled',
  'reprioritized',
]

export interface Metrics {
  counts: Record<MetricBucket, number>
  /** mean(completed_at - added_at) over completed items, ms; null if none. */
  meanTimeToCompleteMs: number | null
}

// NOTE: recurring-task handling is deferred — recurring auto-advances will
// currently land in `postponed`. Tracked for a later stage.
