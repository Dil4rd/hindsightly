<script lang="ts">
  import {
    INSIGHT_CATEGORIES,
    INSIGHT_QUESTIONS,
    type Insight,
    type InsightCategory,
  } from '../lib/stats/insights'

  let { insights }: { insights: Insight[] } = $props()

  const byCat = $derived(
    Object.fromEntries(
      INSIGHT_CATEGORIES.map((c) => [c, insights.filter((i) => i.category === c)]),
    ) as Record<InsightCategory, Insight[]>,
  )
</script>

<div class="insights">
  {#each INSIGHT_CATEGORIES as c (c)}
    <section class="group">
      <h3>{INSIGHT_QUESTIONS[c]}</h3>
      {#if byCat[c].length}
        <ul>
          {#each byCat[c] as ins, i (i)}
            <li class={ins.tone}>
              <span class="dot" aria-hidden="true"></span>
              <div class="text">
                <strong>{ins.title}</strong>
                <span class="detail">{ins.detail}</span>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="none">Not enough data yet.</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .insights {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1rem;
  }
  .group {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.1rem;
  }
  h3 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    color: var(--fg);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  li {
    display: flex;
    gap: 0.6rem;
    align-items: start;
  }
  .dot {
    flex: 0 0 auto;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    margin-top: 0.3rem;
    background: var(--muted);
  }
  li.good .dot {
    background: #79d18a;
  }
  li.warn .dot {
    background: #e4a33a;
  }
  li.info .dot {
    background: #5ac8fa;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  strong {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .detail {
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 1.35;
  }
  .none {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
