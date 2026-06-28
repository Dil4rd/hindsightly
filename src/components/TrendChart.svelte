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
      scales: { x: { time: true } },
      legend: { show: false },
      plugins: [weekendPlugin()],
      hooks: { setCursor: [onCursor] },
      cursor: { points: { show: true } },
      series: [
        {},
        { stroke: OPENED, width: 2, points: { show: false } },
        { stroke: CLOSED, width: 2, points: { show: false } },
      ],
      axes: [
        {
          stroke: '#9a8f84',
          grid: { stroke: '#2e2823' },
          ticks: { stroke: '#2e2823' },
          values: (_u, splits) => splits.map((s) => fmtDate.format(s * 1000)),
        },
        { stroke: '#9a8f84', grid: { stroke: '#2e2823' }, ticks: { stroke: '#2e2823' } },
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
