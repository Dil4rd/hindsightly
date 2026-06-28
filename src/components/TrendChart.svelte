<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import type { DailySeries } from '../lib/stats/series'

  let { series }: { series: DailySeries } = $props()

  let el: HTMLDivElement
  let chart: uPlot | undefined

  const toData = (s: DailySeries): uPlot.AlignedData => [s.t, s.opened, s.closed]

  // Axis: date-only, 3-letter month, in UTC (daily points sit at UTC midnight,
  // so local rendering would show a misleading "1am"). Time is left off the
  // axis to keep it slim.
  const fmtAxis = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

  // Hover popup: on-demand detail, so it can afford to show the date plus both
  // UTC and local time.
  const fmtHoverDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const fmtUtcTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const fmtLocalTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  })
  const fmtHover = (ms: number) =>
    `${fmtHoverDate.format(ms)} · ${fmtUtcTime.format(ms)} UTC · ${fmtLocalTime.format(ms)}`

  const DAY_SEC = 86_400

  // Shade Sat/Sun columns behind the series so weekend dips read as expected
  // seasonality rather than a real drop. Weekday is by UTC (matches bucketing).
  function weekendPlugin(): uPlot.Plugin {
    return {
      hooks: {
        drawClear: (u) => {
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

  function options(width: number): uPlot.Options {
    return {
      width,
      height: 240,
      scales: { x: { time: true } },
      legend: { show: true },
      plugins: [weekendPlugin()],
      series: [
        // Hover readout: full date + both UTC and local time (on-demand detail).
        { value: (_u, v) => (v == null ? '' : fmtHover(v * 1000)) },
        { label: 'Opened', stroke: '#5ac8fa', width: 2, points: { show: false } },
        { label: 'Closed', stroke: '#79d18a', width: 2, points: { show: false } },
      ],
      axes: [
        {
          stroke: '#9a8f84',
          grid: { stroke: '#2e2823' },
          ticks: { stroke: '#2e2823' },
          values: (_u, splits) => splits.map((s) => fmtAxis.format(s * 1000)),
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
</style>
