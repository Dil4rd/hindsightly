// Classify a single activity event into metric buckets.
// Locked rules (see memory: todoist-stats-project):
//   - postponed/rescheduled are mutually exclusive, split by due-date move
//     direction at DAY granularity
//   - scheduled (none->date) and unscheduled (date->none) are their own buckets
//   - reprioritized is an independent axis (an event can hit due + priority)
//   - recurring handling is DEFERRED: recurring auto-advances currently fall
//     into `postponed`.

import type { ActivityEvent } from '../todoist/types'
import type { MetricBucket } from './types'

/** Normalize a Todoist due value to a calendar day 'YYYY-MM-DD', or null. */
export function toDay(due: string | null | undefined): string | null {
  if (!due) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

export function classify(ev: ActivityEvent): MetricBucket[] {
  if (ev.object_type !== 'item') return []
  const x = ev.extra_data ?? {}
  const out: MetricBucket[] = []

  switch (ev.event_type) {
    case 'added':
      out.push('opened')
      break

    case 'completed':
      out.push('closed')
      break

    case 'updated': {
      // Due-date change is signalled by the presence of `last_due_date`.
      if ('last_due_date' in x) {
        const oldDay = toDay(x.last_due_date)
        const newDay = toDay(x.due_date)
        if (oldDay && newDay) {
          if (newDay > oldDay) out.push('postponed')
          else if (newDay < oldDay) out.push('rescheduled')
          // same calendar day -> time-only change, ignored
        } else if (!oldDay && newDay) {
          out.push('scheduled')
        } else if (oldDay && !newDay) {
          out.push('unscheduled')
        }
      }
      // Priority change is signalled by the presence of `last_priority`.
      if ('last_priority' in x && x.priority !== x.last_priority) {
        out.push('reprioritized')
      }
      break
    }
  }

  return out
}
