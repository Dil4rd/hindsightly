# Deployment

The whole app is a single static `index.html`. "Deploying" means serving that
one file over **HTTPS** (or `http://localhost`). The only real decision is the
**origin**, because of one rule:

> ⚠️ **A passkey — and the token it encrypts — is permanently bound to the
> origin (hostname) it was registered on.** Pick a *stable* origin and enroll
> there. If the hostname later changes, your stored token can't be decrypted and
> you must re-enroll (paste the token again). Keep the token in 1Password so
> re-enrolling is trivial.

| Option | Origin stability | Exposure | Best for |
|---|---|---|---|
| Docker + `localhost` | stable (`localhost`) | local only | dev / testing |
| Cloudflare **named** tunnel | stable (your domain) | private or public | **recommended self-host** |
| Cloudflare quick tunnel | ❌ random each run | public | one-off test only |
| ngrok (free static domain) | stable (1 free / account) | public | quick stable HTTPS |
| GitHub Pages | stable (`*.github.io` / custom) | public | zero-infra hosting |
| Cloudflare Pages / Netlify | stable (custom / `*.pages.dev`) | public | zero-infra hosting |
| Tailscale Funnel | stable (`*.ts.net`) | tailnet/public | private HTTPS |

> The page being "public" is fine: it contains **no secrets**. The token lives
> only in *your* browser (encrypted), and nothing works without *your* passkey.

---

## Build

Two ways; both produce `dist/index.html`.

**Docker (no local Node needed) — produces the artifact on the host:**

```bash
docker build --target artifact -o dist .   # -> ./dist/index.html
```

**Or locally:**

```bash
npm ci && npm run build
```

---

## Option A — Local / LAN via Docker

`http://localhost` is a WebAuthn secure context, so this is fully functional
(passkey enrollment + unlock work):

```bash
docker build --target serve -t hindsight .
docker run --rm -p 8080:80 hindsight
# open http://localhost:8080
```

To reach it from another device on your LAN you need HTTPS (a plain LAN IP is
not a secure context) — use a tunnel (Options B–D) or Tailscale (Option G).

## Option B — Cloudflare Tunnel (recommended self-host)

Run the container (Option A), then expose it.

**Named tunnel (stable origin — do this for real use):** requires a domain on
Cloudflare.

```bash
cloudflared tunnel login
cloudflared tunnel create hindsight
# Map a hostname to the local server:
cloudflared tunnel route dns hindsight stats.example.com
cloudflared tunnel run --url http://localhost:8080 hindsight
# enroll your passkey at https://stats.example.com  (stable forever)
```

You can also add Cloudflare Access in front for an extra auth layer (private).

**Quick tunnel (testing only — URL changes every run, breaks your vault):**

```bash
cloudflared tunnel --url http://localhost:8080
```

## Option C — ngrok

ngrok includes **one free static domain per account** — claim it once and it's a
stable origin (safe to enroll your passkey against).

```bash
# Use your reserved static domain (free tier includes one):
ngrok http --url=your-name.ngrok-free.app 8080

# A bare `ngrok http 8080` gets a RANDOM url each run -> breaks the vault; avoid.
```

## Option D — GitHub Pages

Stable origin (`https://<user>.github.io/<repo>/`, or a custom domain). The
RP ID will be the *hostname* (`<user>.github.io`), shared across your project
pages — use a custom domain if you want isolation.

A ready workflow is at `.github/workflows/deploy.yml` (it builds via Docker,
then publishes). To use it:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. The page deploys automatically.

## Option E — Cloudflare Pages / Netlify

Drag-and-drop or CLI-upload the single `dist/index.html`:

```bash
npx wrangler pages deploy dist            # Cloudflare Pages
npx netlify deploy --prod --dir dist      # Netlify
```

Both give a stable HTTPS origin instantly.

## Option F — Tailscale Funnel (private HTTPS)

Stable `https://<machine>.<tailnet>.ts.net`, reachable only by you (or publicly
if you choose). Run Option A, then:

```bash
tailscale funnel 8080
```

---

## Changing origins later

If you must move origins, before switching: open the app on the **old** origin,
unlock, copy your token out (or just retrieve it from 1Password). Then on the
**new** origin, run first-time enrollment again. Old IndexedDB data on the old
origin is harmless and can be reset from the unlock screen.
