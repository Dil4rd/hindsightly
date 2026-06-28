<script lang="ts">
  import type { ProjectNode } from '../lib/stats/tree'

  let {
    roots,
    selectedId,
    onSelect,
  }: { roots: ProjectNode[]; selectedId: string | null; onSelect: (id: string | null) => void } =
    $props()
</script>

{#snippet branch(node: ProjectNode, depth: number)}
  <button
    type="button"
    class="node"
    class:active={node.id === selectedId}
    style="padding-left: {depth * 0.9 + 0.6}rem"
    onclick={() => onSelect(node.id)}
  >
    {node.name}
  </button>
  {#each node.children as child (child.id)}
    {@render branch(child, depth + 1)}
  {/each}
{/snippet}

<nav class="tree">
  <button type="button" class="node" class:active={selectedId === null} onclick={() => onSelect(null)}>
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
  .node {
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
  .node:hover {
    background: var(--panel);
  }
  .node.active {
    background: var(--accent);
    color: #fff;
  }
</style>
