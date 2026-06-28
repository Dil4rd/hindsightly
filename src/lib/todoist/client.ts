// Thin Todoist API client (unified API v1), called directly from the browser.
// Todoist returns `Access-Control-Allow-Origin: *`; a manual Authorization
// header is not a CORS "credential", so `credentials: 'omit'` makes direct
// browser calls work.

import type { ActivityEvent, CompletedItem, Page, Project } from './types'

const BASE = 'https://api.todoist.com'

export class TodoistClient {
  constructor(private readonly token: string) {}

  private async getPage<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<Page<T>> {
    const url = new URL(BASE + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) {
      throw new Error(`Todoist API ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    return (await res.json()) as Page<T>
  }

  /** Follow `next_cursor` until exhausted or `stop(pageItems)` returns true. */
  private async paginate<T>(
    path: string,
    params: Record<string, string | number>,
    pick: (p: Page<T>) => T[],
    stop?: (pageItems: T[]) => boolean,
  ): Promise<T[]> {
    const all: T[] = []
    let cursor: string | null | undefined
    let pages = 0
    const MAX_PAGES = 1000 // safety backstop against a non-advancing cursor
    do {
      const page = await this.getPage<T>(path, cursor ? { ...params, cursor } : params)
      const items = pick(page) ?? []
      all.push(...items)
      if (stop?.(items)) break
      cursor = page.next_cursor
    } while (cursor && ++pages < MAX_PAGES)
    return all
  }

  listProjects(): Promise<Project[]> {
    return this.paginate<Project>('/api/v1/projects', { limit: 200 }, (p) => p.results ?? [])
  }

  /**
   * Item activity events with `event_date >= since`. Events come newest-first,
   * so we page until a page reaches older than the window, then trim.
   */
  async listActivities(since: Date): Promise<ActivityEvent[]> {
    const sinceMs = since.getTime()
    const evs = await this.paginate<ActivityEvent>(
      '/api/v1/activities',
      { limit: 200, object_type: 'item' }, // 200 is the server cap
      (p) => p.results ?? [],
      (items) =>
        items.length > 0 && Date.parse(items[items.length - 1].event_date) < sinceMs,
    )
    return evs.filter((e) => Date.parse(e.event_date) >= sinceMs)
  }

  // NOTE: the completed endpoint caps each request at a ~3-month range; for
  // windows longer than that we'd chunk the [since, until] interval. Default
  // (week/month) is well within the cap.
  listCompleted(since: Date, until: Date): Promise<CompletedItem[]> {
    return this.paginate<CompletedItem>(
      '/api/v1/tasks/completed/by_completion_date',
      { since: since.toISOString(), until: until.toISOString(), limit: 200 },
      (p) => p.items ?? [],
    )
  }
}
