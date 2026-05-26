# Monorepo Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-package Next.js + Supabase app into a pnpm monorepo with three packages — `@splat-connect/types` (shared interfaces), `@splat-connect/api` (Hono HTTP server owning all Supabase data calls), and `@splat-connect/web` (Next.js UI that calls the API, not Supabase directly).

**Architecture:** The Hono API server receives requests with a Supabase JWT in the `Authorization` header, validates it, and runs all Supabase queries on behalf of the caller. The Next.js app handles auth session management via `@supabase/ssr` (cookies) and fetches all data through the API. Shared TypeScript interfaces live in `packages/types` and are imported by both packages.

**Tech Stack:** pnpm workspaces, Hono v4 + `@hono/node-server`, Next.js 16.2.6, `@supabase/supabase-js` v2, `@supabase/ssr`, TypeScript 5, tsx (API dev runner)

**Spec:** `docs/superpowers/specs/2026-05-26-monorepo-architecture-testing-design.md`

**Follow-up:** After this plan is complete, implement `docs/superpowers/plans/2026-05-26-comprehensive-testing.md`.

---

## File Map

### Created
- `packages/api/src/routes/public.ts` ← unauthenticated read-only endpoints (library browsing)
- `pnpm-workspace.yaml`
- `package.json` ← workspace root (replaces existing)
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts` ← moved from `lib/types.ts`
- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/.env.example`
- `packages/api/src/index.ts`
- `packages/api/src/supabase/client.ts`
- `packages/api/src/supabase/user-client.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/routes/tutorials.ts`
- `packages/api/src/routes/upload.ts`
- `packages/api/src/routes/parts.ts`
- `packages/api/src/routes/tools.ts`
- `packages/api/src/routes/stl-files.ts`
- `packages/api/src/routes/admin.ts`
- `packages/api/src/routes/contributors.ts`
- `packages/web/lib/api-client.ts`
- `packages/web/lib/browser-api-client.ts`

### Moved (git mv)
- `app/` → `packages/web/app/`
- `components/` → `packages/web/components/`
- `lib/` → `packages/web/lib/` (then trimmed — see below)
- `middleware.ts` → `packages/web/middleware.ts`
- `public/` → `packages/web/public/`
- `next.config.ts` → `packages/web/next.config.ts`
- `tailwind.config.ts` → `packages/web/tailwind.config.ts` (if present)
- `postcss.config.js` → `packages/web/postcss.config.js` (if present)

### Deleted from web after move
- `packages/web/lib/supabase/server.ts`
- `packages/web/lib/supabase/admin.ts`
- `packages/web/lib/types.ts`

### Modified
- Every `packages/web` page/component that imports from `lib/types` or calls `supabase.from(...)`

---

## Task 1: Bootstrap the pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Rewrite: `package.json` (workspace root)

- [ ] **Step 1: Verify pnpm is installed**

```bash
pnpm --version
```

Expected: a version string like `9.x.x`. If not installed: `npm install -g pnpm`

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

Create at repo root:

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: Rewrite root `package.json` as workspace root**

Replace the entire file:

```json
{
  "name": "splat-connect-workspace",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter @splat-connect/api dev",
    "dev:web": "pnpm --filter @splat-connect/web dev",
    "build": "pnpm --filter @splat-connect/api build && pnpm --filter @splat-connect/web build",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Create the packages directory**

```bash
mkdir packages
```

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: initialise pnpm workspace root"
```

---

