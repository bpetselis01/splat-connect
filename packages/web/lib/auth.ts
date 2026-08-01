import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Role } from '@splat-connect/types'

export async function getUserRole(): Promise<Role | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component cannot set cookies — middleware handles refresh
            }
          },
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    // WHY: A failed database lookup or an unexpected value in the role column
    //      would slip through and look like a valid login.
    // HOW: Returns null for any error or unrecognised role.
    if (profileError) return null
    const role = profile?.role
    if (role === 'admin' || role === 'contributor') return role
    return null
  } catch {
    return null
  }
}
