# Hindsight

A self-contained, static dashboard for your Todoist task statistics — opened,
closed, postponed, rescheduled, scheduled, unscheduled, reprioritized, and mean
time to complete — filterable by time window, project (tree), and priority.

No backend. Your Todoist API token is encrypted **on your device** with a
passkey (WebAuthn PRF) and never leaves the browser. Task data is fetched
directly browser → Todoist and processed locally.

## Security model

- **Passkey-encrypted token.** On first run you paste your Todoist token and
  register a passkey. The token is encrypted with AES-GCM under a key derived
  (HKDF) from the passkey's WebAuthn **PRF** output, and stored in IndexedDB.
  The key is never stored — unlocking re-derives it from the passkey.
- **No server, no server key.** WebAuthn is used only as a PRF key-derivation
  oracle; there is no relying party verifying assertions.
- **Multi-credential.** Enroll more than one passkey as backup; any enrolled
  authenticator can unlock (token is wrapped once per credential).
- **Strict CSP.** The release build inlines everything into one `index.html`
  and emits a CSP that locks script execution to the build's own hash and limits
  network access to `https://api.todoist.com`.

> WebAuthn requires a secure context: serve over `https://` (or `http://localhost`
> for dev). `file://` will not work, and the passkey is bound to the origin.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # svelte-check + node-side tsconfig typecheck
npm test         # vitest
npm run build    # → dist/index.html (single self-contained file)
```

## Stack

Svelte 5 · Vite + vite-plugin-singlefile · TypeScript · uPlot · date-fns ·
Vitest. Native WebAuthn + WebCrypto (no auth dependency).

## Status

- [x] Security core: passkey PRF vault (`src/lib/auth/`), unlock UI
- [x] Single-file build + CSP pipeline
- [x] Docker build (`Dockerfile`) + deployment guide (`docs/DEPLOYMENT.md`)
- [x] Todoist data layer (`src/lib/todoist/`): projects, completed items, activity log (cursor-paginated)
- [x] Stats engine (`src/lib/stats/`): event classification, metrics, filters (time · project tree · priority) — validated live (aggregates only)
- [x] Dashboard UI (`Dashboard.svelte`): filter controls (time · project tree · priority), stat cards, uPlot opened-vs-closed trend
- [ ] Release workflow: build single HTML + attach to GitHub Release (tags only)
- [ ] Recurring-task handling (deferred; currently inflates `postponed`)
