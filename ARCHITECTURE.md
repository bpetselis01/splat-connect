# SPLAT Connect — Architecture

**S**upporting **P**lay by **A**dapting **T**oys. Diagrams below are traced from the source in
`packages/`, `supabase/migrations/`, and `.github/workflows/ci.yml` — not from the summary in the
README.

**Layers as declared:**

| Layer | Stack | Location |
|---|---|---|
| Client — web | Next.js 16.2.6, React 19.2.4, Tailwind 4 | `packages/web` |
| Client — mobile | Expo 57, React Native 0.86, expo-router | `packages/mobile` |
| Shared contract | TypeScript types, no runtime code | `packages/types` |
| Server / API | Hono 4 on Node 22, `@hono/node-server` | `packages/api` |
| Persistence | Supabase — Postgres + RLS, Auth, Storage | `supabase/migrations` |
| CI | GitHub Actions, local Supabase per job | `.github/workflows/ci.yml` |

The architectural fact that shapes every diagram below: **the API never trusts its own privileges to
answer a user's question.** `middleware/auth.ts` uses a service-role admin client purely to *verify*
the JWT, then every route re-issues a second client bound to that same user JWT
(`supabase/user-client.ts`) so Postgres RLS — not application code — decides which rows come back.
Authorization lives in `001_schema.sql` and `003_ability_profile.sql`, not in the route handlers.

---

## 1. Layered Architecture

```mermaid
flowchart TB
    subgraph CLI["1 · CLIENT LAYER"]
        direction LR
        subgraph WEB["packages/web — Next.js 16.2.6 · React 19 · Tailwind 4"]
            WL["app/layout.tsx · components/nav.tsx"]
            WPUB["app/page.tsx · app/library<br/>public browse"]
            WAUTH["app/login · app/signup<br/>app/auth/confirmed"]
            WCON["app/dashboard · app/my-tutorials<br/>app/upload · app/tutorials/[id]/edit<br/>contributor workspace"]
            WADM["app/admin · app/admin/review/[id]<br/>app/admin/contributors"]
            WAPI["lib/api-client.ts — server-only<br/>lib/browser-api-client.ts<br/>lib/supabase/client.ts · lib/auth.ts"]
        end
        subgraph MOB["packages/mobile — Expo 57 · RN 0.86 · expo-router"]
            MROOT["app/_layout.tsx<br/>AuthProvider + font gate"]
            MTAB["app/(tabs)/_layout.tsx<br/>home · toy-library · scanner<br/>print · profile"]
            MPROF["profile/index · ability<br/>everyday-needs · customization"]
            MHOME["home/index · home/[id]<br/>home/[id]/preview"]
            MLIB["lib/api-client.ts · lib/supabase.ts<br/>lib/supabase-storage.ts<br/>lib/auth-context.tsx<br/>lib/use-child-profile.ts<br/>lib/estimate-ability.ts"]
        end
    end

    TYPES["2 · SHARED CONTRACT — packages/types/src/index.ts<br/>Tutorial · TutorialWithDetails · Profile · Role<br/>Difficulty · Part · Tool · StlFile · BuyLink · ChildProfile"]

    subgraph API["3 · SERVER / API LAYER — Hono 4 · Node 22 · packages/api"]
        direction TB
        APP["src/app.ts — CORS · route mounting<br/>src/index.ts — @hono/node-server"]
        MW["src/middleware/auth.ts<br/>Bearer JWT to userId · role · token"]
        RPUB["routes/public.ts<br/>NO auth"]
        RPROT["routes/tutorials.ts · parts.ts · tools.ts<br/>stl-files.ts · upload.ts · admin.ts<br/>contributors.ts · child-profile.ts"]
        SBA["supabase/client.ts<br/>ADMIN client — service role<br/>bypasses RLS"]
        SBU["supabase/user-client.ts<br/>USER client — anon key + caller JWT<br/>RLS enforced"]
    end

    subgraph SUP["4 · PERSISTENCE — Supabase"]
        direction TB
        AUTH["Auth · auth.users<br/>trigger on_auth_user_created"]
        DB[("Postgres + RLS<br/>profiles · tutorials<br/>tutorial_contributors<br/>parts · tools · stl_files<br/>child_profiles")]
        ST["Storage — 3 public buckets<br/>tutorial-pdfs · toy-photos · stl-files"]
    end

    WL --> WPUB & WAUTH & WCON & WADM
    WCON & WADM & WPUB --> WAPI
    MROOT --> MTAB --> MPROF & MHOME
    MPROF & MHOME --> MLIB

    WAPI ==>|"fetch + Bearer JWT<br/>NEXT_PUBLIC_API_URL"| APP
    MLIB ==>|"fetch + Bearer JWT<br/>EXPO_PUBLIC_API_URL"| APP
    WAPI -.->|"@supabase/ssr — session"| AUTH
    MLIB -.->|"supabase-js + SecureStore — session"| AUTH

    WEB -.->|import type| TYPES
    MOB -.->|import type| TYPES
    API -.->|import type| TYPES

    APP --> RPUB
    APP --> MW --> RPROT
    MW ==>|"auth.getUser token<br/>then profiles.role lookup"| SBA
    RPROT --> SBU
    RPUB --> SBU
    SBA ==> AUTH
    SBU ==>|"PostgREST · RLS on every row"| DB
    RPROT -->|"upload.ts · upsert true"| ST

    style MW stroke:#d97706,stroke-width:3px
    style SBA stroke:#dc2626,stroke-width:2px
    style SBU stroke:#16a34a,stroke-width:2px
```

