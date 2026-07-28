/**
 * Organisation Leader Dashboard
 *
 * Two lists, and the split between them is the point: backing a project is a
 * commitment to look at it, not a verdict on it.
 *
 * 1. Projects asking for your backing — a contributor named this organisation
 *    when they submitted. Accepting is what confers review authority.
 * 2. Waiting for your review — projects this organisation already backs.
 *
 * Both come from GET /api/tutorials with no filter for safety: the leader read
 * grant in 007 already limits that list to projects offered to an organisation the
 * caller leads. The filtering here only splits the two lists.
 *
 * Access is checked by requireOrgLeader rather than by middleware — leadership is
 * per-organisation data, not a role. See lib/org-access.ts.
 *
 * Related files:
 * - packages/api/src/routes/tutorial-orgs.ts: accept and decline
 * - app/org/[orgId]/review/[tutorialId]: the approve/reject screen
 * - components/org-review-banner.tsx: the terms gate for reviewing
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import { isOrgLeader } from '@/lib/org-access'
import { OrgReviewBanner } from '@/components/org-review-banner'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, TutorialOrg, UserAgreement, Organization, OrgLeader } from '@splat-connect/types'

async function acceptBacking(formData: FormData) {
  'use server'
  const tutorialId = formData.get('tutorialId') as string
  const orgId = formData.get('orgId') as string
  await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/accept`, {})
  revalidatePath(`/organizations/${orgId}`)
}

async function declineBacking(formData: FormData) {
  'use server'
  const tutorialId = formData.get('tutorialId') as string
  const orgId = formData.get('orgId') as string
  await apiClient.post(`/api/tutorials/${tutorialId}/orgs/${orgId}/decline`, {})
  revalidatePath(`/organizations/${orgId}`)
}

type Backed = Tutorial & { tutorial_orgs?: TutorialOrg[] }

type OrgWithLeaders = Organization & { org_leaders?: OrgLeader[] }

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orgId } = await params

  let org: OrgWithLeaders
  try {
    org = await apiClient.get<OrgWithLeaders>(`/api/organizations/${orgId}`)
  } catch {
    notFound()
  }

  // Leadership decides what the page SHOWS, not whether it renders. One URL serves
  // a parent reading a badge and a leader working — a non-leader gets the public
  // view, never a bounce to '/'.
  const leads = await isOrgLeader(orgId)

  const [tutorials, agreements] = await Promise.all([
    apiClient.get<Backed[]>('/api/tutorials').catch(() => [] as Backed[]),
    leads
      ? apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[])
      : Promise.resolve([] as UserAgreement[]),
  ])
  const hasTerms = agreements.some((a) => a.agreement_type === 'org_leader_terms')
  const canReview = leads && hasTerms && org!.status === 'active'

  const rowFor = (t: Backed) => t.tutorial_orgs?.find((b) => b.org_id === orgId)
  const requests = leads ? tutorials.filter((t) => rowFor(t)?.status === 'pending') : []
  const queue = leads
    ? tutorials.filter((t) => rowFor(t)?.status === 'accepted' && t.status === 'pending')
    : []

  // The public half: what this organisation has actually put its name to. Derived
  // from the list rather than a dedicated endpoint — GET /api/tutorials already
  // embeds the backing rows.
  const backed = tutorials.filter(
    (t) => t.status === 'approved' && rowFor(t)?.status === 'accepted'
  )

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-ink">{org!.name}</h1>
      {org!.description && (
        <p className="mb-6 max-w-prose text-muted">{org!.description}</p>
      )}

      {org!.status === 'suspended' && (
        <p className="alert alert-danger mb-6">
          This organisation is suspended. You can still see its work, but you cannot
          approve or reject anything.
        </p>
      )}

      {/* The public half — what this organisation has actually put its name to.
          This is the answer to "who are they?" that a badge on a library card
          cannot give, and it is the same for a leader and a stranger. */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Tutorials backed ({backed.length})
        </h2>
        {backed.length === 0 ? (
          <p className="empty-badge">
            This organisation has not backed a published tutorial yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {backed.map((t) => (
              <li key={t.id} className="card p-4">
                <Link href={`/tutorials/${t.id}`} className="text-sm font-bold text-ink">
                  {t.title}
                </Link>
                {t.description && (
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                    {t.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {leads && (
        <>
        {!hasTerms && <OrgReviewBanner />}

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Projects asking for your backing ({requests.length})
          </h2>
          {requests.length === 0 ? (
            <p className="empty-badge">
              Nothing waiting. Contributors ask by choosing your organisation when they
              submit a tutorial.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((t) => (
                <li key={t.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/tutorials/${t.id}`} className="font-medium">
                      {t.title}
                    </Link>
                    <DifficultyBadge difficulty={t.difficulty} />
                  </div>
                  {t.description && <p className="mt-2 text-sm text-muted">{t.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <form action={acceptBacking}>
                      <input type="hidden" name="tutorialId" value={t.id} />
                      <input type="hidden" name="orgId" value={orgId} />
                      <button type="submit" className="btn btn-accent">
                        Back this project
                      </button>
                    </form>
                    <form action={declineBacking}>
                      <input type="hidden" name="tutorialId" value={t.id} />
                      <input type="hidden" name="orgId" value={orgId} />
                      <button type="submit" className="btn">
                        Decline
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Waiting for your review ({queue.length})
          </h2>
          {queue.length === 0 ? (
            <p className="empty-badge">Nothing to review right now.</p>
          ) : (
            <ul className="space-y-3">
              {queue.map((t) => (
                <li key={t.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    {canReview ? (
                      <Link href={`/organizations/${orgId}/review/${t.id}`} className="font-medium">
                        {t.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-muted">{t.title}</span>
                    )}
                    <DifficultyBadge difficulty={t.difficulty} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </>
      )}
    </div>
  )
}
