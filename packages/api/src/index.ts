/**
 * API Server Entry Point. Env comes from the --env-file-if-exists flags in the
 * dev/start scripts; app construction lives in app.ts so tests can import it
 * directly WITHOUT loading .env.local (which points at the cloud project).
 */
import { serve } from '@hono/node-server'
import app from './app.js'

const port = parseInt(process.env.API_PORT ?? '3101')
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})

export default app
