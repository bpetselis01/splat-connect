/**
 * Navigation Bar Component
 * 
 * Top navigation showing SPLAT Connect branding and user menu.
 * Displayed on every page (from root layout.tsx).
 * 
 * Props:
 * - role: User role ('admin' | 'contributor' | null for logged-out)
 * 
 * Navigation items (dynamic based on role):
 * - Library: Browse approved tutorials (everyone)
 * - Dashboard: Contributor hub (contributors only)
 * - Admin: Admin dashboard (admins only)
 * - Sign Out: Logout button (if authenticated)
 * 
 * Data flow:
 * 1. layout.tsx fetches user session
 * 2. Passes user.role to Nav component
 * 3. Nav renders different links based on role
 * 4. User clicks link → navigates to page
 * 5. Page middleware validates access (middleware.ts)
 * 
 * Features:
 * - Responsive design (stacks on mobile)
 * - Sign out button with Supabase auth integration
 * - Links change based on user role
 * - Branding with emoji logo
 * 
 * Related files:
 * - app/layout.tsx: Root layout, calls Nav
 * - middleware.ts: Validates route access
 * - routes/contributors.ts: Fetches user profile (for role)
 */
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@splat-connect/types'

interface NavProps {
  role: Role | null
}

export function Nav({ role }: NavProps) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-[#1e3a5f] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      <Link href="/" className="font-bold text-base sm:text-lg tracking-wide shrink-0">
        🧩 SPLAT Connect
      </Link>
      <div className="flex items-center gap-3 sm:gap-5 text-sm flex-wrap">
        <Link href="/library" className="hover:opacity-80">
          Library
        </Link>
        {role === 'admin' && (
          <Link href="/admin" className="hover:opacity-80">
            Admin
          </Link>
        )}
        {role === 'contributor' && (
          <>
            <Link href="/dashboard" className="hover:opacity-80">
              Dashboard
            </Link>
            <Link href="/upload" className="hover:opacity-80">
              Upload
            </Link>
            <Link href="/my-tutorials" className="hover:opacity-80">
              My Tutorials
            </Link>
          </>
        )}
        {role ? (
          <button
            onClick={signOut}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs"
          >
            Sign out
          </button>
        ) : (
          <Link
            href="/signup"
            className="bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded-md font-semibold text-xs"
          >
            Contribute
          </Link>
        )}
      </div>
    </nav>
  )
}
