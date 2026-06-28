<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { TrendSeries } from '../lib/stats/series'

  let { series }: { series: TrendSeries } = $props()

  let el: HTMLDivElement
  let chart: uPlot | undefined

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

  // Compact hover readout: weekday + date + UTC time (day view), or the week's
  // start (week view). Shown only while hovering.
  const fmtHover = (ms: number) =>
    series.granularity === 'week'
      ? `Week of ${fmtDate.format(ms)}`
      : `${fmtWeekday.format(ms)}, ${fmtDate.format(ms)} · ${fmtTime.format(ms)} UTC`

  const DAY_SEC = 86_400

  // Shade Sat/Sun behind the series (day view only) so weekend dips read as
  // seasonality, not a real drop.
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

  // Keep the color key visible always; reveal the live values + date only while
  // hovering (CSS toggles on this class).
  function toggleLegend(u: uPlot) {
    const leg = u.root.querySelector('.u-legend') as HTMLElement | null
    if (leg) leg.classList.toggle('u-hovering', u.cursor.idx != null)
  }

  function options(width: number): uPlot.Options {
    return {
      width,
      height: 240,
      scales: { x: { time: true } },
      legend: { show: true },
      plugins: [weekendPlugin()],
      hooks: { setCursor: [toggleLegend], ready: [toggleLegend] },
      series: [
        { label: '', value: (_u, v) => (v == null ? '' : fmtHover(v * 1000)) },
        { label: 'Opened', stroke: '#5ac8fa', width: 2, points: { show: false } },
        { label: 'Closed', stroke: '#79d18a', width: 2, points: { show: false } },
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

<style>
  .chart {
    width: 100%;
  }
  /* Center the legend; always show the color key (markers + labels), but hide
     the live values (numbers) and the x/date cell until hovering. */
  :global(.u-legend) {
    margin: 0.4rem auto 0;
  }
  :global(.u-legend .u-value) {
    visibility: hidden;
  }
  :global(.u-legend.u-hovering .u-value) {
    visibility: visible;
  }
</style>
