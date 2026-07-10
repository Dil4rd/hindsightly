<script lang="ts">
  let {
    label,
    value,
    sub = '',
    hint = '',
    accent = false,
    onOpen,
  }: {
    label: string
    value: string | number
    sub?: string
    hint?: string
    accent?: boolean
    onOpen?: () => void
  } = $props()
</script>

{#snippet body()}
  <div class="value">{value}</div>
  <div class="label">{label}</div>
  <!-- Always reserve the sub-line slot so value/label align across cards. -->
  <div class="sub">{sub}</div>
  {#if hint}<div class="tip" role="tooltip">{hint}</div>{/if}
{/snippet}

{#if onOpen}
  <button type="button" class="card clickable" class:accent class:has-hint={hint} onclick={onOpen}>
    {@render body()}
  </button>
{:else}
  <div class="card" class:accent class:has-hint={hint}>
    {@render body()}
  </div>
{/if}

<style>
  .card {
    position: relative;
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    min-height: 6.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.3rem;
    font: inherit;
    color: inherit;
  }
  .card.has-hint {
    cursor: help;
  }
  .card.accent {
    border-color: var(--accent);
  }
  .card.clickable {
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      transform 0.06s ease;
  }
  .card.clickable:hover {
    border-color: var(--accent);
  }
  .card.clickable:active {
    transform: translateY(1px);
  }
  .value {
    font-size: 1.9rem;
    font-weight: 650;
    line-height: 1;
  }
  .label {
    font-size: 0.8rem;
    color: var(--muted);
    text-transform: lowercase;
  }
  .sub {
    font-size: 0.72rem;
    color: var(--accent);
    min-height: 0.9rem; /* reserved even when empty */
  }
  .tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 15rem;
    padding: 0.5rem 0.6rem;
    background: #0e0c0b;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.75rem;
    line-height: 1.3;
    color: var(--fg);
    text-transform: none;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s ease;
    z-index: 10;
  }
  .card:hover .tip {
    opacity: 1;
  }
</style>
