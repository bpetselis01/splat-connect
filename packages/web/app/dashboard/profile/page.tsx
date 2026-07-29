/**
 * Dashboard Page — Profile tab
 *
 * Body of the shared dashboard (app/dashboard/layout.tsx renders the tab strip
 * around it). Lets a signed-in account change its display name; email and role
 * are frozen at the database layer (see components/profile-form.tsx).
 */
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { ProfileForm } from '@/components/profile-form'

export default async function ProfileTabPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Profile</h1>
      <ProfileForm profile={caps.profile} />
    </div>
  )
}
