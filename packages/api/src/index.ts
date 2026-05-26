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

// Protected routes — auth middleware per route group
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
