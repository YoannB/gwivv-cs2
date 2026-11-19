# GWIVV

> **Status:** work in progress.

Personal site of **GWIVV**, Counter-Strike 2 player: player profile, statistics, highlights,
loadout, and **Sage Range**, a browser aim-and-decision mini-game. Signature: _« La patience est une arme. »_

The product specification lives in `specs/`, the mockups in `mockups/`.

## Stack

- Next.js 16 App Router and Turbopack, React 19, TypeScript
- Material UI 9, isolated behind a neutral component API (`components/ui/`)
- `next-intl` 4: six locales, localized copy and URLs, browser-language detection with English as fallback
- Vitest, Playwright and Storybook 10 for verification
- Netlify deployment through the managed Next.js/OpenNext adapter

## Quick start

Prerequisites: Node.js 24 or newer, npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Every variable is documented in `.env.example`. Legal/publisher values go in `.env.local` locally
and in Netlify > Site configuration > Environment variables, never in the repository.

## Where things live

| Concern                    | File                                         |
| -------------------------- | -------------------------------------------- |
| identity and configuration | `constants/site.ts`                          |
| copy (every locale)        | `messages/<locale>.json`                     |
| routes                     | `i18n/pathnames.ts`                          |
| home                       | `components/home/Home.tsx`                   |
| logo / favicon             | `components/ui/Logo.tsx` / `app/icon.svg`    |
| colour tokens              | `styles/tokens.css` (in step with `PALETTE`) |
| social image               | `components/og/OgImage.tsx` (`OG_THEME`)     |

Coding agents start with `AGENTS.md`, which routes to the one doc in `docs/` matching the task.

## Verification

The Definition of done (`AGENTS.md`):

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npm run test:e2e && npm run storybook:build
```

plus `npm audit`. CI (`.github/workflows/ci.yml`) runs the same sequence on pull requests to `main`.

## Deployment on Netlify

1. Connect the repository to Netlify (Next.js is detected; do not pin the adapter without a reason).
2. Configure the environment variables (see `.env.example`).
3. Check the deploy preview of every pull request before merging.

Locale routing runs through a root `middleware.ts`: the Netlify adapter does not support the
Next.js 16 `proxy.ts` convention yet (`proxy.ts.disabled` is parked for that day, see `docs/architecture.md`).

## Taking an update of the base app

This site is a clone of [Axons](https://github.com/YoannB/axons), kept as the `upstream` remote.
Releases are tagged (`vX.Y.Z`) and their notes list what changed and how to migrate. Take one deliberately, on a branch:

```bash
git checkout -b chore/upstream-vX.Y.Z
git fetch upstream --tags
git merge vX.Y.Z
```

Resolve every conflict on purpose: **identity** (the files of _Where things live_, content, deleted demo)
keeps this site's version, then port by hand any new key or constant the release added;
**engine** (everything else) takes the upstream change unless this site deliberately changed that code.
Then run the full Definition of done, open a PR and check the deploy preview before merging.

## License

Copyright (C) 2026 Yoann Barbier.

Licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`), inherited from
the Axons base app. See [`LICENSE`](LICENSE): the `LICENSE` file is the only binding text.
