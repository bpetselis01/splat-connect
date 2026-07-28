/**
 * API Server Entry Point
 *
 * This is the main HTTP server that handles all data operations for SPLAT Connect.
 * It uses Hono (lightweight HTTP framework) to define routes and middleware.
 *
 * Architecture:
 * - Public routes: GET /api/public/tutorials* (no auth required)
 * - Protected routes: All others require JWT validation via authMiddleware
 * - Different groups of API endpoints are attached to specific URLs, and they all use the same login verification system
 *
 * Data Flow:
 * 1. Client sends request with JWT in Authorization header
 * 2. authMiddleware validates JWT and extracts userId, role
 * 3. Route handler creates Supabase client (RLS-respecting) from JWT
 * 4. Supabase RLS policies enforce row-level access control
 * 5. Response returned to client
 *
 * All data operations go through Supabase which enforces RLS policies defined in:
 * supabase/migrations/001_initial.sql
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth.js'
import publicRoutes from './routes/public.js'
import tutorials from './routes/tutorials.js'
import upload from './routes/upload.js'
import parts from './routes/parts.js'
import tools from './routes/tools.js'
import stlFiles from './routes/stl-files.js'
import admin from './routes/admin.js'
import contributors from './routes/contributors.js'
import childProfile from './routes/child-profile.js'
import agreements from './routes/agreements.js'

const app = new Hono()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? `http://localhost:${process.env.PORT ?? '3100'}` }))

app.get('/health', (c) => c.json({ status: 'ok' }))

// Public routes — no auth required
app.route('/api/public', publicRoutes)

// Protected routes — auth middleware per route group
app.use('/api/tutorials/*', authMiddleware)
app.use('/api/tutorials', authMiddleware)
app.use('/api/upload/*', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.use('/api/contributors/*', authMiddleware)
app.use('/api/child-profile', authMiddleware)
app.use('/api/child-profile/*', authMiddleware)
app.use('/api/agreements', authMiddleware)
app.use('/api/agreements/*', authMiddleware)

app.route('/api/tutorials', tutorials)
app.route('/api/upload', upload)
app.route('/api/tutorials', parts)
app.route('/api/tutorials', tools)
app.route('/api/tutorials', stlFiles)
app.route('/api/admin', admin)
app.route('/api/contributors', contributors)
app.route('/api/child-profile', childProfile)
app.route('/api/agreements', agreements)

export default app
