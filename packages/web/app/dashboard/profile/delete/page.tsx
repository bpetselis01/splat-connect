/**
 * Delete your account — the web half of Spec B. The preview comes from the
 * API so the page names what will happen with real counts.
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { DeleteAccountForm, type DeletionPreview } from '@/components/delete-account-form'

export default async function DeleteAccountPage() {
  const caps = await requireCapabilities()
  const preview = await apiClient.get<DeletionPreview>('/api/me/deletion')
  return (
    <section className="max-w-[640px]">
      <Link href="/dashboard/profile" className="text-sm font-extrabold text-[var(--b700)] underline">Back to Account</Link>
      <h1 className="title-hub mt-3 mb-6">Delete your account</h1>
      <DeleteAccountForm preview={preview} email={caps.profile.email} />
    </section>
  )
}
