// Locked metric definitions.
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
  /** Of `counts.closed`, how many were recurring-task occurrences (not terminal). */
  recurringClosed: number
  /** mean(completed_at - added_at) over completed items, ms; null if none. */
  meanTimeToCompleteMs: number | null
}
