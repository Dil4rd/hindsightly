import type { ActivityEvent, CompletedItem, OpenTask } from '../todoist/types'

/**
 * id → best-known task title, from event content, then completed items, then the
 * current open-tasks snapshot (freshest wins).
 *
 * IMPORTANT: the encrypted cache is name-free (only ids + timelines at rest), so
 * ANY UI that shows a task title MUST resolve it through this — never read a
 * title straight off an event/`extra_data.content` — or names vanish after a
 * reload (when events are hydrated from the stripped cache). In-memory only.
 */
export function taskNameIndex(
  events: ActivityEvent[],
  completed: CompletedItem[],
  openTasks: OpenTask[],
): Map<string, string> {
  const m = new Map<string, string>()
  for (const e of events) {
    const c = e.extra_data?.content
    if (c) m.set(e.object_id, c)
  }
  for (const c of completed) if (c.content) m.set(c.id, c.content)
  for (const t of openTasks) if (t.content) m.set(t.id, t.content)
  return m
}
