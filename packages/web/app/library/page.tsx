/**
 * Library Page
 * 
 * Browsable library of all approved tutorials.
 * No authentication required (anyone can view).
 * 
 * Process:
 * 1. Server-side: Fetches all approved tutorials from /api/public/tutorials
 * 2. Passes tutorials to client component (LibraryClient)
 * 3. Client handles filtering, searching, and UI interactions
 * 
 * Features:
 * - Filter by difficulty level
 * - Search by title/description
 * - Click tutorial card to view details
 * 
 * Data flow:
 * 1. User navigates to /library
 * 2. Server fetches tutorials from API (/api/public/tutorials)
 * 3. Page renders with tutorial cards
 * 4. User filters/searches (client-side)
 * 5. User clicks tutorial → /tutorials/:id
 * 
 * Related files:
 * - components/tutorial-card.tsx: Tutorial preview card
 * - routes/public.ts: API endpoint (GET /api/public/tutorials)
 * - app/tutorials/[id]/page.tsx: Tutorial detail page
 */
import { LibraryClient } from './library-client'
import type { Tutorial } from '@splat-connect/types'

export default async function LibraryPage() {
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
  const tutorials: Tutorial[] = res.ok ? await res.json() : []

  return <LibraryClient tutorials={tutorials} />
}
