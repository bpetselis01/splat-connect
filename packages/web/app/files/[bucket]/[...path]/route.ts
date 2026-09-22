/**
 * The gate on a tutorial's files.
 *
 * tutorial-pdfs and stl-files have been private buckets since 049, so a file
 * is never linked directly. The page links here instead, and this handler
 * either mints a 60-second signed URL with the visitor's own session and
 * redirects to it, or — with no session — redirects to signup pointed back at
 * the tutorial. Sixty seconds is the click-through window: the redirect is
 * followed immediately, so a copied /files link never goes stale and is
 * useless to anyone without an account.
 *
 * Signing on click rather than at page render is the whole design: a signed
 * URL in the HTML would be shareable for its lifetime and would break in a
 * tab left open past it.
 *
 * Related files:
 * - components/tutorial-view.tsx: builds the /files hrefs, or the signup
 *   href when it already knows the visitor is signed out
 * - supabase/migrations/049_gate_tutorial_files.sql: the bucket flip and the
 *   select policy that lets a user JWT sign
 * - app/signup/page.tsx: reads ?reason=download
 */
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// The allowlist is why this is not a generic storage proxy. STLs are sent as
// an attachment under their own name; a PDF opens inline, as it always has.
const GATED = {
  'tutorial-pdfs': { download: false, folder: 'tutorial' },
  'stl-files': { download: true, folder: 'tutorial' },
  // 056. The folder is an exchange, not a tutorial, and its storage policies
  // are tighter than 049's: signing uses the visitor's own session, so a
  // non-party cannot mint a URL for somebody else's receipt at all.
  'exchange-receipts': { download: false, folder: 'exchange' },
  // 057. Same shape and the same tight policies: the folder is the build's
  // transaction, and only its two parties can sign a URL for the photo.
  'build-shots': { download: false, folder: 'exchange' },
  // 058. Same shape again: the folder is the print job, and only its two
  // parties can sign a URL for the photo of the finished parts.
  'print-shots': { download: false, folder: 'exchange' },
} as const

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
  const { bucket, path } = await params
  // Object.hasOwn, not a bare lookup: GATED[bucket] resolves inherited keys
  // like '__proto__' or 'constructor' to a truthy value and skips the 404.
  if (!Object.hasOwn(GATED, bucket) || path.length < 2) {
    return new NextResponse(null, { status: 404 })
  }
  const rule = GATED[bucket as keyof typeof GATED]

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // path[0] is the owning record's id: every object in these buckets lives
    // under its own folder (032 for tutorials, 056 for exchange receipts).
    const next = encodeURIComponent(
      rule.folder === 'tutorial' ? `/tutorials/${path[0]}` : `/dashboard/exchanges/${path[0]}`
    )
    // no-store: the Location header carries a bearer credential (below, a
    // signed URL) or points at a next-step redirect keyed to this visitor —
    // neither may be served from a shared cache.
    return NextResponse.redirect(new URL(`/signup?next=${next}&reason=download`, req.url), {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const objectPath = path.join('/')
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 60, rule.download ? { download: path[path.length - 1] } : undefined)
  if (error || !data) return new NextResponse(null, { status: 404 })

  // no-store: the Location header carries a bearer credential and must never
  // be served from a shared cache.
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'no-store' } })
}
