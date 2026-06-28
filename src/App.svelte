<script lang="ts">
  import Unlock from './components/Unlock.svelte'
  import Dashboard from './components/Dashboard.svelte'

  // The decrypted token lives only here, in memory, for the page's lifetime.
  let token = $state<string | null>(null)
</script>

{#if token}
  <Dashboard {token} onLock={() => (token = null)} />
{:else}
  <Unlock onUnlocked={(t) => (token = t)} />
{/if}