The two Supabase clients are the load-bearing distinction. `createAdminClient()` holds
`SUPABASE_SERVICE_ROLE_KEY` and ignores RLS entirely — it is reached from exactly one place in a
request path, `authMiddleware`, to answer "is this token real, and what role does it carry?"
Everything that touches user data goes through `createUserClient(token)`, which forwards the caller's
JWT so `auth.uid()` resolves inside the policies. A route that reached for the admin client by
mistake would silently return every row in the table.

Note the asymmetry between clients: web has two API clients (`api-client.ts` is `server-only`,
`browser-api-client.ts` is for client components), while mobile has one, because every mobile screen
is a client component by definition.

---

## 2. Module Dependency Graph

```mermaid
flowchart LR
    subgraph T["packages/types"]
        TY["src/index.ts<br/>zero runtime code"]
    end

    subgraph M["packages/mobile"]
        MS["app/(tabs)/profile/ability.tsx"]
        AS["components/profile/ability-screen.tsx"]
        UCP["lib/use-child-profile.ts<br/>debounce 250ms · optimistic · dirty flag"]
        EA["lib/estimate-ability.ts<br/>pure · no imports"]
        MAC["lib/api-client.ts"]
        MSB["lib/supabase.ts"]
        MST["lib/supabase-storage.ts<br/>SecureStore or localStorage"]
        MTH["lib/theme.ts"]
        MUI["components/ui/*<br/>Button · Card · Chip · Section<br/>TextField · AnimatedPressable"]

        MS --> AS
        AS --> UCP & EA & MUI & MTH
        UCP --> MAC --> MSB --> MST
        MUI --> MTH
    end

    subgraph W["packages/web"]
        WP["app/**/page.tsx"]
        WSC["lib/api-client.ts<br/>server-only"]
        WBC["lib/browser-api-client.ts"]
        WSU["lib/supabase/client.ts<br/>@supabase/ssr"]
        WV["lib/validation.ts"]
        WP --> WSC & WBC & WV
        WBC --> WSU
        WSC --> WSU
    end

    subgraph A["packages/api"]
        AAP["src/app.ts"]
        AMW["src/middleware/auth.ts"]
        ACP["routes/child-profile.ts"]
        AOT["routes/tutorials · parts · tools<br/>stl-files · upload · admin<br/>contributors · public"]
        AAD["supabase/client.ts — admin"]
        AUC["supabase/user-client.ts"]
        AEN["src/env.ts"]

        AAP --> AMW
        AAP --> ACP & AOT
        AMW --> AAD
        ACP --> AUC
        AOT --> AUC
        AAP --> AEN
    end

    MAC ==>|"HTTP · JSON · Bearer"| AAP
    WSC ==>|"HTTP · JSON · Bearer"| AAP
    WBC ==>|"HTTP · JSON · Bearer"| AAP

    AUC ==>|"@supabase/supabase-js"| SB[("Supabase")]
    AAD ==> SB
    MSB ==> SB
    WSU ==> SB

    TY -.->|"type-only import<br/>workspace:*"| M
    TY -.->|"type-only import"| W
    TY -.->|"type-only import"| A

    style TY stroke:#d97706,stroke-width:2px
    style EA stroke:#16a34a,stroke-width:2px
```

