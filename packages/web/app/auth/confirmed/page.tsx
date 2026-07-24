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
    <div className="max-w-sm mx-auto mt-16 text-center">
      <div className="text-4xl mb-4">✅</div>
      <h1 className="text-2xl font-bold mb-2">Email confirmed</h1>
      <p className="text-gray-600 text-sm">
        Your email has been confirmed. You can close this page and sign in from the app.
      </p>
    </div>
  )
}
