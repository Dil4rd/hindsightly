<script lang="ts">
  import type { Label } from '../lib/todoist/types'

  let {
    labels,
    selected,
    onToggle,
  }: {
    labels: Label[]
    selected: Set<string>
    onToggle: (id: string) => void
  } = $props()

  // Selected first, then alphabetical — the picked ones stay easy to find.
  const sorted = $derived(
    [...labels].sort((a, b) => {
      const sa = selected.has(a.id) ? 0 : 1
      const sb = selected.has(b.id) ? 0 : 1
      return sa - sb || a.name.localeCompare(b.name)
    }),
  )
</script>

<div class="pick">
  <p class="head">Which labels mean “waiting-for”?</p>
  <p class="sub">Tags you put on tasks you’ve delegated or are blocked on.</p>
  {#if labels.length === 0}
    <p class="empty">No labels in this account yet.</p>
  {:else}
    <div class="chips">
      {#each sorted as l (l.id)}
        <button
          type="button"
          class="chip"
          class:on={selected.has(l.id)}
          aria-pressed={selected.has(l.id)}
          onclick={() => onToggle(l.id)}
        >
          {selected.has(l.id) ? '✓ ' : ''}{l.name}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .pick {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .head {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .sub {
    margin: 0 0 0.25rem;
    font-size: 0.72rem;
    color: var(--muted);
    line-height: 1.3;
  }
  .empty {
    margin: 0.25rem 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .chip {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.28rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
