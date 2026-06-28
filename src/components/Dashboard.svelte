<script lang="ts">
  import { onMount } from 'svelte'
  import { TodoistClient } from '../lib/todoist/client'
  import type { ActivityEvent, CompletedItem, Project } from '../lib/todoist/types'
  import { presetWindow, type Filters, type TimePreset } from '../lib/stats/filters'
  import { computeMetrics } from '../lib/stats/metrics'
  import { dailySeries } from '../lib/stats/series'
  import { buildTree, descendantIds } from '../lib/stats/tree'
  import StatCard from './StatCard.svelte'
  import ProjectTree from './ProjectTree.svelte'
  import TrendChart from './TrendChart.svelte'

  let { token, onLock }: { token: string; onLock: () => void } = $props()

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

  let reqId = 0

  // Projects load once.
  onMount(async () => {
    try {
      projects = await client.listProjects()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  })

  // Activity + completed refetch when the time window changes. Only `preset` is
  // read synchronously here, so this effect re-runs solely on preset change.
  $effect(() => {
    const p = preset
    void loadActivity(p)
  })

  async function loadActivity(p: TimePreset) {
    const id = ++reqId
    loading = true
    error = null
    try {
      const { since, until } = presetWindow(p, now)
      const [ev, cp] = await Promise.all([client.listActivities(since), client.listCompleted(since, until)])
      if (id !== reqId) return
      events = ev
      completed = cp
    } catch (e) {
      if (id !== reqId) return
      error = e instanceof Error ? e.message : String(e)
    } finally {
      if (id === reqId) loading = false
    }
  }

  const win = $derived(presetWindow(preset, now))
  const filters = $derived<Filters>({
    since: win.since,
    until: win.until,
    projectIds: selectedProjectId ? descendantIds(projects, selectedProjectId) : null,
    priority,
  })
  const metrics = $derived(computeMetrics(events, completed, filters))
  const series = $derived(dailySeries(events, filters))
  const tree = $derived(buildTree(projects))

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
    <h1>Todoist Stats</h1>
    <div class="actions">
      <button class="ghost" onclick={() => loadActivity(preset)} disabled={loading}>
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

  <div class="layout">
    <aside>
      <h2>Projects</h2>
      <ProjectTree roots={tree} selectedId={selectedProjectId} onSelect={(id) => (selectedProjectId = id)} />
    </aside>

    <main>
      <section class="cards">
        <StatCard label="opened" value={metrics.counts.opened} />
        <StatCard label="closed" value={metrics.counts.closed} accent />
        <StatCard label="postponed" value={metrics.counts.postponed} />
        <StatCard label="rescheduled" value={metrics.counts.rescheduled} />
        <StatCard label="scheduled" value={metrics.counts.scheduled} />
        <StatCard label="unscheduled" value={metrics.counts.unscheduled} />
        <StatCard label="reprioritized" value={metrics.counts.reprioritized} />
        <StatCard label="mean time to complete" value={fmtDuration(metrics.meanTimeToCompleteMs)} />
      </section>

      <section class="chart-wrap">
        <h2>Opened vs. closed per day</h2>
        <TrendChart {series} />
      </section>
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
  .layout {
    display: grid;
    grid-template-columns: 14rem 1fr;
    gap: 1.5rem;
    align-items: start;
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
