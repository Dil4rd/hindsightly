<script lang="ts">
  let {
    label,
    value,
    sub = '',
    accent = false,
  }: { label: string; value: string | number; sub?: string; accent?: boolean } = $props()
</script>

<div class="card" class:accent>
  <div class="value">{value}</div>
  <div class="label">{label}</div>
  {#if sub}<div class="sub">{sub}</div>{/if}
</div>

<style>
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.1rem;
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
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--muted);
    text-transform: lowercase;
  }
  .sub {
    margin-top: 0.25rem;
    font-size: 0.72rem;
    color: var(--accent);
  }
</style>
