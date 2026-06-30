<script lang="ts">
  import {
    INSIGHT_CATEGORIES,
    INSIGHT_QUESTIONS,
    type Insight,
    type InsightCategory,
  } from '../lib/stats/insights'
  import { INSIGHTS_DOC_URL } from '../lib/config'

  let { insights, onSelect }: { insights: Insight[]; onSelect: (i: Insight) => void } = $props()

  const docUrl = (id: string) => `${INSIGHTS_DOC_URL}#${id}`

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
              <div class="rowwrap">
                {#if ins.items?.length}
                  <button type="button" class="row clickable" onclick={() => onSelect(ins)}>
                    <span class="dot" aria-hidden="true"></span>
                    <span class="text">
                      <strong>{ins.title}</strong>
                      <span class="detail">{ins.detail}</span>
                    </span>
                    <span class="count">{ins.items.length} ›</span>
                  </button>
                {:else}
                  <div class="row">
                    <span class="dot" aria-hidden="true"></span>
                    <span class="text">
                      <strong>{ins.title}</strong>
                      <span class="detail">{ins.detail}</span>
                    </span>
                  </div>
                {/if}
                <a
                  class="info"
                  href={docUrl(ins.docId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="How this insight works"
                  aria-label="How this insight works">ⓘ</a
                >
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
  .rowwrap {
    display: flex;
    align-items: start;
    gap: 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: start;
    flex: 1 1 auto;
    min-width: 0;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    padding: 0;
  }
  .info {
    flex: 0 0 auto;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.85rem;
    line-height: 1.2;
    margin-top: 0.1rem;
    opacity: 0.55;
  }
  .info:hover {
    opacity: 1;
    color: var(--accent);
  }
  button.clickable {
    cursor: pointer;
    border-radius: 8px;
    padding: 0.3rem;
    margin: -0.3rem;
  }
  button.clickable:hover {
    background: var(--bg);
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
    flex: 1 1 auto;
    min-width: 0;
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
  .count {
    flex: 0 0 auto;
    align-self: center;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .none {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
