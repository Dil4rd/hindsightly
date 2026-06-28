<script lang="ts">
  import {
    enroll,
    hasCredentials,
    loadVault,
    resetVault,
    unlock,
    type Vault,
  } from '../lib/auth/vault'
  import { diagnosePrf, isWebAuthnAvailable } from '../lib/auth/webauthn'

  let { onUnlocked }: { onUnlocked: (token: string) => void } = $props()

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
      vault = await enroll(token, label.trim() || 'My passkey', new Date().toISOString())
      // We already hold the plaintext token here — no need for a second
      // ceremony. The unlock path is exercised on the next session.
      onUnlocked(token)
    })

  const doUnlock = () => run(async () => onUnlocked(await unlock(vault!)))

  const doReset = () =>
    run(async () => {
      await resetVault()
      vault = undefined
      tokenInput = ''
    })

  let diag = $state<string | null>(null)
  const doDiagnose = () =>
    run(async () => {
      const v = await loadVault()
      diag = await diagnosePrf(v?.wrapped.map((w) => w.credentialId) ?? [])
    })
</script>

<main class="unlock">
  <h1>Hindsight</h1>

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

  <details class="diag">
    <summary>Trouble unlocking? Run PRF diagnostic</summary>
    <button class="link" onclick={doDiagnose} disabled={busy}>Run PRF diagnostic</button>
    {#if diag}<pre>{diag}</pre>{/if}
  </details>
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
  h1 {
    margin-top: 0;
  }
  .diag {
    margin-top: 1.5rem;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .diag pre {
    white-space: pre-wrap;
    word-break: break-all;
    background: #0e0c0b;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem;
    color: var(--fg);
  }
</style>
