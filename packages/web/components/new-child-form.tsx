'use client'
/**
 * Create half of the child profile form. Exists because ChildProfileForm needs
 * an onSave from a client component, and the route that renders it is a server
 * component.
 */
import { useRouter } from 'next/navigation'
import { ChildProfileForm } from '@/components/child-profile-form'
import { browserApiClient } from '@/lib/browser-api-client'
import type { ChildProfile } from '@splat-connect/types'

export function NewChildForm() {
  const router = useRouter()

  return (
    <ChildProfileForm
      profile={null}
      onSave={async (form) => {
        await browserApiClient.post<ChildProfile>('/api/child-profiles', form)
        // refresh() so the list re-fetches on the server rather than showing a
        // cached page without the child that was just created.
        router.push('/dashboard/child')
        router.refresh()
      }}
    />
  )
}
