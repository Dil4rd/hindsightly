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

  // Theme: persisted preference, defaulting to the OS setting.
  function initialTheme(): 'dark' | 'light' {
    try {
      const saved = localStorage.getItem('hindsightly:theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch {
      /* ignore */
    }
    return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }

  let theme = $state<'dark' | 'light'>(initialTheme())

  $effect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('hindsightly:theme', theme)
    } catch {
      /* ignore */
    }
  })

  const toggleTheme = () => (theme = theme === 'dark' ? 'light' : 'dark')
</script>

{#if token && cacheKey}
  <Dashboard {token} {cacheKey} {theme} onToggleTheme={toggleTheme} onLock={lock} />
{:else}
  <Unlock {onUnlocked} {theme} onToggleTheme={toggleTheme} />
{/if}
