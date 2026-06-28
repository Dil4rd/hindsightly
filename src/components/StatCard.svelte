<script lang="ts">
  let {
    label,
    value,
    sub = '',
    hint = '',
    accent = false,
  }: { label: string; value: string | number; sub?: string; hint?: string; accent?: boolean } =
    $props()
</script>

<div class="card" class:accent title={hint}>
  <div class="value">{value}</div>
  <div class="label">{label}</div>
  {#if sub}<div class="sub">{sub}</div>{/if}
</div>

<style>
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.3rem;
    cursor: default;
  }
  .card.accent {
    border-color: var(--accent);
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
  }
</style>
