<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { INSIGHTS_DOC_URL } from '../lib/config'
  import type { DrawerPanel } from '../lib/ui'

  let { panel, onClose }: { panel: DrawerPanel | null; onClose: () => void } = $props()

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && panel) onClose()
  }
</script>

<svelte:window onkeydown={onKey} />

{#if panel}
  <div class="overlay" transition:fade={{ duration: 120 }} onclick={onClose} role="presentation"></div>
  <div class="drawer" transition:fly={{ x: 340, duration: 160 }} role="dialog" aria-modal="true" aria-label={panel.title}>
    <header>
      <strong>{panel.title}</strong>
      <div class="actions">
        {#if panel.docId}
          <a
            class="info"
            href={`${INSIGHTS_DOC_URL}#${panel.docId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="How this works"
            aria-label="How this works">ⓘ</a
          >
        {/if}
        <button class="close" onclick={onClose} aria-label="Close">×</button>
      </div>
    </header>
    {#if panel.detail}<p class="detail">{panel.detail}</p>{/if}

    {#if panel.items.length}
      <ul>
        {#each panel.items as it, i (i)}
          <li>
            <a href={it.href} target="_blank" rel="noopener noreferrer">{it.label ?? 'Open task'}</a>
            {#if it.meta}<span class="meta">{it.meta}</span>{/if}
          </li>
        {/each}
      </ul>
      {#if panel.note}<p class="hint">{panel.note}</p>{/if}
    {:else}
      <p class="hint">Nothing to show.</p>
    {/if}
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 40;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(22rem, 90vw);
    height: 100vh;
    overflow-y: auto;
    background: var(--panel);
    border-left: 1px solid var(--border);
    padding: 1.2rem;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }
  header strong {
    font-size: 1rem;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 0 0 auto;
  }
  .info {
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1;
    opacity: 0.7;
  }
  .info:hover {
    opacity: 1;
    color: var(--accent);
    text-decoration: none;
  }
  .close {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .detail {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
    line-height: 1.4;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.45rem 0.5rem;
    border-radius: 6px;
  }
  li:hover {
    background: var(--bg);
  }
  a {
    color: var(--fg);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  a:hover {
    text-decoration: underline;
  }
  .meta {
    flex: 0 0 auto;
    font-size: 0.75rem;
    color: var(--accent);
  }
  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.72rem;
    color: var(--muted);
  }
</style>