`@splat-connect/types` is imported by all three packages but has no build step and no dependencies —
it is exported straight from `./src/index.ts` and consumed as TypeScript source through pnpm's
`workspace:*` link. That is why `pnpm -r typecheck` is a meaningful CI gate: it is the only place
where a contract break between mobile, web, and API is caught at all.

`lib/estimate-ability.ts` imports nothing. That is deliberate and it is what makes the clinical
mapping unit-testable in isolation (`tests/unit/lib/estimate-ability.test.ts`) without an Expo
runtime — worth preserving, given the file's own comment flags the mapping as a placeholder awaiting
domain review.

---

## 3. Persistence Model

Reconstructed from `supabase/migrations/001_schema.sql` and `003_ability_profile.sql`.

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "trigger on_auth_user_created"
    PROFILES ||--o{ TUTORIAL_CONTRIBUTORS : authors
    TUTORIALS ||--o{ TUTORIAL_CONTRIBUTORS : "credited to"
    TUTORIALS ||--o{ PARTS : requires
    TUTORIALS ||--o{ TOOLS : requires
    TUTORIALS ||--o{ STL_FILES : "prints from"
    PROFILES ||--o| CHILD_PROFILES : "one per parent"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb raw_user_meta_data "role whitelisted to parent"
    }
    PROFILES {
        uuid id PK "FK auth.users, cascade"
        text name
        text email
        text role "admin | contributor | parent"
        boolean approved
        timestamptz created_at
    }
    TUTORIALS {
        uuid id PK
        text title
        text description
        text difficulty "easy | medium | hard"
        text status "draft | pending | approved | rejected"
        text tutorial_pdf_url
        text toy_photo_url
        text rejection_note
        timestamptz created_at
        timestamptz reviewed_at
    }
    TUTORIAL_CONTRIBUTORS {
        uuid tutorial_id PK "FK, cascade"
        uuid profile_id PK "FK, cascade"
        text role "primary | collaborator"
        timestamptz added_at
    }
    PARTS {
        uuid id PK
        uuid tutorial_id FK "cascade"
        text name
        integer quantity
        boolean is_optional
        jsonb buy_links "array of label + url"
    }
    TOOLS {
        uuid id PK
        uuid tutorial_id FK "cascade"
        text name
        boolean is_optional
        jsonb buy_links
    }
    STL_FILES {
        uuid id PK
        uuid tutorial_id FK "cascade"
        text filename
        text file_url
    }
    CHILD_PROFILES {
        uuid id PK
        uuid parent_id FK "UNIQUE, cascade"
        integer age
        text primary_diagnosis
        text macs_level
        text macs_source "manual | estimated"
        text hand_involvement "bilateral | unilateral"
        text assist_hand "left | right"
        text bfmf_score
        text bfmf_source "manual | estimated"
        text_array challenges
        text challenge_other
        text grip_type
        text env_context
        numeric palm_width_mm
        numeric wrist_circ_mm
        boolean needs_arm_attachment
        numeric forearm_length_mm
        text hand_dominance
        text_array sensory_preferences
        timestamptz updated_at
    }
```

Every relationship here is a real declared foreign key with `on delete cascade` — deleting a
`tutorials` row takes its parts, tools, STL files, and contributor links with it, and deleting an
`auth.users` row takes the whole profile subtree.

Two constraints carry design intent rather than just integrity:

- `child_profiles.parent_id` is **unique but not the primary key**. Multi-child support is one
  `drop constraint` away, and until then the unique index is what makes
  `upsert(row, { onConflict: 'parent_id' })` in `routes/child-profile.ts` a safe idempotent write.
- `tutorials` RLS splits `USING` from `WITH CHECK`: contributors may *read and edit* their own
  tutorials at any status, but `WITH CHECK` restricts the resulting status to
  `draft | pending | rejected`. Self-approval is structurally impossible, not merely unimplemented.

Row access is summarized below; the policies themselves live in `supabase/SCHEMA.md`.

```mermaid
flowchart LR
    AN["anon"] -->|SELECT| APP2["tutorials WHERE status = approved<br/>+ their parts / tools / stl_files"]
    CO["contributor<br/>approved = true"] -->|"INSERT · SELECT · UPDATE own<br/>DELETE own drafts"| OWN["own tutorials, any status"]
    PA["parent"] -->|"SELECT · INSERT · UPDATE<br/>WHERE parent_id = auth.uid()"| CP["own child_profiles row"]
    AD["admin<br/>is_admin()"] -->|ALL| EV["every table"]
```

---

## 4. Primary Data Flow — mobile Ability Profile

`/get`-scale end-to-end flows exist for every screen; this traces **one**: a parent opening the
Ability tab, answering the four screening questions, and having an estimated MACS/BFMF written back.
It is the flow that touches the most layers — local pure logic, optimistic UI, debounced write,
JWT minting from device storage, dual-client auth, a column whitelist, and RLS.

```mermaid
sequenceDiagram
    autonumber
    actor U as Parent
    participant AS as ability-screen.tsx
    participant EA as estimate-ability.ts
    participant H as use-child-profile.ts
    participant AC as lib/api-client.ts
    participant SS as supabase-storage.ts<br/>SecureStore
    participant API as Hono app.ts
    participant MW as middleware/auth.ts
    participant CP as routes/child-profile.ts
    participant SB as Supabase<br/>PostgREST + RLS
    participant PG as Postgres

    Note over AS,H: MOUNT — load existing profile
    U->>AS: open Profile ▸ Ability
    AS->>H: useChildProfile()
    activate H
    H->>AC: get /api/child-profile
    AC->>SS: supabase.auth.getSession()
    SS-->>AC: access_token
    AC->>API: GET /api/child-profile<br/>Authorization Bearer JWT
    API->>MW: authMiddleware
    MW->>SB: admin client · auth.getUser(token)
    SB-->>MW: user
    MW->>SB: admin client · profiles.role WHERE id = user.id
    SB-->>MW: role = parent
    MW->>CP: c.set userId · role · token
    CP->>CP: guard — role !== 'parent' would 403 here
    CP->>SB: user client · child_profiles<br/>.eq parent_id, userId .maybeSingle()
    SB->>PG: SELECT with RLS parent_id = auth.uid()
    PG-->>SB: row or none
    SB-->>CP: data
    CP-->>API: 200 · row or null
    API-->>AC: JSON
    AC-->>H: ChildProfile | null
    H->>H: if !dirty.current then setProfile(p)
    Note over H: the dirty flag exists so a slow mount GET<br/>cannot clobber edits already typed
    H-->>AS: profile, loading = false
    deactivate H

    Note over U,EA: ESTIMATE — entirely on-device, no network
    U->>AS: expand "Not sure of the clinical terms?"
    loop 4 questions
        U->>AS: tap a Chip
        AS->>AS: setAnswer(qi, oi) — local useState
    end
    AS->>AS: Button disabled until answered === QUESTIONS.length
    U->>AS: press "Estimate"
    AS->>EA: estimateAbility(answers)
    EA->>EA: sum answers → 0..12<br/>index MACS_BY_TOTAL / BFMF_BY_TOTAL
    EA-->>AS: { macs, bfmf }
    Note right of EA: placeholder clinical mapping —<br/>flagged in-file as needing MACS/BFMF<br/>domain review before production use

    Note over AS,PG: SAVE — optimistic, debounced, whitelisted
    AS->>H: save({ macs_level, bfmf_score,<br/>macs_source: estimated, bfmf_source: estimated })
    activate H
    H->>H: dirty.current = true
    H->>AS: setProfile(prev merged with patch) — OPTIMISTIC
    AS-->>U: dropdowns show the estimate immediately
    H->>H: pending.current merged · clearTimeout · setTimeout 250ms
    Note over H: further edits inside 250ms coalesce<br/>into ONE request body

    H->>AC: put /api/child-profile, pending
    deactivate H
    AC->>SS: getSession()
    SS-->>AC: access_token
    AC->>API: PUT /api/child-profile<br/>Bearer JWT · JSON body
    API->>MW: authMiddleware
    MW->>SB: verify token · fetch role
    SB-->>MW: parent
    MW->>CP: next()
    CP->>CP: reject non-object / array body → 400
    CP->>CP: row = { parent_id: userId,<br/>updated_at: now() }
    loop for key of EDITABLE
        CP->>CP: copy key from body if present
    end
    Note over CP: TRUST BOUNDARY — parent_id and updated_at are<br/>server-set. id, role, and any unknown key in the<br/>request body are dropped, not merged

    CP->>SB: user client · child_profiles<br/>.upsert(row, onConflict parent_id).select().single()
    SB->>PG: INSERT ... ON CONFLICT (parent_id) DO UPDATE
    Note over PG: RLS evaluates BOTH the INSERT policy and the<br/>UPDATE policy — both require parent_id = auth.uid()
    alt row satisfies RLS
        PG-->>SB: written row
        SB-->>CP: data
        CP-->>API: 200 · full ChildProfile
        API-->>AC: JSON
        AC-->>H: ChildProfile
    else RLS or constraint violation
        PG-->>SB: error
        SB-->>CP: error
        CP-->>API: 500 · { error: message }
        API-->>AC: 500
        AC->>AC: throw new Error(API PUT ... failed with status 500)
        AC-->>H: rejection
        H->>H: .catch(() => {})
        Note over H,AS: the optimistic UI is NOT rolled back —<br/>a failed write leaves the screen showing<br/>a value the database never accepted
    end
```

Three properties of this flow are worth stating plainly because they are decisions, not accidents:

**The debounce and the dirty flag solve opposite races.** The 250 ms timer coalesces a burst of
dropdown changes into one `PUT`; the `dirty` ref stops the mount-time `GET` from overwriting those
same changes if it resolves late. Removing either one reintroduces a distinct bug.

**The `EDITABLE` array is the trust boundary.** `routes/child-profile.ts` builds the upsert row by
copying *from* a whitelist rather than spreading the request body and deleting keys. A client that
sends `{ parent_id: "<someone else's uuid>" }` has that key ignored at the API — and even if the API
missed it, the RLS `WITH CHECK (parent_id = auth.uid())` would reject the write. Two independent
layers, which is the correct number for a row-ownership rule.

**Failure is silent by design gap, not by choice.** `apiClient` builds a genuinely useful error
message (method, path, status, and the server's `error` field), and then `use-child-profile.ts`
swallows it with `.catch(() => {})`. The optimistic state stays. For a form that autosaves without a
visible save button, the parent has no way to learn that their child's ability data did not persist.
That is the one gap in this flow worth closing first — a `failed` flag alongside `profile` and
`loading` would surface it without changing the request path at all.

---

## 5. CI Pipeline

From `.github/workflows/ci.yml`. There is no CD workflow in this repository — CI is the whole
pipeline.

```mermaid
flowchart TB
    subgraph TRIG["Triggers"]
        T1["push → main only"]
        T2["pull_request — any branch"]
        T3["workflow_dispatch"]
    end

    CC["concurrency group = workflow + ref<br/>cancel-in-progress UNLESS ref is main"]
    T1 & T2 & T3 --> CC

    CC --> CH["changes · Detect Changed Packages<br/>dorny/paths-filter@v3"]
    CC --> CK["check · Type Check<br/>pnpm -r typecheck"]
    CC --> TE["test · Unit Tests<br/>api → web → mobile, sequential"]

    CH -.->|"outputs: api · web · mobile<br/>shared paths set ALL THREE:<br/>packages/api, packages/types,<br/>supabase, ci.yml, lockfile,<br/>workspace, root package.json"| GATE{{"per-package gates"}}

    CK --> GATE
    TE --> GATE

    GATE -->|"if changes.api"| IT["integration · Integration Tests"]
    GATE -->|"if changes.mobile"| ME["mobile-e2e · Mobile E2E"]
    GATE -->|"if changes.web"| WE["web-e2e · Web E2E"]

    CK --> DE
    TE --> DE["device-e2e · Device E2E Android<br/>if ref == main OR workflow_dispatch<br/>NOTE: does not need 'changes'"]

    subgraph IT2["integration — ubuntu-latest"]
        I1["supabase/setup-cli pinned 2.109.1"]
        I2["sysctl reserve ports 54320-54329<br/>they sit inside the ephemeral range"]
        I3["supabase start"]
        I4["vitest -c vitest.integration.config.ts"]
        I5["supabase stop · if always()"]
        I1 --> I2 --> I3 --> I4 --> I5
    end

    subgraph ME2["mobile-e2e — ubuntu-latest"]
        M1["supabase start"]
        M2["playwright install chromium"]
        M3["playwright test<br/>webServer boots API :3102<br/>+ expo export -p web served on :3103"]
        M4["supabase stop"]
        M1 --> M2 --> M3 --> M4
    end

    subgraph WE2["web-e2e — ubuntu-latest"]
        W1["supabase start"]
        W2["playwright install chromium"]
        W3["playwright test<br/>webServer boots API :3104<br/>+ next build && next start on :3105"]
        W4["supabase stop"]
        W1 --> W2 --> W3 --> W4
    end

    subgraph DE2["device-e2e — ubuntu-latest"]
        D1["setup-java 17 temurin"]
        D2["actions/cache — app-release.apk<br/>key hashes app.json, package.json,<br/>lockfile, ci.yml, app/, components/,<br/>lib/, assets/, packages/types"]
        D3["expo prebuild --clean<br/>+ gradlew assembleRelease<br/>skipped on cache hit"]
        D4["supabase start · reserve ports"]
        D5["start API on :3106<br/>curl retry loop, 60 × 2s"]
        D6["device:fixture → GITHUB_ENV<br/>--silent is load-bearing"]
        D7["assert bundle baked 10.0.2.2<br/>and NOT localhost:54321<br/>Hermes bytecode → grep -a, piped"]
        D8["install Maestro"]
        D9["android-emulator-runner@v2<br/>api-level 34 · pixel_6 · x86_64<br/>adb install + maestro test"]
        D10["upload maestro-debug · if failure()"]
        D1 --> D2 --> D3 --> D4 --> D5 --> D6 --> D7 --> D8 --> D9 --> D10
    end

    IT --> IT2
    ME --> ME2
    WE --> WE2
    DE --> DE2

    style CH stroke:#16a34a,stroke-width:2px
    style DE stroke:#d97706,stroke-width:2px
    style D7 stroke:#16a34a,stroke-width:2px
```

Every gated job boots its own local Supabase, which is roughly two minutes of Docker before a single
assertion runs. That cost is why `changes` exists at all: a mobile-only PR skips `integration` and
`web-e2e` entirely. The filter deliberately over-triggers on shared paths — a change to
`packages/api`, `packages/types`, `supabase/`, the lockfile, or `ci.yml` itself sets all three
outputs, because any of those can break any client.

`device-e2e` is the deliberate exception to the whole shape of this pipeline. It depends on `check`
and `test` but **not** on `changes`, and it runs only on `main` or manual dispatch, so it never gates
a PR. It is also the only job that covers `lib/supabase-storage.ts`'s SecureStore branch: the
Playwright mobile suite runs the Expo *web* export, where `resolveAuthStorage` returns the
localStorage adapter, so no Playwright test can reach the native path. Paying emulator time on every
PR to cover one branch would cost more than it saves; paying it on every merge to `main` does not.

The bundle-host assertion (`D7`) is the interesting guard. Because `EXPO_PUBLIC_*` values are *baked
into* the JS bundle at export time rather than read at runtime, a stale Metro cache can freeze a
`localhost` URL into an APK that then fails on the emulator as an inscrutable timeout. Asserting
against the built artifact rather than the environment means the check still holds on a cache hit.

---

## 6. Technology Stack

Everything the repository actually depends on, grouped by the job it does. Test tooling is split by
tier because the three tiers do not share a runner.

```mermaid
flowchart TB
    subgraph WS["Workspace & tooling"]
        direction LR
        W1["pnpm 11<br/>workspaces"]
        W2["Node 22"]
        W3["TypeScript 5<br/>mobile pins ~6.0.3"]
        W4["tsx<br/>API dev + scripts"]
        W5["dotenv · dotenv-cli<br/>root .env.local"]
        W6["ESLint 9<br/>eslint-config-next"]
    end

    subgraph SRC["Application stack"]
        direction LR
        subgraph SW["packages/web"]
            SW1["Next.js 16.2.6<br/>App Router"]
            SW2["React 19.2.4 + react-dom"]
            SW3["Tailwind CSS 4<br/>@tailwindcss/postcss"]
            SW4["@supabase/ssr 0.10<br/>cookie sessions"]
            SW5["server-only"]
        end
        subgraph SM["packages/mobile"]
            SM1["Expo SDK 57<br/>expo-router · expo-dev-client"]
            SM2["React Native 0.86<br/>react-native-web 0.21"]
            SM3["react-native-reanimated 4.5<br/>react-native-worklets"]
            SM4["expo-secure-store<br/>expo-video · expo-font<br/>expo-linking · expo-constants<br/>expo-splash-screen"]
            SM5["@expo-google-fonts/nunito<br/>@expo/vector-icons"]
            SM6["react-native-screens<br/>safe-area-context<br/>webview · url-polyfill"]
        end
        subgraph SA["packages/api"]
            SA1["Hono 4"]
            SA2["@hono/node-server"]
            SA3["@supabase/supabase-js 2"]
        end
        subgraph ST2["packages/types"]
            ST1["TypeScript source only<br/>consumed via workspace:*"]
        end
    end

    subgraph DATA["Data platform — Supabase"]
        direction LR
        D1["Postgres<br/>+ Row Level Security"]
        D2["GoTrue Auth<br/>JWT sessions"]
        D3["Storage<br/>3 public buckets"]
        D4["PostgREST<br/>Data API"]
        D5["Supabase CLI 2.109.1<br/>local stack + migrations"]
    end

    subgraph TEST["Testing"]
        direction TB
        subgraph TU["UNIT — no network, no database"]
            TU1["Vitest 2 + @vitest/coverage-v8<br/>packages/api · packages/web"]
            TU2["@testing-library/react 16<br/>@testing-library/jest-dom<br/>jsdom 24 · @vitejs/plugin-react<br/>packages/web"]
            TU3["Jest 29 + jest-expo 57<br/>@testing-library/react-native 13<br/>babel-preset-expo<br/>packages/mobile"]
        end
        subgraph TI["INTEGRATION — real Postgres, real RLS"]
            TI1["Vitest 2<br/>vitest.integration.config.ts"]
            TI2["local Supabase via CLI"]
            TI3["pg 8 · direct SQL assertions"]
            TI4["tests/helpers/auth.ts<br/>admin client creates + deletes<br/>real users per test"]
            TI5["suites: tutorials RLS ·<br/>child-profile RLS · parts-tools<br/>RLS + cascade · storage upload ·<br/>status-flow · upsert idempotency ·<br/>role assignment"]
        end
        subgraph TE["E2E — real browser or real device"]
            TE1["Playwright 1.61 · chromium<br/>packages/web<br/>against next build + next start"]
            TE2["Playwright 1.61 · chromium<br/>packages/mobile<br/>against expo export -p web<br/>served by serve 14"]
            TE3["Maestro flows<br/>real Android APK<br/>emulator api-level 34"]
            TE4["webServer boots API + client<br/>per suite, own ports"]
        end
    end

    subgraph CI["CI"]
        direction LR
        C1["GitHub Actions<br/>ubuntu-latest"]
        C2["pnpm/action-setup@v4<br/>actions/setup-node@v4<br/>actions/setup-java@v4"]
        C3["dorny/paths-filter@v3"]
        C4["supabase/setup-cli@v1"]
        C5["reactivecircus/<br/>android-emulator-runner@v2"]
        C6["actions/cache@v4<br/>APK + pnpm store"]
    end

    SW --> SA
    SM --> SA
    SA --> DATA
    SW -.-> D2
    SM -.-> D2
    ST2 -.-> SW & SM & SA

    TU -.->|"mocks the boundary"| SRC
    TI -.->|"exercises for real"| DATA
    TE -.->|"drives the built artifact"| SRC
    CI --> TEST

    style TU1 stroke:#16a34a
    style TI1 stroke:#d97706
    style TE1 stroke:#2563eb
    style TE3 stroke:#2563eb
```

The split worth internalizing is **what each tier is allowed to touch**:

| Tier | Runner | Database | Auth | What it proves |
|---|---|---|---|---|
| Unit | Vitest (api, web) / Jest + jest-expo (mobile) | none — mocked | mocked | Pure logic and component rendering. `estimateAbility`, `resolveAuthStorage`, screen states. |
| Integration | Vitest against local Supabase | **real Postgres** | **real users**, created and deleted per test | That the RLS policies actually do what `SCHEMA.md` claims — the assertions that cannot be mocked without asserting the mock. |
| E2E (web) | Playwright + chromium | real, local | real | The Next.js **production build**, not the dev server, wired to a real API. |
| E2E (mobile) | Playwright + chromium against `expo export -p web` | real, local | real | Every screen and navigation flow — but on the react-native-web target. |
| E2E (device) | Maestro on an Android emulator, release APK | real, local | real | The native-only paths, chiefly expo-secure-store session persistence across a cold start. |

Mobile is the only package with three test tiers pointed at it, and that is a direct consequence of
the Expo-web trick: running the mobile suite in a browser makes it fast and cheap enough to gate
every PR, at the cost of a coverage hole that only a real device closes. The Maestro flows exist
precisely to fill that hole and are scoped to it — `session-survives-cold-start` and
`sign-out-clears-session`, nothing more.

Port allocation follows from running these suites alongside a dev stack:

| Purpose | Web | API | Other |
|---|---|---|---|
| Local dev | 3100 | 3101 | Metro 8081 |
| Mobile E2E | 3103 | 3102 | — |
| Web E2E | 3105 | 3104 | — |
| Device E2E | — | 3106 | emulator reaches host as `10.0.2.2` |
| Supabase local | — | — | 54321 API, 54322 Postgres |

The ranges do not overlap on purpose: Playwright's `reuseExistingServer` would otherwise silently
hand a suite your running dev API, and a passing run would mean nothing.
