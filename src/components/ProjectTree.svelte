<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity'
  import type { ProjectNode } from '../lib/stats/tree'

  let {
    roots,
    selectedId,
    onSelect,
  }: { roots: ProjectNode[]; selectedId: string | null; onSelect: (id: string | null) => void } =
    $props()

  // Collapsed node ids (expanded by default).
  const collapsed = new SvelteSet<string>()
  const toggle = (id: string) => (collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id))
</script>

{#snippet branch(node: ProjectNode, depth: number)}
  <div class="row" style="padding-left: {depth * 0.9}rem">
    {#if node.children.length}
      <button
        class="chev"
        aria-label={collapsed.has(node.id) ? 'Expand' : 'Collapse'}
        onclick={() => toggle(node.id)}
      >
        {collapsed.has(node.id) ? '▸' : '▾'}
      </button>
    {:else}
      <span class="chev"></span>
    {/if}
    <button class="node" class:active={node.id === selectedId} onclick={() => onSelect(node.id)}>
      {node.name}
    </button>
  </div>
  {#if node.children.length && !collapsed.has(node.id)}
    {#each node.children as child (child.id)}
      {@render branch(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<nav class="tree">
  <button type="button" class="node all" class:active={selectedId === null} onclick={() => onSelect(null)}>
    All projects
  </button>
  {#each roots as r (r.id)}
    {@render branch(r, 0)}
  {/each}
</nav>

<style>
  .tree {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .row {
    display: flex;
    align-items: center;
  }
  .chev {
    flex: 0 0 1.1rem;
    width: 1.1rem;
    background: none;
    border: none;
    color: var(--muted);
    padding: 0;
    font-size: 0.7rem;
    line-height: 1;
    text-align: center;
    cursor: pointer;
  }
  .node {
    flex: 1 1 auto;
    min-width: 0;
    text-align: left;
    background: none;
    border: none;
    color: var(--fg);
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node.all {
    margin-bottom: 0.15rem;
  }
  .node:hover {
    background: var(--panel);
  }
  .node.active {
    background: var(--accent);
    color: #fff;
  }
</style>
