# SAGE RANGE (the `/range` mini-game)

An original decision-and-precision range drawn in code (canvas + a few inline SVGs). No anime
character, no third-party brand, logo, map, weapon, sound or UI from any existing game. The only
picture is the generic `public/images/range-band.webp`, passed in by the host, blurred and dimmed.

## Self-contained by rule

`games/sage-range/` must be movable into its own project unchanged. It imports only React and its
own modules: ESLint (`app/sage-range-boundary` in `eslint.config.mjs`) rejects `@/…`, `next*`,
`next-intl*`, `@mui/*` and relative imports out of the folder. Whatever is site-specific comes in
through props (`ui/types.ts` → `SageRangeProps`): translated labels, the locale, a storage adapter,
a leaderboard adapter, the backdrop URL and a `renderReturnLink` for the host's own link.

| Path                         | Role                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `core/config.ts`             | Rules: arena, ticks, points, the three difficulties, `RULES_VERSION`                       |
| `core/rng.ts`                | Seeded generator (mulberry32, integer maths)                                               |
| `core/engine.ts`             | Deterministic simulation: `createGame`, `stepGame` (one 1/60 s tick), hit zones, spawning  |
| `core/summary.ts`            | End figures: score + precision bonus, reaction time, time to damage, head precision, grade |
| `core/submission.ts`         | Leaderboard payload (seed + accepted shot log), validation, `replay`, `verify`             |
| `core/leaderboard.ts`        | Boards per difficulty: parse, rank, insert (one line per tag)                              |
| `core/names.ts`              | Tag validation and the multilingual insult filter                                          |
| `core/saved.ts`, `format.ts` | Browser-saved data (bests, last tag); tiny formatting helpers                              |
| `render/`                    | Canvas drawing and effects (render-only, real time, never part of a replay)                |
| `ui/`                        | React: start screen, `PlayField` (rAF loop + HUD), pause, results, touch notice            |
| `sage-range.css`             | The game's stylesheet (`.sr`, `.sr-*`), imported by the `app/globals.css` manifest         |
| `index.ts` / `server.ts`     | Public entries: client (component, types) / server (verify and rank, no React)             |

`core/` is framework-free and covered at 100% branches by `core/*.test.ts` (collected by Vitest
through `games/**` in `vitest.config.ts`). Keep it free of DOM, React and floating-point maths
whose result could differ between engines (no `Math.sin` in the simulation): the browser and the
server must replay the same session bit for bit.

## Gameplay and scoring

A target rises (unreadable), holds while a dashed ring fills (identity visible: orange = hostile,
grey with a no-shoot mark = decoy), opens (solid ring draining), then sinks. Hostile: two body
hits or one head hit. Shooting before it opens = early shot; shooting a decoy = heavy penalty;
letting a decoy go = points; letting a hostile go = streak lost. Kill points = base + head bonus +
speed bonus (falls to 0 at the end of the window), times the streak multiplier; the end bonus
rewards accuracy and head precision. Mimic decoys (Regular, Elite) look hostile until they open:
patience is the skill. Values live in `core/config.ts`; changing them changes scores, so bump
`RULES_VERSION` (it also starts new boards).

## Host side (this site)

- Route: `app/[locale]/range/page.tsx` (static Server Component: metadata + labels from
  `messages/<locale>.json` → `range.game`, never in `CLIENT_MESSAGES`) and `RangeClient.tsx`
  (adapters). Pathname `/range` in every locale (`i18n/pathnames.ts`); header entry
  `nav.range` (`accent`), footer and sitemaps follow `NAV`. `RANGE_ENABLED` turns the home teaser
  into a link.
- Storage: one localStorage key, `LS_SAGE_RANGE` (`lib/storage.ts`), read through
  `useSyncExternalStore` (server snapshot `null`), so the page stays static.
- Leaderboard: `app/api/range/scores/route.ts` (GET boards, POST a session) + `lib/range-scores.ts`
  (Netlify Blobs store `sage-range`, compare-and-swap writes; process memory outside production).
  The server REPLAYS the submitted seed and shot log and ranks only its own score; the IP is used
  for the in-memory rate limit only and never stored. Replay proves a score matches a legal shot
  sequence, not that a human fired it.
- Touch-only devices (`(hover: none) and (pointer: coarse)`) get an explanatory screen; the switch
  is CSS-only (no hydration mismatch).
- Tests: `tests/e2e/range.spec.ts` uses the test hook `window.__SAGE_RANGE_TEST__` (seed, short
  session, no countdown); hooked runs never offer the leaderboard.
