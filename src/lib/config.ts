// Build-time configuration (Vite env). Override at build with e.g.
//   VITE_RESCHEDULE_DEDUP_MIN=5
const mins = Number(import.meta.env.VITE_RESCHEDULE_DEDUP_MIN)

/**
 * Multiple due-date changes on the SAME task within this window count as one
 * (a burst of edits is usually a typo correction, not real rescheduling).
 * Default 10 minutes; set to 0 to disable.
 */
export const RESCHEDULE_DEDUP_MS = (Number.isFinite(mins) ? mins : 10) * 60_000
