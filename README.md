# Hindsightly

A self-contained, static dashboard for your Todoist task statistics — opened,
closed, postponed, rescheduled, scheduled, unscheduled, reprioritized, and mean
time to complete — filterable by time window, project (tree), and priority.

No backend. Your Todoist API token is encrypted **on your device** with a
passkey (WebAuthn PRF) and never leaves the browser. Task data is fetched
directly browser → Todoist and processed locally.

Beyond the raw stats, an **insight layer** interprets them against four retro
questions. How each insight is computed — and what it deliberately doesn't
capture — is documented in [docs/INSIGHTS.md](docs/INSIGHTS.md); every insight in
the app links (ⓘ) to its section.

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

Docker is the primary workflow (no local Node needed):

```bash
docker compose up dev          # Vite live-reload dev server → http://localhost:5173
docker build --target artifact -o dist .                 # → ./dist/index.html (single file)
docker build --target serve -t hindsightly . \
  && docker run --rm -p 8080:80 hindsightly              # preview the built file → :8080

docker compose run --rm dev npm test       # vitest
docker compose run --rm dev npm run check   # svelte-check + node tsconfig
```

`http://localhost` is a WebAuthn secure context, so the dev server and the
preview both support passkey enrollment/unlock.

Prefer local Node instead? `npm install` then `npm run dev | build | test | check`.

## Configuration

Build-time env vars (see `.env.example`):

- `VITE_RESCHEDULE_DEDUP_MIN` — collapse multiple due-date changes on the same
  task within this many minutes into one (default `10`; `0` disables). Set it in
  your host (e.g. Vercel) or a local `.env`.

## Stack

Svelte 5 · Vite + vite-plugin-singlefile · TypeScript · uPlot · date-fns ·
Vitest. Native WebAuthn + WebCrypto (no auth dependency).

## Status & roadmap

Shipped work: [CHANGELOG.md](./CHANGELOG.md). Planned: [ROADMAP.md](./ROADMAP.md).
