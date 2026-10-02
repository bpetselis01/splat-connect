/**
 * Test prints — the queue that makes a printer verified (098). Passing one is
 * half of it; the other half is three completed jobs, which nobody here sets.
 */
import { apiClient } from '@/lib/api-client'
import { AdminTestPrints, type AdminTestPrint } from '@/components/admin-test-prints'

export const metadata = { title: 'Test prints — SPLAT Connect' }

export default async function AdminTestPrintsPage() {
  const prints = await apiClient.get<AdminTestPrint[]>('/api/admin/test-prints').catch(() => [] as AdminTestPrint[])
  return (
    <div className="max-w-[980px]">
      <h1 className="title-hub">Test prints</h1>
      <p className="mt-2 mb-[22px] max-w-[60ch] text-[15px] text-muted">
        A photo of the SPLAT test print from each printer that asked to be verified. Pass or fail it; the owner reads
        your note.
      </p>
      <AdminTestPrints prints={prints} />
    </div>
  )
}
