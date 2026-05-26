import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from './library-client'
import type { Tutorial } from '@splat-connect/types'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tutorials')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  return <LibraryClient tutorials={(data as Tutorial[]) ?? []} />
}
