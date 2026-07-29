import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { ChildProfileForm } from '@/components/child-profile-form'
import type { ChildProfile } from '@splat-connect/types'

export default async function ChildTabPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  // Null for an account that has not created one. Shown to non-parents on
  // purpose: this form is how someone becomes a parent.
  //
  // No .catch() here: null is already the legitimate "no profile yet" value,
  // so swallowing a fetch failure into the same null would seed the form's
  // ability fields to null/[]/false and Save would upsert those empties over
  // the parent's real data. Let a failed fetch throw into error.tsx instead.
  const profile = await apiClient.get<ChildProfile | null>('/api/child-profile')

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Child profile</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        This helps us suggest tutorials that suit your child. Everything is optional
        and only you can see it.
      </p>
      <ChildProfileForm profile={profile} />
    </div>
  )
}
