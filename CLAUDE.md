# CLAUDE.md

Hindsightly — a self-contained, single-HTML-file, privacy-first retrospective
dashboard for a Todoist-based GTD practice. Svelte 5 (runes) + Vite +
TypeScript + uPlot; WebAuthn-PRF-encrypted token, no backend.

## Commands

- `docker compose up dev` — primary dev workflow (Vite dev server)
- `npm run check` — svelte-check + tsc; must be 0 errors AND 0 warnings
- `npm test` — Vitest suite
- `npm run build` — single-file `dist/index.html` (vite-plugin-singlefile)

All three must pass before every commit.

## Privacy — hard rules

- Task names/content and label names must NEVER leave the browser or be
  persisted. Not in the encrypted cache, not in logs, not in assistant/probe
  output, not in any network call except the browser→Todoist API itself.
  Only task/project/label **ids and dates/timelines** are OK outside RAM.
- Anything persisted goes through the `strip*` functions in
  `src/lib/todoist/cache.ts` (titles AND `labels[]` zeroed) and is AES-GCM
  encrypted under the passkey-derived key. Same for `settings.ts` (label ids
  only, never names).
- When debugging against the live API (a token may be available in `.env`),
  print counts/ids/dates only — never task content.
- Stay inside this repo folder.

## Invariants (each one exists because of a real bug)

- Task titles resolve ONLY through `taskNameIndex` (`src/lib/stats/names.ts`).
  Never read `extra_data.content` directly in UI code — the cache is name-free,
  so names silently vanish after a reload.
- Every `Insight` carries a `docId` matching a heading slug in
  `docs/INSIGHTS.md`; the KNOWN set in `tests/insights.test.ts` enforces it.
  A new insight ships with its methodology card (Measures / Ignores / Source /
  Caveats) in the same commit.
- Colors come from CSS vars in `src/app.css` (`:root` dark +
  `:root[data-theme="light"]`). No hardcoded colors in components — hardcoded
  dark values have twice shipped invisible-in-light-theme bugs.
- Drawer/list `{#each}` blocks over per-event items must NOT key by task id —
  ids repeat across events and Svelte 5 throws on duplicate keys. Key by index.
- uPlot axis `incrs`/`time` are baked at construction: rebuild the chart on
  granularity change, `setData` is not enough.
- Todoist priorities are internal scale: **4 = P1 (highest), 1 = P4**.
- Todoist API is unified v1 (`/api/v1/...`), cursor pagination; the completed
  endpoint rejects ranges > ~3 months (chunked in `client.ts`); free accounts
  keep only ~7 days of activity (`is_premium` gates long presets).

## Workflow

- `main` is protected. Work on `dev`; one PR `dev`→`main` per release; a
  `vX.Y.Z` tag fires the release workflow (single-file artifact).
- Commit at the end of each stage of work; short commit messages; push to
  `dev` after each commit so the user can verify.
- User-facing changes go to `CHANGELOG.md` under `[Unreleased]`
  (Keep-a-Changelog). Parked/vetted ideas go to `ROADMAP.md` — it is curated,
  not a backlog dump; record probe-confirmed feasibility notes with each item.
- At the end of each work iteration, refresh `AGENTS.md`: its "Current state"
  section (date, versions, PR status, unreleased list) plus any section your
  changes made stale. A cold-start agent must be able to trust it blindly.
- Product intent: Hindsightly is a *retrospective instrument* ("did it work
  out, what to adjust?"), answering four questions — right tasks? sane
  structure? good prioritization? good execution? Metrics are the signal
  layer; insights interpret them. New features earn their place by serving
  that goal.
