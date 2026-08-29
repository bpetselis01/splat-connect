import { createServerSupabase } from '@/lib/supabase/server'
import type { Role } from '@splat-connect/types'

export async function getUserRole(): Promise<Role | null> {
  try {
    const supabase = await createServerSupabase()
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
