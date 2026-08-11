// Classify a single activity event into metric buckets.
// Locked rules:
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

/**
 * A completed event for a recurring task — an occurrence completion, not a
 * terminal close. Verified against live data: the recurrence advance is encoded
 * in the completed event itself (not a separate `updated` due-move), so it does
 * NOT inflate postponed. It is a subset of `closed`, surfaced separately so
 * habit/maintenance work can be told apart from one-off project progress.
 */
export function isRecurringCompletion(ev: ActivityEvent): boolean {
  return ev.object_type === 'item' && ev.event_type === 'completed' && !!ev.extra_data?.is_recurring
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

// Due-date buckets (the ones a reschedule debounce applies to).
const DUE_BUCKETS = new Set<MetricBucket>(['postponed', 'rescheduled', 'scheduled', 'unscheduled'])

const isDueChange = (e: ActivityEvent): boolean => classify(e).some((b) => DUE_BUCKETS.has(b))

/**
 * Ids of due-change events to NOT count: when the same task has multiple
 * due-date changes within `windowMs` of a kept one, the extras are suppressed
 * (a burst of edits ≈ a typo correction, not real rescheduling).
 */
export function suppressedDueChanges(events: ActivityEvent[], windowMs: number): Set<number> {
  const suppress = new Set<number>()
  if (windowMs <= 0) return suppress

  const byItem = new Map<string, Array<{ id: number; t: number }>>()
  for (const e of events) {
    if (!isDueChange(e)) continue
    const arr = byItem.get(e.object_id) ?? []
    arr.push({ id: e.id, t: Date.parse(e.event_date) })
    byItem.set(e.object_id, arr)
  }

  for (const arr of byItem.values()) {
    arr.sort((a, b) => a.t - b.t)
    let lastKept = -Infinity
    for (const { id, t } of arr) {
      if (t - lastKept < windowMs) suppress.add(id)
      else lastKept = t
    }
  }
  return suppress
}

/** classify(), minus due-change buckets for debounce-suppressed events. */
export function countedBuckets(e: ActivityEvent, suppress: Set<number>): MetricBucket[] {
  const buckets = classify(e)
  return suppress.has(e.id) ? buckets.filter((b) => !DUE_BUCKETS.has(b)) : buckets
}
