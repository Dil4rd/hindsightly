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
 * Built-in default names for the GTD "waiting-for" role — delegated, blocked, or
 * awaiting someone else's reply. Used ONLY to pre-select matching labels on first
 * run; after that the user's in-app selection (label ids, encrypted per account)
 * is the source of truth. Lowercased for case-insensitive matching.
 */
export const DEFAULT_WAITING_LABELS = new Set([
  'waiting',
  'waiting-for',
  'wf',
  'blocked',
  'delegated',
])

/** Canonical methodology doc; each insight deep-links to its `#docId` anchor. */
export const INSIGHTS_DOC_URL =
  'https://github.com/Dil4rd/hindsightly/blob/main/docs/INSIGHTS.md'
