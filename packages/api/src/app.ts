/**
 * Hono app: public routes mounted before authMiddleware, everything else
 * behind it. Handlers delegate row access to Supabase RLS.
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
import organizations from './routes/organizations.js'
import tutorialOrgs from './routes/tutorial-orgs.js'
import collaborators from './routes/collaborators.js'
import collaboratorInvites from './routes/collaborator-invites.js'
import notifications from './routes/notifications.js'

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
app.use('/api/organizations', authMiddleware)
app.use('/api/organizations/*', authMiddleware)
app.use('/api/collaborators', authMiddleware)
app.use('/api/collaborators/*', authMiddleware)
app.use('/api/notifications', authMiddleware)
app.use('/api/notifications/*', authMiddleware)

app.route('/api/tutorials', tutorials)
app.route('/api/upload', upload)
app.route('/api/tutorials', parts)
app.route('/api/tutorials', tools)
app.route('/api/tutorials', stlFiles)
app.route('/api/tutorials', tutorialOrgs)
app.route('/api/tutorials', collaborators)
app.route('/api/admin', admin)
app.route('/api/contributors', contributors)
app.route('/api/child-profile', childProfile)
app.route('/api/agreements', agreements)
app.route('/api/organizations', organizations)
app.route('/api/collaborators', collaboratorInvites)
app.route('/api/notifications', notifications)

export default app
