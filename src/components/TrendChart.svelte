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

  function options(width: number): uPlot.Options {
    return {
      width,
      height: 240,
      scales: { x: { time: true } },
      legend: { show: true },
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
