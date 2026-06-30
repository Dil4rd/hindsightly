// Persistent, content-stripped, ENCRYPTED cache of the Todoist dataset.
// Stored in IndexedDB, scoped per account (hash of the token), and encrypted
// at rest with a passkey-derived key — so nothing sensitive is readable without
// unlocking. Task text is also stripped before encryption as defence in depth.

import { b64uDecode, b64uEncode } from '../auth/webauthn'
import { cacheGet, cacheSet } from '../auth/idb'
import type { ActivityEvent, CompletedItem, OpenTask, Project } from './types'

export interface CachePayload {
  fetchedSince: number // earliest event timestamp covered (ms)
  events: ActivityEvent[]
  completed: CompletedItem[]
  projects: Project[]
  openTasks: OpenTask[]
  isPremium: boolean
  savedAt: number
}

interface StoredCache {
  version: 1
  account: string // non-reversible hash of the token (plaintext, for matching)
  iv: string // base64url
  ciphertext: string // base64url — AES-GCM(JSON(payload))
}

/** Stable, non-reversible per-account id derived from the token. */
export async function accountKey(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(buf).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Drop task text — only stats-relevant fields are kept.
export function stripEvent(e: ActivityEvent): ActivityEvent {
  const ed = e.extra_data ?? {}
  return {
    id: e.id,
    event_date: e.event_date,
    event_type: e.event_type,
    object_type: e.object_type,
    object_id: e.object_id,
    parent_project_id: e.parent_project_id,
    parent_item_id: e.parent_item_id,
    extra_data: {
      due_date: ed.due_date,
      last_due_date: ed.last_due_date,
      priority: ed.priority,
      last_priority: ed.last_priority,
      is_recurring: ed.is_recurring,
      has_time: ed.has_time,
      completed_due_date: ed.completed_due_date,
    },
  }
}

export function stripOpenTask(t: OpenTask): OpenTask {
  // Keep ids + timelines (dueDate/isRecurring); drop only the task title.
  return {
    id: t.id,
    content: '',
    project_id: t.project_id,
    priority: t.priority,
    added_at: t.added_at,
    dueDate: t.dueDate,
    isRecurring: t.isRecurring,
  }
}

export function stripCompleted(c: CompletedItem): CompletedItem {
  return {
    id: c.id,
    content: '',
    project_id: c.project_id,
    priority: c.priority,
    added_at: c.added_at,
    completed_at: c.completed_at,
    due: null,
  }
}

/** Merge two lists by `id`, with `incoming` winning on conflicts. */
export function mergeById<T extends { id: string | number }>(existing: T[], incoming: T[]): T[] {
  const m = new Map<string | number, T>()
  for (const x of existing) m.set(x.id, x)
  for (const x of incoming) m.set(x.id, x)
  return [...m.values()]
}

export async function loadCache(
  account: string,
  cacheKey: CryptoKey,
): Promise<CachePayload | undefined> {
  const s = await cacheGet<StoredCache>()
  if (!s || s.version !== 1 || s.account !== account) return undefined
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64uDecode(s.iv) },
      cacheKey,
      b64uDecode(s.ciphertext),
    )
    return JSON.parse(new TextDecoder().decode(pt)) as CachePayload
  } catch {
    return undefined // wrong key / corrupt → treat as no cache
  }
}

export async function saveCache(
  account: string,
  cacheKey: CryptoKey,
  payload: CachePayload,
): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(payload))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cacheKey, data)
  await cacheSet<StoredCache>({
    version: 1,
    account,
    iv: b64uEncode(iv),
    ciphertext: b64uEncode(ct),
  })
}
