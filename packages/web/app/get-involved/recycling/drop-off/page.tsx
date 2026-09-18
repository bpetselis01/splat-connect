/**
 * Book a drop-off. The account check, the organisations that take plastic, and
 * the form.
 *
 * Signed out lands on /login and returns here: an organisation has to credit
 * somebody, and there is no anonymous drop-off.
 *
 * `?org=` preselects, which is how the organisation's own public page reaches
 * this screen — its inline form is gone, because a seven-line declaration does
 * not belong in a sidebar.
 */
import { redirect } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { DropoffForm, type DropoffOrg } from '@/components/dropoff-form'

export const metadata = { title: 'Book a drop-off — SPLAT Connect' }

export default async function BookDropoffPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const caps = await getCapabilities()
  if (!caps) {
    redirect(`/login?next=${encodeURIComponent('/get-involved/recycling/drop-off')}`)
  }
  const { org } = await searchParams

  const all = await apiClient
    .get<DropoffOrg[]>('/api/public/organizations')
    .catch(() => [] as DropoffOrg[])
  // Only the ones that have said what they can take. An organisation with an
  // empty list is one whose first field has no valid answer.
  const takers = all.filter((o) => (o.recycling_materials ?? []).length > 0)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="title-article">Book a drop-off</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        One contaminated bag can ruin a whole extruder run, so the declaration is the real work
        here. The weight you give is a heads-up — they weigh it again at the door, and that is
        the number that becomes credit.
      </p>
      <DropoffForm orgs={takers} initialOrgId={org} />
    </div>
  )
}
