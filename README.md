# SPLAT Connect

**Supporting Play by Adapting Toys** — A web platform that helps children with disabilities access play by making toy adaptation knowledge discoverable and shareable.

> SPLAT Connect is a free, open platform for parents and contributors to explore, share, and discover toy adaptation tutorials for inclusive play.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Technology Stack](#technology-stack)
5. [File Guide](#file-guide)
6. [Setup & Development](#setup--development)
7. [Scripts & Commands](#scripts--commands)
8. [Testing](#testing)
9. [Database Schema](#database-schema)
10. [Deployment](#deployment)

---

## 🎯 Overview

SPLAT Connect is a three-tiered platform serving:

- **Parents & Guardians**: Browse a searchable library of toy adaptation tutorials
- **Contributors**: Create, upload, and submit toy adaptation tutorials for review
- **Administrators**: Review submissions, approve tutorials, manage the platform

### Key Features

- 📚 **Central Library**: Searchable database of toy adaptation tutorials
- 👥 **Contributor Submissions**: Community-driven content creation with approval workflow
- 🔐 **Row-Level Security**: Ensures users only see data they're authorized to access
- ⚡ **Serverless-Ready**: Designed to run on free tiers (Vercel + Supabase)
- 📱 **Responsive Design**: Mobile-first UI built with Next.js and Tailwind CSS
- 🗄️ **TypeScript**: Full type safety across frontend, backend, and shared types

---

## 🏗️ Architecture

### System Architecture

```mermaid
graph TB
    subgraph Clients
        Web["🌐 packages/web<br/>Next.js 16 + React 19<br/>(contributor/admin/public pages)"]
        Mobile["📱 packages/mobile<br/>Expo/React Native<br/>(parent app: home, profile,<br/>toy-library, scanner, print)"]
    end

    subgraph Shared
        Types["📦 @splat-connect/types<br/>Tutorial, Profile, Part,<br/>Difficulty, BuyLink, ChildProfile"]
    end

    subgraph Server
        API["⚙️ packages/api<br/>Hono API (Node)<br/>routes: public, tutorials, upload,<br/>admin, contributors, parts, tools,<br/>stl-files, child-profile<br/>middleware/auth.ts (JWT validation)"]
    end

    subgraph Supabase
        Auth["Auth<br/>(session JWTs)"]
        DB[("PostgreSQL<br/>+ Row-Level Security")]
        Storage["Storage<br/>tutorial-pdfs / toy-photos / stl-files"]
    end

    Web -->|browser fetch, JWT| API
    Mobile -->|api-client.ts, JWT| API
    Web -->|"@supabase/ssr session"| Auth
    Mobile -->|supabase.ts session| Auth
    API -->|validate JWT| Auth
    API -->|query w/ RLS| DB
    API -->|upload/read files| Storage

    Web -.->|imports| Types
    Mobile -.->|imports| Types
    API -.->|imports| Types

    style Web fill:#e1f5ff
    style Mobile fill:#e1f5ff
    style API fill:#f3e5f5
    style DB fill:#e8f5e9
    style Storage fill:#fff3e0
    style Auth fill:#e8f5e9
    style Types fill:#fce4ec
```

### Data Flow: Tutorial Upload

```mermaid
graph LR
    A["Contributor<br/>Fills Upload Form"] -->|POST /api/tutorials<br/>+ JWT| B["API Auth Middleware<br/>Validates JWT"]
    B -->|JWT valid<br/>Extract userId| C["Tutorial Route Handler"]
    C -->|INSERT with userId| D["Supabase RLS<br/>Validates ownership"]
    D -->|Save tutorial| E["PostgreSQL<br/>tutorials table"]
    E -->|Create with tutorial_id| F["Parts/Tools<br/>Rows"]
    C -->|POST /upload<br/>File + JWT| G["File Upload Handler"]
    G -->|Store in bucket| H["Supabase Storage"]
    C -->|Return JSON| I["Next.js Web<br/>Update UI"]
    
    style A fill:#bbdefb
    style B fill:#f8bbd0
    style C fill:#f8bbd0
    style D fill:#c8e6c9
    style E fill:#c8e6c9
    style G fill:#ffe0b2
    style H fill:#ffe0b2
```

### User Flow Sequences

#### Browse public library and view a tutorial

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant WebApp as "Next.js Web App"
    participant API as "Hono API"
    participant DB as "Supabase PostgreSQL"
    participant Storage as "Supabase Storage"

    User->>Browser: Navigate to / or /library
    Browser->>WebApp: Request server-rendered page
    WebApp->>API: GET /api/public/tutorials
    API->>DB: SELECT * FROM tutorials WHERE status='approved'
    DB-->>API: Approved tutorial list
    API-->>WebApp: JSON response
    WebApp-->>Browser: Render page with tutorial cards
    Browser->>WebApp: Navigate to /tutorials/:id
    WebApp->>API: GET /api/public/tutorials/:id
    API->>DB: SELECT tutorial, parts, tools, stl_files WHERE id=:id AND status='approved'
    DB-->>API: Tutorial detail
    API-->>WebApp: JSON response
    WebApp-->>Browser: Render tutorial detail page
```

#### Contributor signup, login, and approval

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant SupabaseAuth as "Supabase Auth"
    participant WebApp as "Next.js Web App"
    participant API as "Hono API"
    participant DB as "Supabase PostgreSQL"

    User->>Browser: Submit /signup form
    Browser->>SupabaseAuth: signUp(email,password,name)
    SupabaseAuth-->>Browser: Create user session (pending approval)
    User->>Browser: Later signs in at /login
    Browser->>SupabaseAuth: signInWithPassword(email,password)
    SupabaseAuth-->>Browser: Return JWT session
    Browser->>WebApp: Request /dashboard
    WebApp->>API: GET /api/contributors/me
    API->>DB: SELECT profile WHERE id=current_user
    DB-->>API: Profile with approved flag
    API-->>WebApp: Profile response
    WebApp->>API: GET /api/tutorials/mine
    API->>DB: SELECT tutorials WHERE tutorial_contributors.profile_id=current_user
    DB-->>API: User tutorials
    API-->>WebApp: Tutorials response
    WebApp-->>Browser: Render dashboard
```

#### Contributor upload and draft save flow

```mermaid
sequenceDiagram
    participant Contributor
    participant Browser
    participant WebApp as "Next.js Web App"
    participant API as "Hono API"
    participant Auth as "authMiddleware"
    participant DB as "Supabase PostgreSQL"
    participant Storage as "Supabase Storage"

    Contributor->>Browser: Fill upload form step 1
    Browser->>API: POST /api/tutorials {title,difficulty,description}
    API->>Auth: Validate JWT, fetch profile
    Auth->>DB: Verify user session and approval
    Auth-->>API: userId, role, approved, token
    API->>DB: INSERT tutorial draft row
    DB-->>API: Draft tutorial created
    API-->>Browser: Draft saved
    Browser->>API: POST /api/contributors/me/tutorials/:tutorialId
    API->>DB: INSERT tutorial_contributors link
    DB-->>API: Link created
    API-->>Browser: Success
    Browser->>API: POST /api/upload/pdf (FormData)
    API->>Auth: Validate JWT
    API->>Storage: upload tutorial PDF
    Storage-->>API: Public URL
    API-->>Browser: PDF URL
    Browser->>API: PATCH /api/tutorials/:tutorialId {tutorial_pdf_url,toy_photo_url}
    API->>Auth: Validate JWT
    API->>DB: UPDATE tutorial row
    DB-->>API: Updated row
    API-->>Browser: Success
    Browser->>API: POST /api/tutorials/:tutorialId/parts {parts}
    API->>Auth: Validate JWT
    API->>DB: INSERT/replace parts
    DB-->>API: Parts persisted
    API-->>Browser: Success
    Browser->>API: PATCH /api/tutorials/:tutorialId {status:'pending'}
    API->>DB: UPDATE tutorial status
    DB-->>API: Status changed to pending
    API-->>Browser: Submission complete
```

#### Admin review and publish flow

```mermaid
sequenceDiagram
    participant Admin
    participant Browser
    participant WebApp as "Next.js Web App"
    participant API as "Hono API"
    participant DB as "Supabase PostgreSQL"

    Admin->>Browser: Open /admin
    Browser->>WebApp: Request admin dashboard
    WebApp->>API: GET /api/admin/tutorials?status=pending
    API->>DB: SELECT pending tutorials
    DB-->>API: Pending list
    API-->>WebApp: Tutorial queue
    Browser->>WebApp: Open /admin/review/:id
    WebApp->>API: GET /api/tutorials/:id
    API->>DB: SELECT tutorial details
    DB-->>API: Tutorial details
    API-->>WebApp: Render review page
    Browser->>API: PATCH /api/admin/tutorials/:id/status {status:'approved'}
    API->>DB: UPDATE tutorial status reviewed_at
    DB-->>API: Updated tutorial
    API-->>Browser: Approved
    Browser->>WebApp: User visits /library
    WebApp->>API: GET /api/public/tutorials
    API->>DB: SELECT status='approved'
    DB-->>API: Includes newly approved tutorial
```
```

### System Architecture (Detailed)

```mermaid
graph LR
    subgraph Users[Users]
      Parents["Parents / Guardians"]
      Contributors["Contributors"]
      Admins["Admins"]
    end

    subgraph WebApp[Next.js Web App]
      SSR["Server-side pages
      (app/page.tsx, /library, /dashboard, /admin)"]
      Client["Client components
      (upload, edit files, add STL)"]
      Middleware["middleware.ts
      (session validation)"]
      Types["@splat-connect/types
      (shared interfaces)"]
    end

    subgraph API[Hono API Server]
      PublicRoutes["routes/public.ts
      (GET /api/public/tutorials*)"]
      TutorialRoutes["routes/tutorials.ts
      (CRUD /api/tutorials*)"]
      UploadRoutes["routes/upload.ts
      (POST /api/upload/*)"]
      AdminRoutes["routes/admin.ts
      (admin review + approvals)"]
      ContributorRoutes["routes/contributors.ts
      (profile + links)"]
      AuthMiddleware["middleware/auth.ts
      (JWT validation + profile lookup)"]
      Index["index.ts
      (route mounting + CORS + server start)"]
    end

    subgraph Supabase[Supabase Backend]
      AuthService["Auth service
      (session JWTs)"]
      Postgres["PostgreSQL + row-level security"]
      Storage["Storage buckets
      (tutorial-pdfs, toy-photos, stl-files)"]
    end

    Parents -->|browse/library| Browser
    Contributors -->|browse, upload, edit| Browser
    Admins -->|review, approve| Browser
    Browser -->|page request| SSR
    Browser -->|client request| Client
    SSR -->|server fetch| API
    Client -->|browser fetch| API
    API -->|uses shared types| Types
    SSR -.->|imports shared types| Types
    API -->|authorize request| AuthService
    API -->|query data| Postgres
    API -->|upload/read files| Storage
    AuthService -->|auth metadata| Postgres
```

### API Server `index.ts` Data Flow

```mermaid
flowchart TB
    subgraph Index[packages/api/src/index.ts]
      Env["Load .env.local
      + api/.env.local"]
      App["Create Hono app"]
      CORS["Enable CORS for web origin"]
      Health["GET /health"]
      Public["Mount /api/public"]
      Auth["Apply authMiddleware to protected routes"]
      Tutorials["Mount /api/tutorials
      (tutorials, parts, tools, stl-files)"]
      Upload["Mount /api/upload"]
      Admin["Mount /api/admin"]
      Contributors["Mount /api/contributors"]
      Serve["Start server on API_PORT"]
    end

    Index --> Env
    Index --> App
    App --> CORS
    App --> Health
    App --> Public
    App --> Auth
    App --> Tutorials
    App --> Upload
    App --> Admin
    App --> Contributors
    App --> Serve
    Auth --> Tutorials
    Auth --> Upload
    Auth --> Admin
    Auth --> Contributors
```

### Detailed File Map

The diagrams above show the container-level view. These go one level deeper: **one box per source file**, listing every function or route handler it defines, wired up by the actual `import` relationships in the code (grepped from source, not inferred).

#### API (`packages/api/src`)

```mermaid
flowchart TB
  subgraph ENTRY["packages/api/src"]
    idx["<b>index.ts</b><br/>GET /health"]
  end

  subgraph MW["middleware/"]
    auth["<b>auth.ts</b><br/>authMiddleware(c, next)"]
  end

  subgraph ROUTES["routes/"]
    rpublic["<b>public.ts</b><br/>GET /tutorials<br/>GET /tutorials/:id"]
    rtutorials["<b>tutorials.ts</b><br/>GET /<br/>GET /mine<br/>GET /:id<br/>POST /<br/>PATCH /:id<br/>DELETE /:id"]
    rupload["<b>upload.ts</b><br/>POST /pdf<br/>POST /photo<br/>POST /stl"]
    rparts["<b>parts.ts</b><br/>POST /:id/parts<br/>DELETE /:id/parts"]
    rtools["<b>tools.ts</b><br/>POST /:id/tools<br/>DELETE /:id/tools"]
    rstl["<b>stl-files.ts</b><br/>POST /:id/stl-files<br/>DELETE /:id/stl-files"]
    radmin["<b>admin.ts</b><br/>GET /tutorials<br/>PATCH /tutorials/:id/status<br/>GET /contributors<br/>PATCH /contributors/:id/approve<br/>DELETE /contributors/:id"]
    rcontrib["<b>contributors.ts</b><br/>GET /me<br/>POST /me/tutorials/:tutorialId"]
  end

  subgraph SB["supabase/"]
    sadmin["<b>client.ts</b><br/>createAdminClient()"]
    suser["<b>user-client.ts</b><br/>createUserClient(token)"]
  end

  idx -->|mounts /api/public| rpublic
  idx -->|mounts /api/tutorials| rtutorials
  idx -->|mounts /api/upload| rupload
  idx -->|mounts /api/tutorials| rparts
  idx -->|mounts /api/tutorials| rtools
  idx -->|mounts /api/tutorials| rstl
  idx -->|mounts /api/admin| radmin
  idx -->|mounts /api/contributors| rcontrib
  idx -.->|"protects tutorials, upload, admin, contributors"| auth

  rpublic --> sadmin
  rtutorials --> suser
  rtutorials --> sadmin
  rupload --> suser
  rupload --> sadmin
  rparts --> suser
  rtools --> suser
  rstl --> suser
  radmin --> sadmin
  rcontrib --> suser
  rcontrib --> sadmin
```

#### Web (`packages/web`)

```mermaid
flowchart TB
  PUB["packages/api/src/routes/public.ts<br/>(cross-package)"]

  subgraph APP["app/ (Next.js pages)"]
    layout["<b>layout.tsx</b><br/>RootLayout()"]
    home["<b>page.tsx</b><br/>HomePage()"]
    login["<b>login/page.tsx</b><br/>LoginPage()<br/>handleSubmit()"]
    signup["<b>signup/page.tsx</b><br/>SignupPage()<br/>handleSubmit()"]
    pending["<b>pending/page.tsx</b><br/>PendingPage()"]
    library["<b>library/page.tsx</b><br/>LibraryPage()"]
    libclient["<b>library/library-client.tsx</b><br/>LibraryClient()"]
    dashboard["<b>dashboard/page.tsx</b><br/>DashboardPage()"]
    mytutorials["<b>my-tutorials/page.tsx</b><br/>MyTutorialsPage()"]
    upload["<b>upload/page.tsx</b><br/>UploadPage()<br/>uploadFile()<br/>handlePdfUpload()<br/>handlePhotoUpload()<br/>handleStlUpload()<br/>handleNext()<br/>handleSubmit()"]
    tutorial["<b>tutorials/[id]/page.tsx</b><br/>TutorialPage()"]
    edittutorial["<b>tutorials/[id]/edit/page.tsx</b><br/>EditTutorialPage()<br/>saveDetails()<br/>patchFileUrls()<br/>saveParts()<br/>saveTools()<br/>addStlFileRecord()<br/>submitForReview()"]
    admin["<b>admin/page.tsx</b><br/>AdminPage()"]
    review["<b>admin/review/page.tsx</b><br/>ReviewListPage()"]
    reviewid["<b>admin/review/[id]/page.tsx</b><br/>approveTutorial()<br/>rejectTutorial()<br/>ReviewTutorialPage()"]
    contributors["<b>admin/contributors/page.tsx</b><br/>approveContributor()<br/>rejectContributor()<br/>ContributorsPage()"]
  end

  subgraph COMP["components/"]
    navc["<b>nav.tsx</b><br/>Nav()<br/>signOut()"]
    tutcard["<b>tutorial-card.tsx</b><br/>TutorialCard()"]
    diffbadge["<b>difficulty-badge.tsx</b><br/>DifficultyBadge()"]
    filedrop["<b>file-drop-zone.tsx</b><br/>FileDropZone()<br/>handleChange()<br/>handleDragOver()<br/>handleDragLeave()<br/>handleDrop()"]
    buylinks["<b>buy-links-input.tsx</b><br/>BuyLinksInput()<br/>update()<br/>add()<br/>remove()<br/>updateField()"]
    editfiles["<b>edit-files-section.tsx</b><br/>EditFilesSection()<br/>handlePhotoChange()<br/>handlePdfChange()<br/>uploadFile()<br/>handleSave()"]
    editparts["<b>edit-parts-section.tsx</b><br/>EditPartsSection()<br/>openEdit()<br/>closeEdit()<br/>handleSave()<br/>handleDelete()<br/>handleAdd()<br/>toInput()"]
    edittools["<b>edit-tools-section.tsx</b><br/>EditToolsSection()<br/>openEdit()<br/>closeEdit()<br/>handleSave()<br/>handleDelete()<br/>handleAdd()<br/>toInput()"]
    addstl["<b>add-stl-form.tsx</b><br/>AddStlForm()<br/>handleChange()<br/>handleUpload()"]
    submitbtn["<b>submit-for-review-button.tsx</b><br/>SubmitForReviewButton()<br/>handleClick()"]
  end

  subgraph LIB["lib/"]
    apiclient["<b>api-client.ts</b><br/>getToken()<br/>request()<br/>requestFormData()<br/>apiClient.get/post/patch/delete/postFormData()"]
    browserclient["<b>browser-api-client.ts</b><br/>getToken()<br/>request()<br/>requestFormData()<br/>browserApiClient.get/post/patch/delete/postFormData()"]
    libauth["<b>auth.ts</b><br/>getUserRole()"]
    libsupabase["<b>supabase/client.ts</b><br/>createClient()"]
    validation["<b>validation.ts</b><br/>canAdvanceFromStep()<br/>canSubmit()<br/>getMissingFields()"]
  end

  mw["<b>middleware.ts</b><br/>middleware()"]

  layout --> navc
  layout --> libauth
  navc --> libsupabase
  login --> libsupabase
  signup --> libsupabase

  home -.->|"fetch API_URL/api/public/tutorials"| PUB
  home --> tutcard
  library -.->|"fetch API_URL/api/public/tutorials"| PUB
  library --> libclient
  libclient --> tutcard
  tutorial -.->|"fetch API_URL/api/public/tutorials/:id"| PUB
  tutorial --> diffbadge

  dashboard --> apiclient
  dashboard --> diffbadge
  mytutorials --> apiclient
  mytutorials --> diffbadge
  admin --> apiclient
  review --> apiclient
  review --> diffbadge
  reviewid --> apiclient
  reviewid --> diffbadge
  contributors --> apiclient

  edittutorial --> apiclient
  edittutorial --> editfiles
  edittutorial --> addstl
  edittutorial --> editparts
  edittutorial --> edittools
  edittutorial --> submitbtn

  upload --> browserclient
  upload --> filedrop
  upload --> buylinks
  upload --> validation

  editfiles --> browserclient
  addstl --> browserclient
  submitbtn --> validation
```

`middleware.ts` is not wired into the diagram above — it runs at the Next.js request layer (session validation before a page renders) rather than being imported by another source file, so it has no incoming edges. It uses `@supabase/ssr`'s `createServerClient` directly.

#### Shared types (`packages/types/src`)

`index.ts` defines no functions — only type aliases and interfaces, imported by nearly every file in both packages above:

```mermaid
flowchart TB
  types["<b>packages/types/src/index.ts</b><br/>─── type aliases ───<br/>Role<br/>Difficulty<br/>TutorialStatus<br/>ContributorRole<br/>─── interfaces ───<br/>Profile<br/>Tutorial<br/>TutorialContributor<br/>BuyLink<br/>Part<br/>Tool<br/>StlFile<br/>TutorialWithDetails<br/>UploadDraft"]
```

---

## 📁 Project Structure

```
splat-connect/                          ← Workspace root
│
├── pnpm-workspace.yaml                 ← Declares all workspaces
├── pnpm-lock.yaml                      ← Lock file for dependency versions
├── package.json                        ← Root workspace scripts
├── next-env.d.ts                       ← Next.js type definitions
├── README.md                           ← This file
│
├── packages/                           ← Monorepo packages (managed by pnpm)
│   │
│   ├── types/                          ← Shared TypeScript interfaces
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                ← Main export file
│   │       ├── models.ts               ← Domain interfaces (Profile, Tutorial, etc.)
│   │       └── enums.ts                ← Enums (Role, Status, Difficulty)
│   │
│   ├── api/                            ← Hono HTTP server (all DB operations)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts            ← Test configuration
│   │   ├── .env.example                ← Environment variable template
│   │   ├── src/
│   │   │   ├── index.ts                ← Entry point, server setup, route mounting
│   │   │   ├── config.ts               ← Configuration (PORT, CORS_ORIGIN, etc.)
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts             ← JWT validation, context attachment
│   │   │   ├── routes/
│   │   │   │   ├── public.ts           ← GET /public/tutorials (unauthenticated)
│   │   │   │   ├── tutorials.ts        ← CRUD /tutorials endpoints
│   │   │   │   ├── upload.ts           ← POST /upload (file uploads)
│   │   │   │   ├── parts.ts            ← POST/DELETE parts endpoints
│   │   │   │   ├── tools.ts            ← POST/DELETE tools endpoints
│   │   │   │   ├── stl-files.ts        ← POST/DELETE 3D model files
│   │   │   │   ├── admin.ts            ← GET/PATCH admin review endpoints
│   │   │   │   └── contributors.ts     ← GET/PATCH contributor profile
│   │   │   └── supabase/
│   │   │       ├── client.ts           ← Admin Supabase client (service role)
│   │   │       └── user-client.ts      ← RLS-respecting client from JWT
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── routes.test.ts      ← Route handler tests (mocked)
│   │   │   │   └── middleware.test.ts  ← Auth middleware tests
│   │   │   └── integration/
│   │   │       └── tutorials.test.ts   ← Tests against real local Supabase
│   │   └── dist/                       ← Compiled output (after build)
│   │
│   └── web/                            ← Next.js web application (UI layer)
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts              ← Next.js config (image optimization)
│       ├── eslint.config.mjs           ← ESLint rules
│       ├── vitest.config.ts            ← Unit test configuration
│       ├── playwright.config.ts        ← E2E test configuration
│       ├── postcss.config.mjs          ← Tailwind CSS processor
│       ├── middleware.ts               ← Auth session validation (per-route)
│       ├── next-env.d.ts               ← Next.js type definitions
│       ├── app/
│       │   ├── layout.tsx              ← Root layout, nav bar
│       │   ├── page.tsx                ← Home/landing page
│       │   ├── login/                  ← Login page
│       │   ├── signup/                 ← Signup page
│       │   ├── pending/                ← "Awaiting approval" page
│       │   ├── library/                ← Browse approved tutorials
│       │   ├── tutorials/
│       │   │   └── [id]/               ← Tutorial detail page
│       │   ├── dashboard/              ← Contributor dashboard
│       │   ├── my-tutorials/           ← My tutorials list
│       │   ├── upload/                 ← 6-step upload form
│       │   └── admin/                  ← Admin dashboard (if admin user)
│       ├── components/
│       │   ├── nav.tsx                 ← Navigation bar
│       │   ├── tutorial-card.tsx       ← Tutorial preview card
│       │   ├── difficulty-badge.tsx    ← Difficulty level badge
│       │   ├── file-drop-zone.tsx      ← Drag-and-drop file input
│       │   └── buy-links-input.tsx     ← Material links form
│       ├── lib/
│       │   ├── api-client.ts           ← HTTP client for API calls
│       │   ├── supabase.ts             ← Supabase client setup (@supabase/ssr)
│       │   └── utils.ts                ← Helper functions
│       ├── public/                     ← Static assets
│       ├── tests/
│       │   ├── unit/
│       │   │   └── components.test.tsx ← Component unit tests
│       │   └── e2e/
│       │       └── workflow.spec.ts    ← E2E tests (full user flows)
│       └── coverage/                   ← Test coverage reports
│
├── supabase/                           ← Database configuration (shared by all packages)
│   ├── migrations/
│   │   ├── 001_initial.sql             ← Core schema (tables, indexes, RLS)
│   │   ├── 002_parts_tools_schema.sql  ← Parts and tools tables
│   │   ├── 003_fix_rls_recursion.sql   ← Fix RLS policy issues
│   │   └── 004_fix_tutorial_submit_policy.sql ← Additional RLS fixes
│   └── seed.sql                        ← Deterministic seed data for dev/testing
│
└── docs/
    └── superpowers/
        ├── plans/
        │   ├── 2026-05-26-monorepo-refactor.md      ← Architecture decisions
        │   └── 2026-05-26-comprehensive-testing.md  ← Testing strategy
        └── specs/
            ├── 2026-05-25-splat-connect-library-design.md
            ├── 2026-05-25-contributor-dashboard-design.md
            └── 2026-05-26-monorepo-architecture-testing-design.md
```

---

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Monorepo** | pnpm workspaces | Dependency management & package linking |
| **API Server** | Hono v4 + @hono/node-server | Lightweight HTTP server, all DB operations |
| **Frontend** | Next.js 16+ | React-based UI, server-side rendering |
| **Database** | PostgreSQL (Supabase) | Relational data with RLS enforcement |
| **File Storage** | Supabase Storage | PDFs, photos, STL models |
| **Authentication** | Supabase Auth + @supabase/ssr | JWT-based auth, secure cookies |
| **Language** | TypeScript 5 | End-to-end type safety |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **Testing** | Vitest + Playwright + RTL | Unit, integration, and E2E tests |
| **Linting** | ESLint | Code quality |
| **Image Optimization** | Next.js Image | Auto-optimization from Supabase URLs |
| **Runtime** | Node.js 20+ | Server runtime |
| **Deployment** | Vercel + Supabase | Serverless frontend & backend |

---

## � Understanding the Codebase

**All source files now include detailed comments** explaining:
- What the file does
- How it interacts with other files  
- Key data flows and workflows

**To understand any file**, open it and read the file-level comment at the top. Key files to start with:

### Core Files to Understand

**Data Model:**
- [packages/types/src/index.ts](packages/types/src/index.ts) — Comprehensive overview of all types and how they interact

**API (Backend):**
- [packages/api/src/index.ts](packages/api/src/index.ts) — HTTP server setup and routing
- [packages/api/src/middleware/auth.ts](packages/api/src/middleware/auth.ts) — JWT validation and context setup
- [packages/api/src/supabase/user-client.ts](packages/api/src/supabase/user-client.ts) — RLS-respecting database access
- [packages/api/src/routes/tutorials.ts](packages/api/src/routes/tutorials.ts) — Tutorial CRUD operations

**Web (Frontend):**
- [packages/web/app/layout.tsx](packages/web/app/layout.tsx) — Root layout and navigation setup
- [packages/web/middleware.ts](packages/web/middleware.ts) — Route protection and auth validation
- [packages/web/lib/api-client.ts](packages/web/lib/api-client.ts) — Server-side API communication

**Key Workflows:**
- [packages/web/app/upload/page.tsx](packages/web/app/upload/page.tsx) — Multi-step tutorial creation
- [packages/web/app/admin/page.tsx](packages/web/app/admin/page.tsx) — Admin dashboard
- [packages/web/app/login/page.tsx](packages/web/app/login/page.tsx) — Authentication flow

### File Listing

All source files include detailed comments. Here's the full structure:

**packages/api/**
- `src/index.ts` — Server entry point
- `src/middleware/auth.ts` — JWT validation
- `src/routes/public.ts` — Public tutorial browsing
- `src/routes/tutorials.ts` — Tutorial CRUD
- `src/routes/upload.ts` — File uploads
- `src/routes/parts.ts`, `tools.ts`, `stl-files.ts` — Sub-resources
- `src/routes/admin.ts` — Admin operations
- `src/routes/contributors.ts` — User profiles
- `src/supabase/client.ts` — Admin client (bypasses RLS)
- `src/supabase/user-client.ts` — User client (enforces RLS)

**packages/web/**
- `app/layout.tsx` — Root layout
- `app/page.tsx` — Home/landing
- `app/login/page.tsx` — Login
- `app/library/page.tsx` — Public tutorial browse
- `app/dashboard/page.tsx` — Contributor hub
- `app/upload/page.tsx` — Create tutorial (6-step wizard)
- `app/admin/page.tsx` — Admin dashboard
- `middleware.ts` — Route protection
- `lib/api-client.ts` — Server-side API calls
- `lib/browser-api-client.ts` — Client-side API calls
- `lib/validation.ts` — Form validation
- `components/*.tsx` — UI components

**packages/types/**
- `src/index.ts` — All type definitions and data model documentation

---

## 🚀 Setup & Development

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 9.x or higher ([install pnpm](https://pnpm.io/installation))
- **Supabase CLI** (for local development) — optional but recommended
- **Docker** (for local Supabase) — optional

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/splat-connect.git
cd splat-connect

# Install dependencies for all packages
pnpm install
```

### 2. Configure Environment Variables

```bash
# Copy the shared ports config (repo root — single source of truth for both packages)
cp .env.local.example .env.local

# Copy API environment template
cp packages/api/.env.example packages/api/.env.local

# Edit .env.local with your Supabase credentials
nano packages/api/.env.local
```

**Shared ports** (in root `.env.local`, defaults shown):
```env
PORT=3100      # web dev server
API_PORT=3101  # api dev server
```
Change these here if 3100/3101 are already taken — every other reference (CORS origin, `API_URL`, `NEXT_PUBLIC_API_URL`) derives from these two values, so nothing else needs editing.

The E2E suites deliberately do **not** use these ports — they run their own servers on 3102/3103 (mobile) and 3104/3105 (web), set in each package's `playwright.config.ts`. Keeping them apart means a test run can't be silently handed your dev API, which points at the cloud project rather than local Supabase.

**Required Variables** (in `packages/api/.env.local`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from [Supabase Dashboard](https://app.supabase.com) → Settings → API.

### 3. Start Development Servers

**Option A: Run both in separate terminals**

```bash
# Terminal 1: Start API server (port 3101)
cd packages/api
pnpm dev

# Terminal 2: Start Next.js (port 3100)
cd packages/web
pnpm dev
```

**Option B: Use workspace scripts** (if using aliases)

```bash
# From root directory
pnpm dev:api  # Terminal 1
pnpm dev:web  # Terminal 2
```

Open http://localhost:3100 in your browser.

### 4. (Optional) Set Up Local Supabase

For integration testing with real Supabase instance:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (requires Docker)
supabase start

# This creates a local PostgreSQL instance on port 54322
# Get credentials from the output and update .env.local
```

---

## 📋 Scripts & Commands

### Workspace-Level Scripts (run from root)

```bash
pnpm install              # Install dependencies for all packages
pnpm dev:api              # Start API server on port 3101
pnpm dev:web              # Start Next.js on port 3100
pnpm build                # Build all packages for production
pnpm typecheck            # Run TypeScript type checking
pnpm -r test              # Run all tests in all packages
```

### API Package Scripts

```bash
cd packages/api

pnpm dev                  # Start API with file watching
pnpm build                # Compile TypeScript to dist/
pnpm start                # Run compiled server (production)
pnpm typecheck            # Type check without emit
pnpm test:unit            # Unit tests (mocked Supabase)
pnpm test:integration     # Integration tests (local Supabase)
pnpm test                 # All tests with coverage
pnpm test:cleanup         # Clean up test data from Supabase
```

### Web Package Scripts

```bash
cd packages/web

pnpm dev                  # Start Next.js dev server
pnpm build                # Build for production
pnpm start                # Serve production build
pnpm typecheck            # Type check without emit
pnpm lint                 # Run ESLint
pnpm test:unit            # Unit tests (Vitest + RTL)
pnpm test:e2e             # E2E tests (Playwright, opens browser)
pnpm test:e2e:ui          # E2E tests with interactive browser
```

### Types Package Scripts

```bash
cd packages/types

pnpm typecheck            # Type check exports
```

---

## 🧪 Testing

### Unit Tests

Test individual functions and components without network calls.

```bash
# API unit tests (mocked Supabase)
cd packages/api
pnpm test:unit

# Web unit tests (mocked API)
cd packages/web
pnpm test:unit

# All unit tests
pnpm -r test:unit
```

**Test files**:
- `packages/api/tests/unit/*.test.ts` — Route handlers, middleware
- `packages/web/tests/unit/*.test.tsx` — Components, utilities

### Integration Tests

Test API routes against a **real local Supabase** with actual RLS policies enforced.

```bash
# Start local Supabase first
supabase start

# Run integration tests
cd packages/api
pnpm test:integration

# Clean up test data afterward
pnpm test:cleanup
```

**Test files**:
- `packages/api/tests/integration/*.test.ts` — Full database operations

### E2E Tests

Test complete user workflows through the UI using Playwright.

```bash
# Make sure both API and web servers are running
pnpm dev:api  # Terminal 1
pnpm dev:web  # Terminal 2

# Run E2E tests (headless)
cd packages/web
pnpm test:e2e

# Or open interactive browser
pnpm test:e2e:ui
```

**Test files**:
- `packages/web/tests/e2e/*.spec.ts` — Full user workflows

### Coverage

Generate and view test coverage reports.

```bash
# Generate coverage
pnpm test                 # All tests with coverage
pnpm -r test              # By package

# View coverage report (HTML)
open packages/api/coverage/index.html
open packages/web/coverage/index.html
```

---

## 🗄️ Database Schema

### Tables Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles (extends `auth.users`) | `id`, `name`, `email`, `role` (admin\|contributor), `approved`, `created_at` |
| `tutorials` | Toy adaptation tutorials | `id`, `title`, `description`, `difficulty`, `status` (draft\|pending\|approved\|rejected), `tutorial_pdf_url`, `toy_photo_url`, `created_at` |
| `tutorial_contributors` | Many-to-many: contributors per tutorial | `tutorial_id`, `profile_id`, `role` (primary\|collaborator), `added_at` |
| `parts` | Materials needed for a tutorial | `id`, `tutorial_id`, `name`, `quantity`, `is_optional`, `buy_links` (JSONB) |
| `tools` | Tools needed for a tutorial | `id`, `tutorial_id`, `name`, `is_optional`, `buy_links` (JSONB) |
| `stl_files` | 3D model files for a tutorial | `id`, `tutorial_id`, `filename`, `file_url` |

### Row Level Security (RLS) Policies

All tables have RLS enabled. Policies enforce:

- **Public reads**: Anyone can `SELECT` approved tutorials and related data
- **Contributor access**: Contributors can only read/write their own tutorials (draft/rejected)
- **Admin access**: Admins can read/write all data
- **Cascade deletes**: Deleting a tutorial cascades to parts, tools, files, contributors

**Example policy** (on `tutorials` table):
```sql
-- Public can read approved tutorials
CREATE POLICY "public_read_approved" ON tutorials
  FOR SELECT TO public
  USING (status = 'approved');

-- Contributors can read their own (any status)
CREATE POLICY "contributors_read_own" ON tutorials
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.jwt() ->> 'role' = 'admin'
  );
```

### Migrations

Database schema is versioned in `supabase/migrations/`:

| File | Purpose |
|------|---------|
| [001_initial.sql](supabase/migrations/001_initial.sql) | Core schema (tables, indexes, RLS) |
| [002_parts_tools_schema.sql](supabase/migrations/002_parts_tools_schema.sql) | Parts and tools tables |
| [003_fix_rls_recursion.sql](supabase/migrations/003_fix_rls_recursion.sql) | Fix RLS policy conflicts |
| [004_fix_tutorial_submit_policy.sql](supabase/migrations/004_fix_tutorial_submit_policy.sql) | Additional RLS fixes |

Run migrations with:
```bash
supabase db push  # Push to remote Supabase
supabase db pull  # Pull from remote and generate migrations
```

---

## 🌐 Deployment

### Frontend Deployment (Vercel)

1. Connect your GitHub repository to [Vercel](https://vercel.com)
2. Vercel auto-detects Next.js monorepo structure
3. Set root directory to `packages/web`
4. Deployment is automatic on `main` branch push

### API Deployment (Vercel or Node)

**Option A: Deploy to Vercel Functions**

```bash
# Vercel auto-builds and deploys Hono server
# Deploy with: vercel deploy
```

**Option B: Deploy to Node.js Server**

```bash
# Build API
cd packages/api
pnpm build

# Deploy dist/ folder
# Run: node dist/index.js
```

### Environment Variables

Set these in your deployment platform:

| Variable | Value |
|----------|-------|
| `PORT` | `3101` (or platform-assigned) |
| `CORS_ORIGIN` | Your Vercel frontend URL |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### Database (Supabase)

Use Supabase's managed PostgreSQL:

1. Create project at [app.supabase.com](https://app.supabase.com)
2. Push migrations: `supabase db push`
3. Store credentials in API environment variables

---

## 📚 Architecture Decisions

See [docs/superpowers/plans/](docs/superpowers/plans/) for detailed design documents:

- [2026-05-26-monorepo-refactor.md](docs/superpowers/plans/2026-05-26-monorepo-refactor.md) — Monorepo structure, package separation
- [2026-05-26-comprehensive-testing.md](docs/superpowers/plans/2026-05-26-comprehensive-testing.md) — Testing strategy

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -am 'Add feature'`
3. Push branch: `git push origin feature/your-feature`
4. Open a pull request

### Code Style

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Tests before submitting
pnpm test
```

---

## 📝 License

[Your License Here]

---

## 🎯 Key Design Principles

1. **Type Safety First**: TypeScript end-to-end, shared `types` package as single source of truth
2. **API Gateway Pattern**: All data operations go through API, never direct Supabase from web
3. **RLS Enforcement**: Database enforces access control, not application layer
4. **Separation of Concerns**: Types → API → Web, each layer has single responsibility
5. **Monorepo for Simplicity**: Shared types, unified scripts, easier refactoring
6. **Serverless-Ready**: Designed for Vercel + Supabase free tiers

---

**Last Updated**: May 27, 2026
