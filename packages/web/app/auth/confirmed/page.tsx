/**
 * Email Confirmed Page
 *
 * Landing page for the link in Supabase's signup confirmation email
 * (see EXPO_PUBLIC_WEB_URL/auth/confirmed passed as emailRedirectTo in
 * packages/mobile/lib/auth-context.tsx). Supabase already verifies the
 * token before redirecting here, so this page is purely a confirmation
 * message telling the user to go back to the app and sign in.
 */
export default function EmailConfirmedPage() {
  return (
    <div className="mx-auto mt-8 max-w-sm sm:mt-16">
      <div className="card flex flex-col items-center p-6 text-center sm:p-8">
        <span aria-hidden="true" className="empty-badge">
          ✅
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Email confirmed</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your email has been confirmed. You can close this page and sign in from the app.
        </p>
      </div>
    </div>
  )
}