## Task 2: Create `packages/types`

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p packages/types/src
```

- [ ] **Step 2: Create `packages/types/package.json`**

```json
{
  "name": "@splat-connect/types",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Create `packages/types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["esnext"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `packages/types/src/index.ts`**

Copy the full contents of `lib/types.ts` here (the file that was updated in the previous session with `BuyLink`, `is_optional`, and `buy_links` fields):

```ts
export type Role = 'admin' | 'contributor'

export type TutorialStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface BuyLink {
  label: string
  url: string
}

export interface Part {
  id?: string
  tutorial_id?: string
  name: string
  quantity: number
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface Tool {
  id?: string
  tutorial_id?: string
  name: string
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface StlFile {
  id?: string
  tutorial_id?: string
  filename: string
  file_url: string
}

export interface Tutorial {
  id: string
  title: string
  difficulty: Difficulty
  status: TutorialStatus
  description: string | null
  tutorial_pdf_url: string | null
  toy_photo_url: string | null
  created_at: string
}

export interface TutorialWithDetails extends Tutorial {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: { profile_id: string }[]
}

export interface UploadDraft {
  title: string
  difficulty: string
  tutorial_pdf_url: string
  toy_photo_url: string
  parts: {
    name: string
    quantity: number
    is_optional: boolean
    buy_links: BuyLink[]
  }[]
  tools: {
    name: string
    is_optional: boolean
    buy_links: BuyLink[]
  }[]
  stl_files: {
    name: string
    file_url: string
  }[]
}
```

- [ ] **Step 5: Typecheck packages/types**

```bash
pnpm --filter @splat-connect/types typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/types
git commit -m "chore: extract shared types to @splat-connect/types package"
```

---

## Task 3: Move web code to `packages/web`

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`
- Move (git mv): `app/`, `components/`, `lib/`, `middleware.ts`, `public/`, `next.config.ts`
- Delete: `packages/web/lib/types.ts`, `packages/web/lib/supabase/server.ts`, `packages/web/lib/supabase/admin.ts`

- [ ] **Step 1: Create packages/web directory**

```bash
mkdir -p packages/web
```

- [ ] **Step 2: Move all web source files**

```bash
git mv app packages/web/app
git mv components packages/web/components
git mv lib packages/web/lib
git mv middleware.ts packages/web/middleware.ts
git mv public packages/web/public
git mv next.config.ts packages/web/next.config.ts
```

If `tailwind.config.ts` or `postcss.config.js` exist at root:

```bash
git mv tailwind.config.ts packages/web/tailwind.config.ts
git mv postcss.config.js packages/web/postcss.config.js
```

- [ ] **Step 3: Create `packages/web/package.json`**

```json
{
  "name": "@splat-connect/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.1",
    "@splat-connect/types": "workspace:*"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "typescript": "^5"
  }
}
```

- [ ] **Step 4: Create `packages/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Move .env.local into packages/web**

```bash
git mv .env.local packages/web/.env.local
```

If `.env.local` doesn't exist at root, create `packages/web/.env.local` with the same env vars from your Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 6: Delete files that belong in packages/api, not web**

```bash
git rm packages/web/lib/supabase/server.ts
git rm packages/web/lib/supabase/admin.ts
git rm packages/web/lib/types.ts
```

- [ ] **Step 7: Update imports in packages/web from `lib/types` to `@splat-connect/types`**

Every file that imports from `@/lib/types` or `../lib/types` needs updating. Find them:

```bash
grep -rl "from '@/lib/types'" packages/web
grep -rl "from '../lib/types'" packages/web
grep -rl "from '../../lib/types'" packages/web
```

In each file found, change:
```ts
// BEFORE
import type { Tutorial, Part } from '@/lib/types'
// AFTER
import type { Tutorial, Part } from '@splat-connect/types'
```

- [ ] **Step 8: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 9: Typecheck packages/web**

```bash
pnpm --filter @splat-connect/web typecheck
```

Expected: errors only about missing `lib/supabase/server.ts` and `lib/supabase/admin.ts` imports in pages that call Supabase. These will be resolved in Task 8. Any other errors should be fixed now.

- [ ] **Step 10: Commit**

```bash
git add packages/web packages/types
git commit -m "chore: move Next.js app to packages/web, wire @splat-connect/types"
```

---

## Task 4: Create `packages/api` scaffold

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/.env.example`
- Create: `packages/api/src/index.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/api/src/middleware packages/api/src/routes packages/api/src/supabase
```

- [ ] **Step 2: Create `packages/api/package.json`**

```json
{
  "name": "@splat-connect/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4",
    "@hono/node-server": "^1",
    "@supabase/supabase-js": "^2",
    "@splat-connect/types": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

- [ ] **Step 3: Create `packages/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["esnext"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create `packages/api/.env.example`**

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

- [ ] **Step 5: Create `packages/api/.env`**

Copy `.env.example` to `.env` and fill in the same Supabase credentials as packages/web. Add `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard (Settings → API → service_role key).

Add `.env` to `.gitignore` if not already present:

```bash
echo "packages/api/.env" >> .gitignore
```

- [ ] **Step 6: Create `packages/api/src/index.ts`** (minimal — routes added in Task 6)

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})

export default app
```

- [ ] **Step 7: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 8: Start the API and verify health check**

```bash
pnpm --filter @splat-connect/api dev
```

In a second terminal:

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

Stop the server (Ctrl+C).

- [ ] **Step 9: Commit**

```bash
git add packages/api .gitignore
git commit -m "chore: scaffold @splat-connect/api with Hono"
```

---

## Task 5: Implement Supabase clients and auth middleware

**Files:**
- Create: `packages/api/src/supabase/client.ts`
- Create: `packages/api/src/supabase/user-client.ts`
- Create: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: Create `packages/api/src/supabase/client.ts`**

Service-role client — bypasses RLS. Used only in admin routes and the auth middleware for validating JWTs.

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 2: Create `packages/api/src/supabase/user-client.ts`**

Builds a Supabase client that runs queries as the authenticated user, so RLS policies apply.

```ts
import { createClient } from '@supabase/supabase-js'

export function createUserClient(token: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )
}
```

- [ ] **Step 3: Create `packages/api/src/middleware/auth.ts`**

Validates the Supabase JWT, looks up the user's role from the `profiles` table, and attaches both to the Hono context. Every protected route depends on this.

```ts
import type { MiddlewareHandler } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import type { Role } from '@splat-connect/types'

export type AuthVariables = {
  userId: string
  role: Role
  token: string
}

export const authMiddleware: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  c,
  next
) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)
  const supabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return c.json({ error: 'User profile not found' }, 403)
  }

  c.set('userId', user.id)
  c.set('role', profile.role as Role)
  c.set('token', token)

  await next()
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @splat-connect/api typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/supabase packages/api/src/middleware
git commit -m "feat(api): add Supabase clients and JWT auth middleware"
```

---

## Task 6: Implement all API routes

**Files:**
- Create: `packages/api/src/routes/tutorials.ts`
- Create: `packages/api/src/routes/upload.ts`
- Create: `packages/api/src/routes/parts.ts`
- Create: `packages/api/src/routes/tools.ts`
- Create: `packages/api/src/routes/stl-files.ts`
- Create: `packages/api/src/routes/admin.ts`
- Create: `packages/api/src/routes/contributors.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Create `packages/api/src/routes/tutorials.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const tutorials = new Hono<{ Variables: AuthVariables }>()

tutorials.get('/', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors!inner(profile_id)')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors!inner(profile_id)')
    .eq('tutorial_contributors.profile_id', c.get('userId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.get('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*), tutorial_contributors(profile_id)')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

tutorials.post('/', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .upsert({
      id: body.id,
      title: body.title,
      difficulty: body.difficulty,
      description: body.description ?? null,
      status: 'draft',
      tutorial_pdf_url: body.tutorial_pdf_url ?? null,
      toy_photo_url: body.toy_photo_url ?? null,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

tutorials.patch('/:id', async (c) => {
  const body = await c.req.json()
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('tutorials')
    .update(body)
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

tutorials.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorials')
    .delete()
    .eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default tutorials
```

- [ ] **Step 2: Create `packages/api/src/routes/upload.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const upload = new Hono<{ Variables: AuthVariables }>()

upload.post('/pdf', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('tutorial-pdfs')
    .upload(`${tutorialId}/tutorial.pdf`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('tutorial-pdfs')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

upload.post('/photo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('toy-photos')
    .upload(`${tutorialId}/photo.${ext}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('toy-photos')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl })
})

upload.post('/stl', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const tutorialId = formData.get('tutorialId') as string | null

  if (!file || !tutorialId) {
    return c.json({ error: 'file and tutorialId are required' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase.storage
    .from('stl-files')
    .upload(`${tutorialId}/${file.name}`, file, { upsert: true })

  if (error) return c.json({ error: error.message }, 500)

  const { data: urlData } = supabase.storage
    .from('stl-files')
    .getPublicUrl(data.path)

  return c.json({ url: urlData.publicUrl, filename: file.name })
})

export default upload
```

- [ ] **Step 3: Create `packages/api/src/routes/parts.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const parts = new Hono<{ Variables: AuthVariables }>()

parts.post('/:id/parts', async (c) => {
  const body = await c.req.json<{ parts: { name: string; quantity: number; is_optional: boolean; buy_links: unknown[] }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('parts').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.parts.map((p) => ({
    tutorial_id: c.req.param('id'),
    name: p.name,
    quantity: p.quantity,
    is_optional: p.is_optional,
    buy_links: p.buy_links,
  }))

  const { data, error } = await supabase.from('parts').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

parts.delete('/:id/parts', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('parts').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default parts
```

- [ ] **Step 4: Create `packages/api/src/routes/tools.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const tools = new Hono<{ Variables: AuthVariables }>()

tools.post('/:id/tools', async (c) => {
  const body = await c.req.json<{ tools: { name: string; is_optional: boolean; buy_links: unknown[] }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('tools').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.tools.map((t) => ({
    tutorial_id: c.req.param('id'),
    name: t.name,
    is_optional: t.is_optional,
    buy_links: t.buy_links,
  }))

  const { data, error } = await supabase.from('tools').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

tools.delete('/:id/tools', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('tools').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default tools
```

- [ ] **Step 5: Create `packages/api/src/routes/stl-files.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'

const stlFiles = new Hono<{ Variables: AuthVariables }>()

stlFiles.post('/:id/stl-files', async (c) => {
  const body = await c.req.json<{ stl_files: { filename: string; file_url: string }[] }>()
  const supabase = createUserClient(c.get('token'))

  await supabase.from('stl_files').delete().eq('tutorial_id', c.req.param('id'))

  const rows = body.stl_files.map((f) => ({
    tutorial_id: c.req.param('id'),
    filename: f.filename,
    file_url: f.file_url,
  }))

  const { data, error } = await supabase.from('stl_files').insert(rows).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

stlFiles.delete('/:id/stl-files', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase.from('stl_files').delete().eq('tutorial_id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

export default stlFiles
```

- [ ] **Step 6: Create `packages/api/src/routes/admin.ts`**

```ts
import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'
import type { TutorialStatus } from '@splat-connect/types'

const admin = new Hono<{ Variables: AuthVariables }>()

admin.use('*', async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

admin.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const status = (c.req.query('status') ?? 'pending') as TutorialStatus
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, tutorial_contributors(profile_id)')
    .eq('status', status)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/tutorials/:id/status', async (c) => {
  const { status } = await c.req.json<{ status: TutorialStatus }>()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .update({ status })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.get('/contributors', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'contributor')
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

admin.patch('/contributors/:id/approve', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default admin
```

- [ ] **Step 7: Create `packages/api/src/routes/contributors.ts`**

```ts
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import { createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const contributors = new Hono<{ Variables: AuthVariables }>()

contributors.get('/me', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', c.get('userId'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

contributors.post('/me/tutorials/:tutorialId', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('tutorial_contributors')
    .insert({ tutorial_id: c.req.param('tutorialId'), profile_id: c.get('userId') })
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 201)
})

export default contributors
```

- [ ] **Step 8: Create `packages/api/src/routes/public.ts`**

Unauthenticated read-only endpoints for the library. The library page must not require a JWT so anonymous visitors can browse.

```ts
import { Hono } from 'hono'
import { createAdminClient } from '../supabase/client.js'

const publicRoutes = new Hono()

publicRoutes.get('/tutorials', async (c) => {
  const supabase = createAdminClient()
  const difficulty = c.req.query('difficulty')
  let query = supabase
    .from('tutorials')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

publicRoutes.get('/tutorials/:id', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tutorials')
    .select('*, parts(*), tools(*), stl_files(*)')
    .eq('id', c.req.param('id'))
    .eq('status', 'approved')
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

export default publicRoutes
```

- [ ] **Step 9: Update `packages/api/src/index.ts` to mount all routes**

Note: auth middleware is applied per-route-group, not globally, so public routes remain unauthenticated.

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth.js'
import publicRoutes from './routes/public.js'
import tutorials from './routes/tutorials.js'
import upload from './routes/upload.js'
import parts from './routes/parts.js'
import tools from './routes/tools.js'
import stlFiles from './routes/stl-files.js'
import admin from './routes/admin.js'
import contributors from './routes/contributors.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

// Public routes — no auth required
app.route('/api/public', publicRoutes)

// Protected routes — auth required
app.use('/api/tutorials/*', authMiddleware)
app.use('/api/tutorials', authMiddleware)
app.use('/api/upload/*', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.use('/api/contributors/*', authMiddleware)

app.route('/api/tutorials', tutorials)
app.route('/api/upload', upload)
app.route('/api/tutorials', parts)
app.route('/api/tutorials', tools)
app.route('/api/tutorials', stlFiles)
app.route('/api/admin', admin)
app.route('/api/contributors', contributors)

const port = parseInt(process.env.PORT ?? '3001')
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})

export default app
```

- [ ] **Step 9: Typecheck**

```bash
pnpm --filter @splat-connect/api typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/api/src
git commit -m "feat(api): implement all Hono routes (tutorials, upload, parts, tools, stl-files, admin, contributors)"
```

---

## Task 7: Create `api-client` in `packages/web`

**Files:**
- Create: `packages/web/lib/api-client.ts` (server-only)
- Create: `packages/web/lib/browser-api-client.ts` (client-only)

- [ ] **Step 1: Install `server-only` package**

```bash
pnpm --filter @splat-connect/web add server-only
```

- [ ] **Step 2: Create `packages/web/lib/api-client.ts`**

For use in Server Components only. Reads the Supabase session from SSR cookies and attaches the JWT to every API request.

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  get:    <T>(path: string)               => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
}
```

- [ ] **Step 3: Add `API_URL` to `packages/web/.env.local`**

```
API_URL=http://localhost:3001
```

(This is server-side only — no `NEXT_PUBLIC_` prefix needed here.)

- [ ] **Step 4: Create `packages/web/lib/browser-api-client.ts`**

For use in Client Components (`'use client'`) that need to call the API directly from the browser (e.g., the upload form).

```ts
'use client'

import { createClient } from '@/lib/supabase/client'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const browserApiClient = {
  get:          <T>(path: string)                        => request<T>('GET',  path),
  post:         <T>(path: string, body: unknown)          => request<T>('POST', path, body),
  patch:        <T>(path: string, body: unknown)          => request<T>('PATCH', path, body),
  delete:       <T>(path: string)                        => request<T>('DELETE', path),
  postFormData: <T>(path: string, formData: FormData)    => requestFormData<T>('POST', path, formData),
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @splat-connect/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/lib/api-client.ts packages/web/lib/browser-api-client.ts packages/web/.env.local
git commit -m "feat(web): add api-client and browser-api-client wrappers"
```

---

## Task 8: Migrate pages from Supabase direct calls to api-client

This is the largest task. Each page currently imports `createClient` from `@/lib/supabase/server` and calls `supabase.from(...)` directly. Replace every such call with `apiClient` (Server Components) or `browserApiClient` (Client Components).

**Files:**
- Modify: `packages/web/app/layout.tsx`
- Modify: `packages/web/app/library/page.tsx`
- Modify: `packages/web/app/library/library-client.tsx`
- Modify: `packages/web/app/my-tutorials/page.tsx`
- Modify: `packages/web/app/dashboard/page.tsx`
- Modify: `packages/web/app/tutorials/[id]/page.tsx`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`
- Modify: `packages/web/app/upload/page.tsx`
- Modify: `packages/web/app/admin/page.tsx`
- Modify: `packages/web/app/admin/contributors/page.tsx`
- Modify: `packages/web/app/admin/review/page.tsx`
- Modify: `packages/web/app/admin/review/[id]/page.tsx`

- [ ] **Step 1: Update `packages/web/app/layout.tsx`**

Replace the Supabase calls with a single API call:

```ts
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { apiClient } from '@/lib/api-client'
import type { Role } from '@splat-connect/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SPLAT Connect — Toy Adaptation Library',
  description: 'Open-source tutorials for switch-adapting toys for children with disabilities',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let role: Role | null = null
  try {
    const profile = await apiClient.get<{ role: Role }>('/api/contributors/me')
    role = profile.role
  } catch {
    // unauthenticated — role stays null
  }

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <Nav role={role} />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update `packages/web/app/library/page.tsx`**

The library is public — use the unauthenticated `/api/public/tutorials` endpoint. Do not use `apiClient` (which attaches a JWT) for this page; use a plain `fetch` call or a helper that skips auth.

```ts
import type { Tutorial } from '@splat-connect/types'
import { LibraryClient } from './library-client'

export default async function LibraryPage() {
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
  const tutorials: Tutorial[] = await res.json()
  return <LibraryClient tutorials={tutorials} />
}
```

- [ ] **Step 3: Update `packages/web/app/my-tutorials/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'
import type { Tutorial } from '@splat-connect/types'
import Link from 'next/link'

export default async function MyTutorialsPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/tutorials/mine')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Tutorials</h1>
      {tutorials.length === 0 ? (
        <p className="text-gray-500">No tutorials yet. <Link href="/upload" className="text-blue-600 underline">Upload one.</Link></p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tutorials.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2 pr-4">{t.title}</td>
                <td className="py-2 pr-4 capitalize">{t.status}</td>
                <td className="py-2">
                  <Link href={`/tutorials/${t.id}/edit`} className="text-blue-600 underline text-sm">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `packages/web/app/dashboard/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'
import type { Tutorial } from '@splat-connect/types'
import Link from 'next/link'

export default async function DashboardPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/tutorials/mine')

  const counts = {
    draft: tutorials.filter((t) => t.status === 'draft').length,
    pending: tutorials.filter((t) => t.status === 'pending').length,
    approved: tutorials.filter((t) => t.status === 'approved').length,
    rejected: tutorials.filter((t) => t.status === 'rejected').length,
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold">{count}</div>
            <div className="text-sm text-gray-500 capitalize">{status}</div>
          </div>
        ))}
      </div>
      <h2 className="text-xl font-semibold mb-4">Recent Tutorials</h2>
      <div className="space-y-2">
        {tutorials.slice(0, 5).map((t) => (
          <div key={t.id} className="flex justify-between items-center bg-white rounded p-3 shadow-sm">
            <span>{t.title}</span>
            <Link href={`/tutorials/${t.id}/edit`} className="text-blue-600 text-sm underline">Edit</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `packages/web/app/tutorials/[id]/page.tsx`**

Tutorial detail is also public — use the unauthenticated public endpoint.

```ts
import type { TutorialWithDetails } from '@splat-connect/types'

export default async function TutorialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials/${id}`, { cache: 'no-store' })
  const tutorial: TutorialWithDetails = await res.json()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{tutorial.title}</h1>
      {tutorial.description && <p className="text-gray-600 mb-6">{tutorial.description}</p>}

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Parts</h2>
        <ul className="list-disc list-inside space-y-1">
          {tutorial.parts.map((p) => (
            <li key={p.id}>{p.name} × {p.quantity}{p.is_optional ? ' (optional)' : ''}</li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Tools</h2>
        <ul className="list-disc list-inside space-y-1">
          {tutorial.tools.map((t) => (
            <li key={t.id}>{t.name}{t.is_optional ? ' (optional)' : ''}</li>
          ))}
        </ul>
      </section>

      {tutorial.stl_files.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-2">STL Files</h2>
          <ul className="space-y-1">
            {tutorial.stl_files.map((f) => (
              <li key={f.id}>
                <a href={f.file_url} className="text-blue-600 underline">{f.filename}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Update `packages/web/app/admin/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'
import type { Tutorial } from '@splat-connect/types'
import Link from 'next/link'

export default async function AdminPage() {
  const pending = await apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-4 mb-6 inline-block">
        <div className="text-3xl font-bold">{pending.length}</div>
        <div className="text-sm text-gray-500">Pending Review</div>
      </div>
      <h2 className="text-xl font-semibold mb-4">Pending Tutorials</h2>
      <div className="space-y-2">
        {pending.map((t) => (
          <div key={t.id} className="flex justify-between items-center bg-white rounded p-3 shadow-sm">
            <span>{t.title}</span>
            <Link href={`/admin/review/${t.id}`} className="text-blue-600 text-sm underline">Review</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Update `packages/web/app/admin/contributors/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'

interface Profile {
  id: string
  name: string | null
  is_approved: boolean
  created_at: string
}

export default async function ContributorsPage() {
  const contributors = await apiClient.get<Profile[]>('/api/admin/contributors')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contributors</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {contributors.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2 pr-4">{c.name ?? 'Unknown'}</td>
              <td className="py-2 pr-4">{c.is_approved ? 'Approved' : 'Pending'}</td>
              <td className="py-2">{new Date(c.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 8: Update `packages/web/app/admin/review/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'
import type { Tutorial } from '@splat-connect/types'
import Link from 'next/link'

export default async function ReviewPage() {
  const tutorials = await apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Review Queue</h1>
      {tutorials.length === 0 ? (
        <p className="text-gray-500">No tutorials pending review.</p>
      ) : (
        <div className="space-y-3">
          {tutorials.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow p-4 flex justify-between items-center">
              <div>
                <div className="font-semibold">{t.title}</div>
                <div className="text-sm text-gray-500 capitalize">{t.difficulty}</div>
              </div>
              <Link href={`/admin/review/${t.id}`} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
                Review
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Update `packages/web/app/admin/review/[id]/page.tsx`**

```ts
import { apiClient } from '@/lib/api-client'
import type { TutorialWithDetails } from '@splat-connect/types'
import Link from 'next/link'

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/admin/review" className="text-blue-600 text-sm underline mb-4 block">← Back to queue</Link>
      <h1 className="text-2xl font-bold mb-4">{tutorial.title}</h1>
      <p className="text-sm text-gray-500 mb-6 capitalize">Difficulty: {tutorial.difficulty}</p>

      <section className="mb-4">
        <h2 className="font-semibold mb-1">Parts ({tutorial.parts.length})</h2>
        <ul className="list-disc list-inside text-sm">
          {tutorial.parts.map((p) => <li key={p.id}>{p.name} × {p.quantity}</li>)}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-1">Tools ({tutorial.tools.length})</h2>
        <ul className="list-disc list-inside text-sm">
          {tutorial.tools.map((t) => <li key={t.id}>{t.name}</li>)}
        </ul>
      </section>

      <div className="flex gap-4">
        <form action={`/api/admin/tutorials/${id}/status`} method="POST">
          <input type="hidden" name="status" value="approved" />
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded">Approve</button>
        </form>
        <form action={`/api/admin/tutorials/${id}/status`} method="POST">
          <input type="hidden" name="status" value="rejected" />
          <button type="submit" className="bg-red-600 text-white px-6 py-2 rounded">Reject</button>
        </form>
      </div>
    </div>
  )
}
```

**Note:** The approve/reject buttons above use HTML forms pointing at the API. In a future iteration these should become client-side calls with `browserApiClient` so the page can show feedback without a full reload. For now this is intentionally simple.

- [ ] **Step 10: Update `packages/web/app/upload/page.tsx`**

The upload page is a `'use client'` component. Replace every `supabase.from(...)` and `supabase.storage...` call with `browserApiClient` equivalents.

Find every Supabase call in the file:

```bash
grep -n "supabase\." packages/web/app/upload/page.tsx
```

Replace the import block at the top:

```ts
// REMOVE:
import { createClient } from '@/lib/supabase/client'

// ADD:
import { browserApiClient } from '@/lib/browser-api-client'
```

Replace the tutorial upsert (currently `supabase.from('tutorials').upsert(...)`):

```ts
await browserApiClient.post('/api/tutorials', {
  id: tutorialId,
  title: draft.title,
  difficulty: draft.difficulty,
  description: null,
  tutorial_pdf_url: draft.tutorial_pdf_url || null,
  toy_photo_url: draft.toy_photo_url || null,
})
```

Replace tutorial_contributors insert:

```ts
await browserApiClient.post(`/api/contributors/me/tutorials/${tutorialId}`, {})
```

Replace parts insert:

```ts
await browserApiClient.post(`/api/tutorials/${tutorialId}/parts`, { parts: draft.parts })
```

Replace tools insert:

```ts
await browserApiClient.post(`/api/tutorials/${tutorialId}/tools`, { tools: draft.tools })
```

Replace stl_files insert:

```ts
await browserApiClient.post(`/api/tutorials/${tutorialId}/stl-files`, { stl_files: draft.stl_files })
```

Replace the status update to 'pending':

```ts
await browserApiClient.patch(`/api/tutorials/${tutorialId}`, { status: 'pending' })
```

Replace PDF storage upload (currently `supabase.storage.from('tutorial-pdfs').upload(...)`):

```ts
const pdfForm = new FormData()
pdfForm.append('file', pdfFile)
pdfForm.append('tutorialId', tutorialId)
const { url } = await browserApiClient.postFormData<{ url: string }>('/api/upload/pdf', pdfForm)
setDraft((d) => ({ ...d, tutorial_pdf_url: url }))
```

Replace photo storage upload similarly with `/api/upload/photo`.

Replace STL storage uploads with `/api/upload/stl`.

- [ ] **Step 11: Update `packages/web/app/tutorials/[id]/edit/page.tsx`**

This page is a Server Component with server actions. Replace all direct Supabase calls:

Top of file:
```ts
import { apiClient } from '@/lib/api-client'
import type { TutorialWithDetails } from '@splat-connect/types'
```

Data fetch:
```ts
const tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
```

Server actions in this file that call `supabase` must be replaced with `fetch` to the API using the session token. Because server actions run server-side, use the same `getToken()` pattern from `api-client.ts`.

For each server action that updates tutorial data:
```ts
'use server'
// In each action, call the API directly since we are server-side:
const { cookies } = await import('next/headers')
const { createServerClient } = await import('@supabase/ssr')
const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
)
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

const res = await fetch(`${process.env.API_URL}/api/tutorials/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(updatePayload),
})
```

- [ ] **Step 12: Run typecheck to find remaining issues**

```bash
pnpm --filter @splat-connect/web typecheck
```

Fix any remaining type errors before proceeding.

- [ ] **Step 13: Delete `packages/web/lib/supabase/client.ts`**

The browser Supabase client is still needed by `browser-api-client.ts` for auth token reading. Do NOT delete it. Only delete if the file has no remaining importers:

```bash
grep -rl "lib/supabase/client" packages/web
```

If the only importer is `browser-api-client.ts`, keep it. If nothing imports it, delete it.

- [ ] **Step 14: Start both servers and smoke test**

Terminal 1:
```bash
pnpm --filter @splat-connect/api dev
```

Terminal 2:
```bash
pnpm --filter @splat-connect/web dev
```

Open http://localhost:3000 and verify:
- Library page loads (unauthenticated)
- Login redirects correctly by role
- Contributor dashboard shows tutorials
- Admin review queue shows pending tutorials

- [ ] **Step 15: Run full typecheck across all packages**

```bash
pnpm -r typecheck
```

Expected: no errors across all three packages.

- [ ] **Step 16: Commit**

```bash
git add packages/web/app packages/web/lib
git commit -m "feat(web): migrate all pages from Supabase direct calls to API client"
```

---

## Phase 1 Complete

At this point the monorepo is fully functional:

- `packages/types` — shared interfaces, imported by both packages
- `packages/api` — Hono server owning all Supabase data operations, running on port 3001
- `packages/web` — Next.js app with no direct Supabase data calls, running on port 3000

The app should behave identically to before the refactor. All existing functionality (upload, edit, admin review, auth) works through the API layer.

**Next:** Implement `docs/superpowers/plans/2026-05-26-comprehensive-testing.md` to add unit, integration, and E2E test coverage.
