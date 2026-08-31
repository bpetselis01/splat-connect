# SPLAT Connect

**Supporting Play by Adapting Toys** — a platform that helps children with disabilities access play by making toy adaptation knowledge discoverable and shareable.

SPLAT Connect is a free, open platform for parents and contributors to explore, share, and discover toy adaptation tutorials for inclusive play.

## Overview

Three audiences share one platform:

- **Parents & guardians** — browse a searchable library of toy adaptation tutorials, and borrow or request adapted toys.
- **Contributors** — write, upload, and submit tutorials for review, individually or on behalf of an organisation.
- **Administrators** — review submissions, approve tutorials, and manage organisations.

There is a companion **mobile app** (Expo / React Native) covering the library, the child ability profile, and tutorial previews.

## Where the documentation lives

This README is setup and day-to-day commands. Everything else has one home:

| Topic | Document |
|---|---|
| Layers, module graph, persistence model, data flows | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Tables, columns, RLS policies, migration index | [supabase/SCHEMA.md](supabase/SCHEMA.md) |
| What runs on CI and when | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Design documents and specs | [docs/superpowers/](docs/superpowers/) |

Source files carry file-level comments explaining what they do and why; those
comments are the reference for individual files, not this document.

## Technology stack

| Category | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| API | Hono 4 + @hono/node-server |
| Web | Next.js 16, React 19 |
| Mobile | Expo 57, React Native 0.86, expo-router |
| Database | PostgreSQL (Supabase) with RLS |
| Storage | Supabase Storage (PDFs, photos, STL models) |
| Auth | Supabase Auth + @supabase/ssr |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest, Playwright, React Testing Library, Jest (mobile) |

## Setup

### Prerequisites

- **Node.js** 22.x (the API loads env files with `--env-file-if-exists`)
- **pnpm** 11.x — [install](https://pnpm.io/installation)
- **Supabase CLI** and **Docker** — needed for integration and E2E tests

### 1. Install

```bash
git clone <repository-url>
cd splat-connect
pnpm install
```

### 2. Environment variables

Three files, none of them committed.

**Repo root `.env.local`** — shared dev ports, the single source of truth for both packages:

```env
PORT=3100      # web dev server
API_PORT=3101  # api dev server
```

Change them here if those ports are taken; CORS origin, `API_URL` and
`NEXT_PUBLIC_API_URL` all derive from these two values.

The E2E suites deliberately do **not** use these ports — they start their own
servers on 3102/3103 (mobile) and 3104/3105 (web), set in each package's
`playwright.config.ts`. Keeping them apart means a test run cannot be silently
handed your dev API, which points at the cloud project rather than local Supabase.

**`packages/api/.env.local`** (template: `packages/api/.env.example`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**`packages/web/.env.local`** (template: `packages/web/.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Get all of these from the [Supabase dashboard](https://app.supabase.com) →
Settings → API.

### 3. Run

```bash
pnpm dev:api     # API on $API_PORT
pnpm dev:web     # Next.js on $PORT
pnpm dev:mobile  # Expo on a connected iOS device
```

Then open http://localhost:3100.

### 4. Local Supabase

Required for integration and E2E tests, and the safe place to try migrations.

```bash
brew install supabase/tap/supabase
supabase start   # needs Docker; Postgres lands on 54322
supabase stop
```

`supabase/config.toml` holds only this project's overrides — anything absent
falls back to the CLI's own defaults.

## Scripts

From the repo root:

```bash
pnpm dev:api / dev:web / dev:mobile   # dev servers
pnpm build                            # build api + web
pnpm typecheck                        # every package
pnpm db:check                         # migrations committed but not pushed
pnpm db:guards                        # security-critical schema assertions
```

Per package (`cd packages/<name>`):

| Script | api | web | mobile | types |
|---|---|---|---|---|
| `dev` | ✓ | ✓ | ✓ | |
| `build` | ✓ | ✓ | | |
| `start` | ✓ | ✓ | | |
| `typecheck` | ✓ | ✓ | ✓ | ✓ |
| `lint` | | ✓ | | |
| `test:unit` | ✓ | ✓ | ✓ | |
| `test:integration` | ✓ | | | |
| `test:e2e` | | ✓ | ✓ | |
| `test:cleanup` | ✓ | | | |

Mobile also has `ios`, `device:fixture`, `device:build` and `device:test` (Maestro
flows on a real device).

## Testing

**Unit** — no network, mocked Supabase and API.

```bash
pnpm --filter @splat-connect/api test:unit
pnpm --filter @splat-connect/web test:unit
pnpm --filter @splat-connect/mobile test:unit
```

**Integration** — API routes against a real local Supabase with RLS enforced.

```bash
supabase start
pnpm --filter @splat-connect/api test:integration
pnpm --filter @splat-connect/api test:cleanup   # afterwards
```

**E2E** — full user workflows in Playwright. The suite starts its own web and
API servers on its own ports, so you do **not** need dev servers running; you do
need local Supabase up.

```bash
supabase start
pnpm --filter @splat-connect/web test:e2e:install   # once, installs Chromium
pnpm --filter @splat-connect/web test:e2e
pnpm --filter @splat-connect/mobile test:e2e
```

Coverage is written by the unit suites; open `packages/<name>/coverage/index.html`.

## Deployment

Web deploys to Vercel from `main` with the root directory set to `packages/web`.
The API is a plain Node server: `pnpm build` then `pnpm start` in `packages/api`.

Set these where the API runs:

| Variable | Value |
|---|---|
| `API_PORT` | platform-assigned, or 3101 |
| `CORS_ORIGIN` | the web origin |
| `SUPABASE_URL` | project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |

Migrations are pushed with `supabase db push` against the linked project. Run
`pnpm db:check` first — it reports migrations that are committed but not applied.

## Contributing

```bash
git checkout -b feature/your-feature
pnpm typecheck && pnpm --filter @splat-connect/web lint
# run the unit suites for whatever you touched
```

Then open a pull request.

## Design principles

1. **Type safety first** — TypeScript end to end, with `packages/types` as the shared source of truth.
2. **API gateway** — data operations go through the API; the web app never writes to Supabase directly.
3. **RLS is the enforcement** — the database decides access; route-level ownership checks are defence in depth on top, never instead.
4. **Monorepo** — shared types, unified scripts, one place to refactor.

## License

No licence file at the repository root yet.
