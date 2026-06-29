<script lang="ts">
  import {
    enroll,
    hasCredentials,
    loadVault,
    resetVault,
    unlock,
    type Vault,
  } from '../lib/auth/vault'
  import { isWebAuthnAvailable } from '../lib/auth/webauthn'
  import Logo from './Logo.svelte'
  import ThemeToggle from './ThemeToggle.svelte'

  let {
    onUnlocked,
    theme,
    onToggleTheme,
  }: {
    onUnlocked: (token: string, cacheKey: CryptoKey) => void
    theme: 'dark' | 'light'
    onToggleTheme: () => void
  } = $props()

  const supported = isWebAuthnAvailable()

  let vault = $state<Vault | undefined>(undefined)
  let loading = $state(true)
  let busy = $state(false)
  let error = $state<string | null>(null)

  // first-run enrollment fields
  let tokenInput = $state('')
  let label = $state('My passkey')

  $effect(() => {
    loadVault().then((v) => {
      vault = v
      loading = false
    })
  })

  async function run(fn: () => Promise<void>) {
    error = null
    busy = true
    try {
      await fn()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      busy = false
    }
  }

  const doEnroll = () =>
    run(async () => {
      const token = tokenInput.trim()
      // We already hold the plaintext token here — no second ceremony needed;
      // the unlock path is exercised on the next session.
      const { vault: v, cacheKey } = await enroll(
        token,
        label.trim() || 'My passkey',
        new Date().toISOString(),
      )
      vault = v
      onUnlocked(token, cacheKey)
    })

  const doUnlock = () =>
    run(async () => {
      const { token, cacheKey } = await unlock(vault!)
      onUnlocked(token, cacheKey)
    })

  const doReset = () =>
    run(async () => {
      await resetVault()
      vault = undefined
      tokenInput = ''
    })
</script>

<main class="unlock">
  <div class="topbar"><ThemeToggle {theme} onToggle={onToggleTheme} /></div>
  <h1><span class="logo"><Logo size={26} /></span> Hindsightly</h1>

  {#if !supported}
    <p class="error">
      This browser doesn't support WebAuthn. Use a modern browser with a passkey provider.
    </p>
  {:else if loading}
    <p>Loading…</p>
  {:else if hasCredentials(vault)}
    <p>Unlock with your passkey to load your stats.</p>
    <button onclick={doUnlock} disabled={busy}>
      {busy ? 'Waiting for passkey…' : 'Unlock'}
    </button>
    <p><button class="link" onclick={doReset} disabled={busy}>Reset stored token</button></p>
  {:else}
    <p>
      First run: paste your Todoist API token and register a passkey. The token is encrypted on
      this device with your passkey and never leaves the browser.
    </p>
    <label>
      API token
      <input type="password" bind:value={tokenInput} autocomplete="off" placeholder="Todoist API token" />
    </label>
    <label>
      Passkey label
      <input type="text" bind:value={label} />
    </label>
    <button onclick={doEnroll} disabled={busy || !tokenInput.trim()}>
      {busy ? 'Registering…' : 'Register passkey & save'}
    </button>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}
</main>

<style>
  .unlock {
    max-width: 26rem;
    margin: 4rem auto;
    padding: 2rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .topbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.25rem;
  }
  h1 {
    margin-top: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .logo {
    display: inline-flex;
    color: var(--accent);
  }
</style>
