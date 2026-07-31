<script lang="ts">
  import { untrack } from 'svelte'
  import { TodoistClient } from '../lib/todoist/client'
  import type { ActivityEvent, CompletedItem, Label, OpenTask, Project } from '../lib/todoist/types'
  import { presetWindow, type Filters, type TimePreset } from '../lib/stats/filters'
  import { computeMetrics, metricBreakdown } from '../lib/stats/metrics'
  import { taskNameIndex } from '../lib/stats/names'
  import { METRIC_BUCKETS, type MetricBucket } from '../lib/stats/types'
  import { granularityFor, trendSeries } from '../lib/stats/series'
  import { computeInsights, type Insight } from '../lib/stats/insights'
  import type { DrawerPanel } from '../lib/ui'
  import { buildTree, descendantIds } from '../lib/stats/tree'
  import {
    accountKey,
    loadCache,
    mergeById,
    saveCache,
    stripCompleted,
    stripEvent,
    stripOpenTask,
  } from '../lib/todoist/cache'
  import { loadSettings, saveSettings } from '../lib/todoist/settings'
  import { WAITING_LABELS } from '../lib/config'
  import StatCard from './StatCard.svelte'
  import ProjectTree from './ProjectTree.svelte'
  import LabelPicker from './LabelPicker.svelte'
  import TrendChart from './TrendChart.svelte'
  import InsightList from './InsightList.svelte'
  import DetailDrawer from './DetailDrawer.svelte'
  import Logo from './Logo.svelte'
  import ThemeToggle from './ThemeToggle.svelte'

  let {
    token,
    cacheKey,
    theme,
    onToggleTheme,
    onLock,
  }: {
    token: string
    cacheKey: CryptoKey
    theme: 'dark' | 'light'
    onToggleTheme: () => void
    onLock: () => void
  } = $props()

  const now = new Date()
  const client = $derived(new TodoistClient(token))

  // filters
  let preset = $state<TimePreset>('week')
  let priority = $state<number | null>(null)
  let selectedProjectId = $state<string | null>(null)
  let selectedPanel = $state<DrawerPanel | null>(null)
  let projOpen = $state(false)
  let labelsOpen = $state(false)

  // data
  let projects = $state<Project[]>([])
  let events = $state<ActivityEvent[]>([])
  let completed = $state<CompletedItem[]>([])
  let openTasks = $state<OpenTask[]>([])
  let labels = $state<Label[]>([]) // account's labels, for the waiting-for picker
  let waitingLabelIds = $state<string[]>([]) // labels the user maps to "waiting-for"
  let isPremium = $state(true) // assume Pro until detected (avoids flashing disabled)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // sync bookkeeping (non-reactive)
  let reqId = 0
  let fetchedSince: number | null = null // earliest event ms held in memory
  let account = ''
  let hydrated = false
  let toppedUp = false
  let snapshotFetched = false
  let hadSavedSettings = false // did the user already pick waiting-for labels?

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
      // Strip task text only at rest; full content stays in memory for the
      // insight drawer this session.
      await saveCache(account, cacheKey, {
        fetchedSince,
        events: events.map(stripEvent),
        completed: completed.map(stripCompleted),
        projects,
        openTasks: openTasks.map(stripOpenTask),
        isPremium,
        savedAt: Date.now(),
      })
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
          openTasks = c.openTasks ?? []
          isPremium = c.isPremium ?? true
          fetchedSince = c.fetchedSince
        }
        // User settings (waiting-for label ids) — encrypted, per account.
        const st = await loadSettings(account, cacheKey)
        if (st) {
          waitingLabelIds = st.waitingLabelIds
          hadSavedSettings = true
        }
      }

      // 2) Refresh current snapshots (projects, open tasks, labels, plan) once per session.
      if (!snapshotFetched) {
        snapshotFetched = true
        const [pj, ot, premium, lb] = await Promise.all([
          client.listProjects(),
          client.listOpenTasks(),
          client.isPremium(),
          client.listLabels(),
        ])
        projects = pj
        openTasks = ot
        isPremium = premium
        labels = lb
        // First run only: seed the waiting-for selection from the env default
        // names (VITE_WAITING_LABELS). After that the saved selection wins.
        if (!hadSavedSettings && waitingLabelIds.length === 0) {
          waitingLabelIds = lb.filter((l) => WAITING_LABELS.has(l.name.toLowerCase())).map((l) => l.id)
        }
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
        events = mergeById(events, ev) // keep full content in memory
        completed = mergeById(completed, cp)
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
        events = mergeById(events, ev) // keep full content in memory
        completed = mergeById(completed, cp)
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
  // Resolve the picked label IDS → current lowercased names (task.labels are
  // names, not ids). Done live so a rename doesn't strand the selection.
  const labelsById = $derived(new Map(labels.map((l) => [l.id, l.name])))
  const selectedLabelSet = $derived(new Set(waitingLabelIds))
  const waitingLabelNames = $derived(
    new Set(
      waitingLabelIds
        .map((id) => labelsById.get(id))
        .filter((n): n is string => !!n)
        .map((n) => n.toLowerCase()),
    ),
  )
  const insights = $derived(
    computeInsights(events, completed, projects, openTasks, filters, undefined, waitingLabelNames),
  )
  const selectedProject = $derived(
    selectedProjectId ? (projects.find((p) => p.id === selectedProjectId) ?? null) : null,
  )
  const subCount = $derived(
    selectedProjectId ? descendantIds(projects, selectedProjectId).size - 1 : 0,
  )
  const projLabel = $derived(
    selectedProject
      ? `${selectedProject.name} · ${subCount} subproject${subCount === 1 ? '' : 's'}`
      : 'All projects',
  )
  const breakdown = $derived(metricBreakdown(events, filters))
  // Shared name resolver — the ONLY sanctioned way to turn a task id into a
  // title (the cache is name-free; see taskNameIndex).
  const nameById = $derived(taskNameIndex(events, completed, openTasks))

  // Display label + tooltip per metric; the title is reused in the drill-down drawer.
  const METRIC_META: Record<MetricBucket, { title: string; hint: string }> = {
    opened: { title: 'Opened', hint: 'Tasks created in this window.' },
    closed: {
      title: 'Closed',
      hint: 'Tasks completed (checked off), including recurring-task occurrences.',
    },
    postponed: { title: 'Postponed', hint: "A task's due date moved to a LATER day." },
    rescheduled: { title: 'Rescheduled', hint: "A task's due date moved to an EARLIER day." },
    scheduled: { title: 'Scheduled', hint: 'A due date was added to a task that had none.' },
    unscheduled: { title: 'Unscheduled', hint: "A task's due date was removed (set to no date)." },
    reprioritized: { title: 'Reprioritized', hint: "A task's priority (P1–P4) was changed." },
  }

  const NOTE = 'Opens in Todoist. Task titles show for this session only.'
  const fmtDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const taskHref = (id: string) => `https://app.todoist.com/app/task/${id}`
  const fmtRange = (first: string, last: string) => {
    const a = fmtDay.format(Date.parse(first))
    const b = fmtDay.format(Date.parse(last))
    return a === b ? a : `${a}–${b}`
  }

  function openMetric(b: MetricBucket) {
    // Dedupe to one row per task (a task can appear once per event); show its
    // frequency + date span. Most-frequent first — the chronic offenders.
    const byId = new Map<string, { count: number; first: string; last: string }>()
    for (const it of breakdown[b]) {
      const g = byId.get(it.objectId) ?? { count: 0, first: it.eventDate, last: it.eventDate }
      g.count++
      if (it.eventDate < g.first) g.first = it.eventDate
      if (it.eventDate > g.last) g.last = it.eventDate
      byId.set(it.objectId, g)
    }
    selectedPanel = {
      title: METRIC_META[b].title,
      detail: METRIC_META[b].hint,
      items: [...byId.entries()]
        .sort((a, z) => z[1].count - a[1].count)
        .map(([id, g]) => ({
          id,
          label: nameById.get(id) || undefined,
          meta: g.count > 1 ? `${g.count}× · ${fmtRange(g.first, g.last)}` : fmtDay.format(Date.parse(g.last)),
          href: taskHref(id),
        })),
      note: NOTE,
    }
  }

  function toggleWaiting(id: string) {
    waitingLabelIds = waitingLabelIds.includes(id)
      ? waitingLabelIds.filter((x) => x !== id)
      : [...waitingLabelIds, id]
    void persistSettings()
  }

  async function persistSettings() {
    if (!account) return
    try {
      await saveSettings(account, cacheKey, { waitingLabelIds: [...waitingLabelIds] })
    } catch {
      /* settings are best-effort */
    }
  }

  function openInsight(i: Insight) {
    selectedPanel = {
      title: i.title,
      detail: i.detail,
      docId: i.docId,
      items: i.items ?? [],
      note: NOTE,
    }
  }

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

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      projOpen = false
      labelsOpen = false
    }
  }}
