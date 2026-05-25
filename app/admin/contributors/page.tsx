import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { Profile } from '@/lib/types'

async function approveContributor(id: string) {
  'use server'
  const supabase = await createClient()
  await supabase.from('profiles').update({ approved: true }).eq('id', id)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

async function rejectContributor(id: string) {
  'use server'
  const supabase = createAdminClient()
  await supabase.auth.admin.deleteUser(id)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

export default async function ContributorsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('approved', false)
    .eq('role', 'contributor')
    .order('created_at', { ascending: true })

  const pending = (data as Profile[]) ?? []

  if (pending.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Contributor requests</h1>
        <p className="text-gray-400">No pending requests.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contributor requests</h1>
      <div className="flex flex-col gap-3">
        {pending.map((p) => (
          <div
            key={p.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-gray-500">{p.email}</p>
              <p className="text-xs text-gray-400">
                Requested {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <form action={approveContributor.bind(null, p.id)}>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700"
                >
                  Approve
                </button>
              </form>
              <form action={rejectContributor.bind(null, p.id)}>
                <button
                  type="submit"
                  className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-200"
                >
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
