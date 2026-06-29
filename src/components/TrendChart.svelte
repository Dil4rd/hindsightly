<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { TrendSeries } from '../lib/stats/series'

  let { series }: { series: TrendSeries } = $props()

  const OPENED = '#5ac8fa'
  const CLOSED = '#79d18a'

  let el: HTMLDivElement
  let chart: uPlot | undefined

  // Custom-legend hover state (uPlot's own legend is disabled).
  let hover = $state(false)
  let hoverOpened = $state(0)
  let hoverClosed = $state(0)
  let hoverWhen = $state('')

  const toData = (s: TrendSeries): uPlot.AlignedData => [s.t, s.opened, s.closed]

  // All formatting in UTC (daily points sit at UTC midnight; local rendering
  // would show a misleading "1am").
  const fmtDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const fmtWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
  const fmtTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const fmtHover = (ms: number) =>
    series.granularity === 'week'
      ? `Week of ${fmtDate.format(ms)}`
      : `${fmtWeekday.format(ms)}, ${fmtDate.format(ms)} · ${fmtTime.format(ms)} UTC`

  const DAY_SEC = 86_400
  // Whole-day tick increments only (prevents uPlot from placing 2 sub-day ticks
  // on the same calendar day, which produced duplicate labels).
  const AXIS_INCRS = [1, 2, 3, 4, 7, 14, 30, 60, 90, 180, 365].map((d) => d * DAY_SEC)
  // Integer-only y ticks — task counts are whole numbers (no 0.2, 0.4, …).
  const Y_INCRS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]

  // Shade Sat/Sun behind the series (day view only).
  function weekendPlugin(): uPlot.Plugin {
    return {
      hooks: {
        drawClear: (u) => {
          if (series.granularity !== 'day') return
          const xs = u.data[0] as number[]
          if (!xs?.length) return
          const { ctx } = u
          const { left, top, width, height } = u.bbox
          ctx.save()
          ctx.beginPath()
          ctx.rect(left, top, width, height)
          ctx.clip()
          ctx.fillStyle = 'rgba(124, 132, 170, 0.10)'
          for (const sec of xs) {
            const dow = new Date(sec * 1000).getUTCDay()
            if (dow !== 0 && dow !== 6) continue
            const x0 = u.valToPos(sec, 'x', true)
            const x1 = u.valToPos(sec + DAY_SEC, 'x', true)
            ctx.fillRect(x0, top, x1 - x0, height)
          }
          ctx.restore()
        },
      },
    }
  }

  function onCursor(u: uPlot) {
    const idx = u.cursor.idx
    if (idx == null) {
      hover = false
      return
    }
    hover = true
    hoverOpened = (u.data[1][idx] as number) ?? 0
    hoverClosed = (u.data[2][idx] as number) ?? 0
    hoverWhen = fmtHover((u.data[0][idx] as number) * 1000)
  }

  function options(width: number): uPlot.Options {
    return {
      width,
      height: 240,
      // Headroom so the tallest bar isn't at the top edge and the top tick is labeled.
      scales: {
        x: { time: true },
        y: { range: (_u, _min, max) => [0, Math.max(1, Math.ceil(max * 1.15))] },
      },
      legend: { show: false },
      plugins: [weekendPlugin()],
      hooks: { setCursor: [onCursor] },
      // Bars are the markers; the legend shows values on hover.
      cursor: { points: { show: false } },
      series: [
        {},
        // Grouped bars: opened to the right of each tick, closed to the left.
        { stroke: OPENED, fill: OPENED, points: { show: false }, paths: uPlot.paths.bars!({ align: 1, size: [0.45] }) },
        { stroke: CLOSED, fill: CLOSED, points: { show: false }, paths: uPlot.paths.bars!({ align: -1, size: [0.45] }) },
      ],
      axes: [
        {
          stroke: '#9a8f84',
          grid: { stroke: '#2e2823' },
          ticks: { stroke: '#2e2823' },
          incrs: AXIS_INCRS,
          space: 44, // min px per tick (narrow 2-line labels → denser ticks)
          size: 54, // room for two label lines (date + weekday) without clipping
          values: (_u, splits) =>
            splits.map((s) => {
              const ms = s * 1000
              // Day view: date on top, weekday below. Week view: just the date.
              return series.granularity === 'week'
                ? fmtDate.format(ms)
                : `${fmtDate.format(ms)}\n${fmtWeekday.format(ms)}`
            }),
        },
        {
          stroke: '#9a8f84',
          grid: { stroke: '#2e2823' },
          ticks: { stroke: '#2e2823' },
          incrs: Y_INCRS, // integers only
          values: (_u, splits) => splits.map((v) => (v == null ? '' : String(v))),
        },
      ],
    }
  }

  // (Re)build when data identity changes; resize with the container.
  $effect(() => {
    const data = toData(series)
    if (!chart) {
      chart = new uPlot(options(el.clientWidth || 600), data, el)
    } else {
      chart.setData(data)
    }
  })

  $effect(() => {
    const ro = new ResizeObserver(() => chart?.setSize({ width: el.clientWidth, height: 240 }))
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart?.destroy()
      chart = undefined
    }
  })
</script>

<div bind:this={el} class="chart"></div>

<div class="legend">
  <span class="key"><i class="sw" style:background={OPENED}></i>Opened{#if hover}: {hoverOpened}{/if}</span>
  <span class="key"><i class="sw" style:background={CLOSED}></i>Closed{#if hover}: {hoverClosed}{/if}</span>
  {#if hover}<span class="when">{hoverWhen}</span>{/if}
</div>

<style>
  .chart {
    width: 100%;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.82rem;
    min-height: 1.3em;
  }
  .key {
    display: inline-flex;
    align-items: center;
  }
  .sw {
    width: 0.7em;
    height: 0.7em;
    border-radius: 2px;
    margin-right: 0.4em;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  .when {
    color: var(--muted);
  }
</style>
