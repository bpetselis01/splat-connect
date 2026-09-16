/**
 * Ask for a build.
 *
 * Mirrors `/toys/[id]/request`: the same three questions, the same "everything
 * else is agreed in the thread" rule. It starts either from a guide (the link
 * on a guide page carries `?guide=`) or from a maker's profile (`?maker=`), and
 * fills in whichever it was given.
 */
import { redirect } from 'next/navigation'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import { AskForBuildForm, type BuildOption } from '@/components/ask-for-build-form'
import type { Organization, Tutorial } from '@splat-connect/types'

export const metadata = { title: 'Ask for a build — SPLAT Connect' }

export default async function AskForBuildPage({
  searchParams,
}: {
  searchParams: Promise<{ guide?: string; maker?: string }>
}) {
  const caps = await requireCapabilities()
  const { guide, maker } = await searchParams

  const [tutorials, organizations] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/public/tutorials').catch(() => []),
    apiClient.get<Organization[]>('/api/public/organizations').catch(() => []),
  ])

  const guides: BuildOption[] = tutorials.map((t) => ({ id: t.id, label: t.title }))
  const makers: BuildOption[] = organizations
    .filter((org) => org.status === 'active')
    .map((org) => ({ id: org.id, label: org.name }))

  let makerName: string | null = null
  if (maker) {
    /*
     * /api/public/makers, not /api/public/contributors: the latter 404s on
     * zero public contributions, which is right for a showcase profile and
     * wrong here — somebody who has never published a guide can still be asked
     * to build one. The gate is the same one the build endpoint applies.
     *
     * Resolved server-side rather than trusted from the URL: the name is shown
     * as "you are asking X", and a name taken from a query parameter would let
     * a link claim the request is going to somebody it is not.
     */
    try {
      const profile = await apiClient.get<{ name: string }>(`/api/public/makers/${maker}`)
      makerName = profile.name
    } catch {
      redirect('/get-involved/requests')
    }
  }
  if (maker === caps.profile.id) redirect('/get-involved/requests')

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/get-involved/requests" label="Adaptation requests" />
      <h1 className="mt-2 title-detail">Ask for a build</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
        Pick a guide, say who it is for, and a maker takes it from there.
      </p>

      <AskForBuildForm
        guides={guides}
        makers={makers}
        defaultGuideId={guide}
        makerId={makerName ? maker : undefined}
        makerName={makerName ?? undefined}
      />
    </div>
  )
}
