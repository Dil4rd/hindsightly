// Shared shape for the slide-in detail drawer (used by both insights and the
// clickable metric cards).

export interface DrawerItem {
  id: string
  label?: string // task/project name when known (in-memory only)
  meta?: string // e.g. a date or "4×"
  href: string // deep link into Todoist
}

export interface DrawerPanel {
  title: string
  detail?: string
  docId?: string // if set, show the ⓘ link to docs/INSIGHTS.md#docId
  items: DrawerItem[]
  note?: string // small footnote under the list
}
