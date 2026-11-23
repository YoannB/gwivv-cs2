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
| `core/names.ts`              | Display-name cleaning (any script, bounded) and the multilingual insult filter             |
| `core/share.ts`              | Session ↔ URL code (`#r=`), run fingerprint (`runId`, one board line per run)              |
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

A range silhouette (bust: head, torso; hit zones match the drawing) rises (unreadable), holds while
a dashed ring fills (identity visible: orange = hostile, grey with a no-shoot mark = decoy), waits a
HIDDEN extra hold (the opening cannot be anticipated: reaction time stays a reaction), opens (solid
ring draining), then sinks. Openings are staggered (`maxOpen`, `openGapTicks`) so every window stays
humanly reachable; windows are 1.2 s / 0.95 s / 0.7 s. The server refuses sessions whose average
reaction time is below `MIN_HUMAN_REACTION_MS` over enough targets. Hostile targets wear the
difficulty's armour (`armor` in `core/config.ts`): none on Recruit (one hit anywhere), a vest on
Regular (two body hits, one head hit), vest and helmet on Elite (two hits anywhere); a protected zone
takes two hits, an unprotected one falls to one. Shooting before it opens = early shot; shooting a decoy = heavy penalty;
letting a decoy go = points; letting a hostile go = streak lost. Kill points = base + head bonus +
speed bonus (falls to 0 at the end of the window), times the streak multiplier; the end bonus
rewards accuracy and head precision. Mimic decoys (Regular, Elite) look hostile until they open:
patience is the skill. Values live in `core/config.ts`; changing them changes scores, so bump
`RULES_VERSION` (it also starts new boards).

## Results in the URL

A finished session pushes `#r=<code>` (seed + shots + optional tag, `core/share.ts`): Back returns
to the results, a reload keeps them, and the address is the share link. Opening a code that this
page load did not play replays it and shows it read-only ("shared session", "beat this score").
The code holds no session length: a test-hook run (shortened) does not replay faithfully. Results
buttons stay inert for 900 ms so a late in-game click cannot skip them.

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
- Player identity: the player pastes their Steam profile link (`/id/<vanity>` or
  `/profiles/<SteamID64>`). `lib/steam-profile.ts` (pure) parses it and Steam's answers. With
  `STEAM_API_KEY` set (server only, `lib/env-server.ts`; free key at steamcommunity.com/dev/apikey),
  the route uses the Steam Web API (ResolveVanityURL, GetPlayerSummaries); without it, the public
  XML view (`steamcommunity.com/…/?xml=1`), which Steam answers with HTTP 429 from Netlify's shared
  IPs, so production needs the key. The route fetches the profile and ranks the entry under
  the persona name (cleaned and filtered by the game) with the medium avatar and the canonical
  profile URL; one board line per profile. The link is not proof of ownership: a demo board,
  moderated by hand. Avatars load from `*.steamstatic.com` (`img-src` in `lib/security-headers.ts`).
- Touch-only devices (`(hover: none) and (pointer: coarse)`) get an explanatory screen; the switch
  is CSS-only (no hydration mismatch).
- Tests: `tests/e2e/range.spec.ts` uses the test hook `window.__SAGE_RANGE_TEST__` (seed, short
  session, no countdown); hooked runs never offer the leaderboard.

## Movement, sensitivity, crosshair

Moving targets strafe like a player (`strafe` in `core/engine.ts`): speed builds up by `accel` per
tick to the target's `maxSpeed`, and at the end of its lane it brakes with the same acceleration and
comes back. Speeds are 1/100 arena units per tick so the maths stays integer.

Settings (`core/settings.ts`, saved with the bests): sensitivity 0.10–5.00 (two decimals; 1.00 =
the desktop cursor speed) and the crosshair (style, colour, size 1–10). During a session the canvas
captures the mouse (Pointer Lock, raw input where the browser offers it) and the crosshair moves by
`movementX/Y × sensitivity`; Esc releases the capture and pauses, Resume captures it again. Without
capture (refused, or `pointerLock: false` in the test hook) the plain cursor position is used.

## Personal best, sent whenever the player wants

The browser keeps, per level, the best session's score AND its share code (`core/saved.ts`). The
start screen shows it with "see this run" (replays it) and "send my best" until it is on the board:
the player can try as often as wanted and send the best one later; the server replays the code like
any live submission (`payloadFromRun`). A better session replaces the stored best (not sent yet).
Levels unlock in order from those bests (`isUnlocked`). Test-hook sessions are never stored.

## Resetting the leaderboard

All boards (the three difficulties) are ONE blob: key `boards-v<RULES_VERSION>` in the Netlify Blobs
store `sage-range`. The store is site-wide: deploy previews and production share it, so scores
made while testing a preview stay on the production board until reset. To reset:

- Netlify dashboard → the project → Blobs → store `sage-range` → delete the `boards-v<N>` entry; or
- Netlify CLI from a linked checkout: `npx netlify blobs:delete sage-range boards-v<N>`
  (`npx netlify blobs:list sage-range` shows the current key).

Removing one entry by hand: download it with `npx netlify blobs:get sage-range boards-v<N>`, edit the
JSON, upload it with `npx netlify blobs:set sage-range boards-v<N> --input <file>`. Bumping
`RULES_VERSION` also starts empty boards, but it changes the rules and invalidates every share link.
