'use client'
import { createClient } from '@/lib/supabase/client'

/**
 * Lives on the Account page. The board's header has no sign-out — the bar ends
 * on My SPLAT — so the way out moved to the page that already holds the rest of
 * the account's settings.
 */
export function SignOutButton() {
  async function signOut() {
    await createClient().auth.signOut()
    // WHY: router.push() + router.refresh() race, and the header can keep its
    //      signed-in state until a hard refresh.
    // HOW: a hard load renders the layout without the auth cookie.
    window.location.href = '/'
  }

  return (
    <button type="button" onClick={signOut} className="btn btn-quiet">
      Sign out
    </button>
  )
}
