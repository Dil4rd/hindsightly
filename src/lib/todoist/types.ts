// Shapes from Todoist unified API v1 (only the fields we use).
// Verified live via scripts/inspect-api.mjs.

export interface Project {
  id: string
  name: string
  parent_id: string | null
  child_order: number
  is_archived: boolean
  is_deleted: boolean
  inbox_project?: boolean
  color?: string
}

export type ActivityEventType = 'added' | 'updated' | 'completed' | 'deleted'
export type ActivityObjectType = 'item' | 'project' | 'note'

export interface ActivityExtraData {
  content?: string
  last_content?: string
  // Present only when the due date changed in this event:
  due_date?: string | null
  last_due_date?: string | null
  has_time?: boolean
  // Present only when priority changed in this event:
  priority?: number
  last_priority?: number
  is_recurring?: boolean
  name?: string
}

export interface ActivityEvent {
  id: number
  event_date: string
  event_type: ActivityEventType
  object_type: ActivityObjectType
  object_id: string
  parent_project_id: string | null
  parent_item_id: string | null
  extra_data: ActivityExtraData
}

export interface CompletedItem {
  id: string
  content: string
  project_id: string
  priority: number // 1..4, 4 = highest (UI p1)
  added_at: string
  completed_at: string
  due: unknown | null
}

export interface OpenTask {
  id: string
  content: string
  project_id: string
  priority: number // 1..4, 4 = highest
  added_at: string
  dueDate: string | null // next due (YYYY-MM-DD or datetime); timeline only
  isRecurring: boolean
}

export interface Page<T> {
  results?: T[]
  items?: T[]
  next_cursor?: string | null
}
