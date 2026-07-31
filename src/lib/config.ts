// Build-time configuration (Vite env). Override at build with e.g.
//   VITE_RESCHEDULE_DEDUP_MIN=5
const mins = Number(import.meta.env.VITE_RESCHEDULE_DEDUP_MIN)

/**
 * Multiple due-date changes on the SAME task within this window count as one
 * (a burst of edits is usually a typo correction, not real rescheduling).
 * Default 10 minutes; set to 0 to disable.
 */
export const RESCHEDULE_DEDUP_MS = (Number.isFinite(mins) ? mins : 10) * 60_000

/**
 * Default seed for the GTD "waiting-for" role — delegated, blocked, or awaiting
 * someone else's reply. Comma-separated, case-insensitive; override the seed at
 * build with e.g. `VITE_WAITING_LABELS=waiting,blocked,delegated`.
 *
 * This is only the FIRST-RUN default: on first load any of the account's labels
 * whose name matches is pre-selected in the in-app picker. After that the user's
 * saved selection (label ids, encrypted per account) is the source of truth.
 * Drives the waiting-for-aging insight and excuses those tasks from the stale /
 * serial-postponer signals. With nothing selected it stays dormant: no card.
 */
const rawWaiting = import.meta.env.VITE_WAITING_LABELS
export const WAITING_LABELS = new Set(
  (typeof rawWaiting === 'string' && rawWaiting.trim()
    ? rawWaiting
    : 'waiting,waiting-for,wf,blocked,delegated'
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)

/** Canonical methodology doc; each insight deep-links to its `#docId` anchor. */
export const INSIGHTS_DOC_URL =
  'https://github.com/Dil4rd/hindsightly/blob/main/docs/INSIGHTS.md'
