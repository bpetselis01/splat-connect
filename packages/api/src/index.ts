/**
 * API Server Entry Point — loads env, then serves the app.
 * App construction lives in app.ts so tests can import it directly.
 */
import './env.js'
import { serve } from '@hono/node-server'
import app from './app.js'

const port = parseInt(process.env.API_PORT ?? '3101')
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})

export default app
