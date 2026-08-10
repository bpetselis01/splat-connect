'use client'
/**
 * Edit half of the child profile form. Stays on the page after a save — unlike
 * the create path, there is nowhere better to go — and calls refresh() so the
 * heading picks up a newly entered name.
 */
import { useRouter } from 'next/navigation'
import { ChildProfileForm } from '@/components/child-profile-form'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ChildProfile } from '@splat-connect/types'

export function EditChildForm({ child }: { child: ChildProfile }) {
  const router = useRouter()

  return (
    <ChildProfileForm
      profile={child}
      onSave={async (form) => {
        await browserApiClient.patch<ChildProfile>(`/api/child-profiles/${child.id}`, form)
        router.refresh()
      }}
    />
  )
}
