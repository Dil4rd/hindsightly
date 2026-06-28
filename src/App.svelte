<script lang="ts">
  import Unlock from './components/Unlock.svelte'
  import Dashboard from './components/Dashboard.svelte'

  // The decrypted token and the cache key live only here, in memory, for the
  // page's lifetime.
  let token = $state<string | null>(null)
  let cacheKey = $state<CryptoKey | null>(null)

  function onUnlocked(t: string, k: CryptoKey) {
    token = t
    cacheKey = k
  }
  function lock() {
    token = null
    cacheKey = null
  }
</script>

{#if token && cacheKey}
  <Dashboard {token} {cacheKey} onLock={lock} />
{:else}
  <Unlock {onUnlocked} />
{/if}
