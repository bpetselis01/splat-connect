/**
 * Pending Approval Page
 * 
 * Shown to newly signed-up contributors who are awaiting admin approval.
 * This is a holding page that explains the approval process.
 * 
 * Workflow:
 * 1. User signs up with email/password (/signup)
 * 2. Account created with approved=false
 * 3. User redirected to /pending (this page)
 * 4. User sees message: "Application under review"
 * 5. Admin reviews signup and approves account
 * 6. Next time user logs in, approved=true
 * 7. User redirected to /dashboard instead of /pending
 * 
 * Middleware (middleware.ts) ensures:
 * - If user tries to access /dashboard while approved=false → redirect to /pending
 * - If user tries to access /pending while approved=true → redirect to /dashboard
 * 
 * Related files:
 * - app/signup: Account creation page
 * - app/login: After approval, user logs in and goes to /dashboard
 * - middleware.ts: Route protection logic
 * - admin review: Admins approve accounts via /admin page
 */
export default function PendingPage() {
  return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <h1 className="text-2xl font-bold mb-3">Application pending</h1>
      <p className="text-gray-500">
        Your contributor request is under review. You&apos;ll be able to access
        the dashboard once an admin approves your account.
      </p>
    </div>
  )
}
