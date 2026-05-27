/**
 * Root Layout
 * 
 * The top-level layout that wraps all pages in the application.
 * Sets up:
 * - HTML metadata and fonts
 * - Navigation bar (with user role)
 * - User session fetching
 * - Global styling
 * 
 * Process:
 * 1. Creates Supabase server client
 * 2. Fetches user session (if logged in)
 * 3. Extracts user role (admin/contributor/null)
 * 4. Passes role to Nav component
 * 5. Nav shows different links based on role
 * 
 * Every page in /app renders inside this layout.
 * So Nav appears on every page.
 * 
 * Related files:
 * - components/nav.tsx: Navigation bar that uses role prop
 * - middleware.ts: Validates access to protected routes
 * - app/page.tsx: Home page (rendered inside layout)
 */
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Role } from '@splat-connect/types'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SPLAT Connect — Toy Adaptation Library',
  description:
    'Open-source tutorials for switch-adapting toys for children with disabilities',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let role: Role | null = null
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = (profile?.role as Role) ?? null
    }
  } catch {
    // unauthenticated or Supabase unavailable — role stays null
  }

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <Nav role={role} />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
