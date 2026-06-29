<script lang="ts">
  import { untrack } from 'svelte'
  import { TodoistClient } from '../lib/todoist/client'
  import type { ActivityEvent, CompletedItem, Project } from '../lib/todoist/types'
  import { presetWindow, type Filters, type TimePreset } from '../lib/stats/filters'
  import { computeMetrics } from '../lib/stats/metrics'
  import { granularityFor, trendSeries } from '../lib/stats/series'
  import { computeInsights } from '../lib/stats/insights'
  import { buildTree, descendantIds } from '../lib/stats/tree'
  import {
    accountKey,
    loadCache,
    mergeById,
    saveCache,
    stripCompleted,
    stripEvent,
  } from '../lib/todoist/cache'
  import StatCard from './StatCard.svelte'
  import ProjectTree from './ProjectTree.svelte'
  import TrendChart from './TrendChart.svelte'
  import InsightList from './InsightList.svelte'
  import Logo from './Logo.svelte'

  let { token, cacheKey, onLock }: { token: string; cacheKey: CryptoKey; onLock: () => void } =
    $props()

  const now = new Date()
  const client = $derived(new TodoistClient(token))

  // filters
  let preset = $state<TimePreset>('week')
  let priority = $state<number | null>(null)
  let selectedProjectId = $state<string | null>(null)

  // data
  let projects = $state<Project[]>([])
  let events = $state<ActivityEvent[]>([])
  let completed = $state<CompletedItem[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  // sync bookkeeping (non-reactive)
  let reqId = 0
  let fetchedSince: number | null = null // earliest event ms held in memory
  let account = ''
  let hydrated = false
  let toppedUp = false
  let projectsFetched = false

  // Re-runs only on preset change; untrack() keeps sync()'s state reads from
  // becoming dependencies (which would loop).
  $effect(() => {
    const p = preset
    untrack(() => void sync(p))
  })

  const newest = <T,>(arr: T[], f: (x: T) => string): number =>
    arr.reduce((m, x) => Math.max(m, Date.parse(f(x)) || 0), 0)

  async function persist() {
    if (fetchedSince == null || !account) return
    try {
      await saveCache(account, cacheKey, { fetchedSince, events, completed, projects, savedAt: Date.now() })
    } catch {
      /* cache is best-effort */
    }
  }

  async function sync(p: TimePreset) {
    const id = ++reqId
    loading = true
    error = null
    try {
      // 1) Hydrate from the encrypted cache once (instant on reload).
      if (!hydrated) {
        hydrated = true
        account = await accountKey(token)
        const c = await loadCache(account, cacheKey)
        if (c) {
          events = c.events
          completed = c.completed
          projects = c.projects
          fetchedSince = c.fetchedSince
        }
      }

      // 2) Refresh projects once per session (keeps the tree current).
      if (!projectsFetched) {
        projectsFetched = true
        projects = await client.listProjects()
      }

      // 3) Top-up activity newer than what we have (once per session).
      if (!toppedUp && fetchedSince != null) {
        toppedUp = true
        const evFrom = newest(events, (e) => e.event_date) || fetchedSince
        const cpFrom = newest(completed, (c) => c.completed_at) || fetchedSince
        const [ev, cp] = await Promise.all([
          client.listActivities(new Date(evFrom)),
          client.listCompleted(new Date(cpFrom), now),
        ])
        events = mergeById(events, ev.map(stripEvent))
        completed = mergeById(completed, cp.map(stripCompleted))
      }

      // 4) Extend the range when the window reaches earlier than fetched.
      const { since, until } = presetWindow(p, now)
      const sinceMs = since.getTime()
      if (fetchedSince == null || sinceMs < fetchedSince) {
        toppedUp = true // a full fetch already includes the newest events
        const [ev, cp] = await Promise.all([
          client.listActivities(since),
          client.listCompleted(since, until),
        ])
        events = mergeById(events, ev.map(stripEvent))
        completed = mergeById(completed, cp.map(stripCompleted))
        fetchedSince = sinceMs
      }

      if (id !== reqId) return
      await persist()
    } catch (e) {
      if (id !== reqId) return
      error = e instanceof Error ? e.message : String(e)
    } finally {
      if (id === reqId) loading = false
    }
  }

  function refresh() {
    toppedUp = false // force a fresh top-up
    void sync(preset)
  }

  const win = $derived(presetWindow(preset, now))
  const filters = $derived<Filters>({
    since: win.since,
    until: win.until,
    projectIds: selectedProjectId ? descendantIds(projects, selectedProjectId) : null,
    priority,
  })
  const metrics = $derived(computeMetrics(events, completed, filters))
  const granularity = $derived(granularityFor(preset))
  const series = $derived(trendSeries(events, filters, granularity))
  const tree = $derived(buildTree(projects))
  const hasData = $derived(
    Object.values(metrics.counts).some((n) => n > 0) || metrics.meanTimeToCompleteMs != null,
  )
  const insights = $derived(computeInsights(events, completed, projects, filters))

  const PRESETS: TimePreset[] = ['week', 'month', 'quarter', 'year']
  const PRIORITIES: { label: string; value: number | null }[] = [
    { label: 'All', value: null },
    { label: 'P1', value: 4 },
    { label: 'P2', value: 3 },
    { label: 'P3', value: 2 },
    { label: 'P4', value: 1 },
  ]

  function fmtDuration(ms: number | null): string {
    if (ms == null) return '—'
    const h = ms / 3_600_000
    return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`
  }
</script>

<div class="dashboard">
  <header>
    <h1><span class="logo"><Logo size={22} /></span> Hindsightly</h1>
    <div class="actions">
      <button class="ghost" onclick={refresh} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
      <button class="ghost" onclick={onLock}>Lock</button>
    </div>
  </header>

  <div class="controls">
    <div class="seg">
      {#each PRESETS as p (p)}
        <button class:active={preset === p} onclick={() => (preset = p)}>{p}</button>
      {/each}
    </div>
    <div class="seg">
      {#each PRIORITIES as pr (pr.label)}
        <button class:active={priority === pr.value} onclick={() => (priority = pr.value)}>{pr.label}</button>
      {/each}
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <p class="status" aria-live="polite">
    {#if loading}
      <span class="spinner" aria-hidden="true"></span>
      Loading &amp; analyzing the last {preset}…
    {:else}
      {events.length.toLocaleString()} events · {completed.length.toLocaleString()} completed ·
      {projects.length} projects
    {/if}
  </p>

  <div class="layout" class:dim={loading}>
    <aside>
      <h2>Projects</h2>
      <ProjectTree roots={tree} selectedId={selectedProjectId} onSelect={(id) => (selectedProjectId = id)} />
    </aside>

    <main>
      <section class="cards">
        <StatCard label="opened" value={metrics.counts.opened} hint="Tasks created in this window." />
        <StatCard
          label="closed"
          value={metrics.counts.closed}
          sub={metrics.recurringClosed ? `${metrics.recurringClosed} recurring` : ''}
          hint="Tasks completed (checked off), including recurring-task occurrences."
          accent={metrics.counts.closed > 0}
        />
        <StatCard
          label="postponed"
          value={metrics.counts.postponed}
          hint="A task's due date moved to a LATER day."
        />
        <StatCard
          label="rescheduled"
          value={metrics.counts.rescheduled}
          hint="A task's due date moved to an EARLIER day."
        />
        <StatCard
          label="scheduled"
          value={metrics.counts.scheduled}
          hint="A due date was added to a task that had none."
        />
        <StatCard
          label="unscheduled"
          value={metrics.counts.unscheduled}
          hint="A task's due date was removed (set to no date)."
        />
        <StatCard
          label="reprioritized"
          value={metrics.counts.reprioritized}
          hint="A task's priority (P1–P4) was changed."
        />
        <StatCard
          label="mean time to complete"
          value={fmtDuration(metrics.meanTimeToCompleteMs)}
          hint="Average time from creation to completion (non-recurring tasks)."
        />
      </section>

      <section class="chart-wrap">
        <h2>Opened vs. closed per {granularity === 'week' ? 'week' : 'day'}</h2>
        {#if hasData}
          <TrendChart {series} />
        {:else}
          <p class="empty">No activity in this period.</p>
        {/if}
      </section>

      {#if hasData}
        <section class="insights-wrap">
          <h2>Insights</h2>
          <InsightList {insights} />
        </section>
      {/if}
    </main>
  </div>
</div>

<style>
  .dashboard {
    max-width: 72rem;
    margin: 1.5rem auto;
    padding: 0 1.25rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .logo {
    display: inline-flex;
    color: var(--accent);
  }
  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin: 0 0 0.6rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  button.ghost {
    background: none;
    color: var(--fg);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0 1.25rem;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    background: var(--panel);
    color: var(--fg);
    border: none;
    border-radius: 0;
    padding: 0.45rem 0.8rem;
    font-size: 0.85rem;
    text-transform: capitalize;
  }
  .seg button.active {
    background: var(--accent);
    color: #fff;
  }
  .status {
    margin: 0 0 1rem;
    font-size: 0.82rem;
    color: var(--muted);
    min-height: 1.2em;
  }
  .spinner {
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    margin-right: 0.4em;
    border: 2px solid var(--muted);
    border-top-color: transparent;
    border-radius: 50%;
    vertical-align: -0.1em;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .layout {
    display: grid;
    grid-template-columns: 14rem 1fr;
    gap: 1.5rem;
    align-items: start;
    transition: opacity 0.15s ease;
  }
  .layout.dim {
    opacity: 0.4;
  }
  aside {
    position: sticky;
    top: 1rem;
    max-height: 80vh;
    overflow: auto;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.75rem;
  }
  .chart-wrap {
    margin-top: 1.5rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    margin: 0;
    color: var(--muted);
  }
  .insights-wrap {
    margin-top: 1.5rem;
  }
  @media (max-width: 640px) {
    .layout {
      grid-template-columns: 1fr;
    }
    aside {
      position: static;
      max-height: none;
    }
  }
</style>