/>

<div class="dashboard">
  <header>
    <h1><span class="logo"><Logo size={22} /></span> Hindsightly</h1>
    <div class="actions">
      <ThemeToggle {theme} onToggle={onToggleTheme} />
      <button class="ghost" onclick={refresh} disabled={loading}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
      <button class="ghost" onclick={onLock}>Lock</button>
    </div>
  </header>

  <div class="controls">
    <div class="seg">
      {#each PRESETS as p (p)}
        <button
          class:active={preset === p}
          disabled={!isPremium && p !== 'week'}
          title={!isPremium && p !== 'week'
            ? 'Requires Todoist Pro — free accounts keep only 7 days of activity'
            : ''}
          onclick={() => (preset = p)}
        >
          {p}
        </button>
      {/each}
    </div>
    <div class="seg">
      {#each PRIORITIES as pr (pr.label)}
        <button class:active={priority === pr.value} onclick={() => (priority = pr.value)}>{pr.label}</button>
      {/each}
    </div>

    <div class="proj-picker">
      <button
        class="proj-btn"
        class:active={selectedProjectId !== null}
        aria-haspopup="true"
        aria-expanded={projOpen}
        onclick={() => {
          projOpen = !projOpen
          labelsOpen = false
        }}
      >
        <span class="proj-label">{projLabel}</span><span class="caret">▾</span>
      </button>
      {#if projOpen}
        <div class="proj-overlay" role="presentation" onclick={() => (projOpen = false)}></div>
        <div class="proj-pop">
          <ProjectTree
            roots={tree}
            selectedId={selectedProjectId}
            onSelect={(id) => {
              selectedProjectId = id
              projOpen = false
            }}
          />
        </div>
      {/if}
    </div>

    <div class="proj-picker">
      <button
        class="proj-btn"
        class:active={waitingLabelIds.length > 0}
        aria-haspopup="true"
        aria-expanded={labelsOpen}
        title="Pick which labels mark a task as a GTD 'waiting-for'"
        onclick={() => {
          labelsOpen = !labelsOpen
          projOpen = false
        }}
      >
        <span class="proj-label"
          >Waiting-for: {waitingLabelIds.length > 0 ? waitingLabelIds.length : 'off'}</span
        ><span class="caret">▾</span>
      </button>
      {#if labelsOpen}
        <div class="proj-overlay" role="presentation" onclick={() => (labelsOpen = false)}></div>
        <div class="proj-pop">
          <LabelPicker {labels} selected={selectedLabelSet} onToggle={toggleWaiting} />
        </div>
      {/if}
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
    <main>
      {#if hasData}
        <section class="insights-wrap">
          <h2>Insights</h2>
          <InsightList {insights} scoped={selectedProjectId !== null} onSelect={openInsight} />
        </section>
      {/if}

      <details class="general" open>
        <summary>Metrics</summary>

        <section class="cards">
          {#each METRIC_BUCKETS as b (b)}
            <StatCard
              label={b}
              value={metrics.counts[b]}
              hint={METRIC_META[b].hint}
              sub={b === 'closed' && metrics.recurringClosed ? `${metrics.recurringClosed} recurring` : ''}
              accent={b === 'closed' && metrics.counts.closed > 0}
              onOpen={metrics.counts[b] > 0 ? () => openMetric(b) : undefined}
            />
          {/each}
          <StatCard
            label="mean time to complete"
            value={fmtDuration(metrics.meanTimeToCompleteMs)}
            hint="Average time from creation to completion (non-recurring tasks)."
          />
        </section>

        <section class="chart-wrap">
          <h2>Opened vs. closed per {granularity === 'week' ? 'week' : 'day'}</h2>
          {#if hasData}
            <TrendChart {series} {theme} />
          {:else}
            <p class="empty">No activity in this period.</p>
          {/if}
        </section>
      </details>
    </main>
  </div>

  <DetailDrawer panel={selectedPanel} onClose={() => (selectedPanel = null)} />
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
  .seg button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    transition: opacity 0.15s ease;
  }
  .layout.dim {
    opacity: 0.4;
  }
  .proj-picker {
    position: relative;
  }
  .proj-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 18rem;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.45rem 0.7rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .proj-btn.active {
    border-color: var(--accent);
    color: var(--accent);
  }
  .proj-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proj-btn .caret {
    flex: 0 0 auto;
    color: var(--muted);
    font-size: 0.7rem;
  }
  .proj-overlay {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
  .proj-pop {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 21;
    min-width: 15rem;
    max-width: 22rem;
    max-height: 60vh;
    overflow: auto;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.5rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
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
    margin-top: 0;
  }
  .general {
    margin-top: 1.5rem;
  }
  .general > summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    list-style: none;
    user-select: none;
    margin-bottom: 0.6rem;
  }
  .general > summary::-webkit-details-marker {
    display: none;
  }
  .general > summary::before {
    content: '▾';
    font-size: 0.9em;
    transition: transform 0.15s;
  }
  .general:not([open]) > summary::before {
    transform: rotate(-90deg);
  }
</style>
