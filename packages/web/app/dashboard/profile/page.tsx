/**
 * Dashboard Page — Account tab
 *
 * Body of the shared dashboard (app/dashboard/layout.tsx renders the tab strip
 * around it). Lets a signed-in account change its display name and manage its
 * child profiles; email and role are frozen at the database layer (see
 * components/profile-form.tsx).
 *
 * Child profiles moved in here from app/dashboard/child/page.tsx on
 * 2026-08-25: it isn't one of the rail's three pillars (a tutorial, a toy
 * exchange, a design challenge), it's account-level data, the same as the
 * notifications row already living in this group. The per-child routes
 * (/dashboard/child/[id], /dashboard/child/new) stay where they are — only
 * the list moved.
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { ProfileForm } from '@/components/profile-form'
import { SignOutButton } from '@/components/sign-out-button'
import { PersonSimple } from '@phosphor-icons/react/dist/ssr'
import { childSummary, type ChildProfile, type Tutorial, type UserAgreement } from '@splat-connect/types'

// The board's avatar tints, in its order; a child keeps its tint by position.
const TINTS = ['var(--b100)', 'var(--tcoral)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)']

export default async function ProfileTabPage() {
  const caps = await requireCapabilities()

  // No .catch() here: an empty array is already the legitimate "no children yet"
  // value, so swallowing a fetch failure into the same empty array would tell a
  // parent their children are gone. Let a failed fetch throw into error.tsx.
  const [children, agreements, mine] = await Promise.all([
    apiClient.get<ChildProfile[]>('/api/child-profiles'),
    // Only feeds a chip, so a failure degrades to no chip rather than an error page.
    apiClient.get<UserAgreement[]>('/api/agreements/me').catch(() => [] as UserAgreement[]),
    // Only feeds the featured-guide pick, which hides when there is nothing to pick.
    apiClient.get<Tutorial[]>('/api/tutorials/mine').catch(() => [] as Tutorial[]),
  ])
  const publishedGuides = mine.filter((t) => t.status === 'approved').map((t) => ({ id: t.id, title: t.title }))
  // Newest first from the API, so find() is the version they last accepted.
  const terms = agreements.find((a) => a.agreement_type === 'contributor_terms')

  const badges = (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full bg-[var(--b100)] px-3 py-[5px] text-[13px] font-extrabold text-[var(--b700)]">
        {caps.isAdmin ? 'Admin' : 'Contributor'}
      </span>
      {caps.ledOrgs.map((org) => (
        <span
          key={org.id}
          className="rounded-full bg-[var(--tmint)] px-3 py-[5px] text-[13px] font-extrabold text-[var(--tink)]"
        >
          Leader — {org.name}
        </span>
      ))}
      {terms && (
        <span className="rounded-full bg-[var(--tviolet)] px-3 py-[5px] text-[13px] font-extrabold text-[var(--tink)]">
          Contributor terms {terms.version} accepted
        </span>
      )}
    </div>
  )

  return (
    <section className="max-w-[760px]">
      {/* The board has no sign-out here, but nothing else on the web app offers
          one, so it stays until the account menu carries it. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="title-hub">Account</h1>
        <SignOutButton />
      </div>
      <ProfileForm profile={caps.profile} badges={badges} publishedGuides={publishedGuides} />

      <div className="mt-10 flex flex-wrap items-end justify-between gap-5 border-t border-line pt-7">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Child profiles</h2>
          <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">
            This helps us suggest tutorials that suit your children. Everything is
            optional and only you can see it.
          </p>
        </div>
        <Link href="/dashboard/child/new" className="btn btn-coral">
          + Add child
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="mt-6 flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-dark">
            <PersonSimple className="h-8 w-8" weight="bold" aria-hidden="true" />
          </span>
          <p className="mt-4 font-bold text-ink">
            You haven&apos;t added any child profiles yet.
          </p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            A profile can include age, hand use and grip details — all optional, all
            private to you.
          </p>
          <Link href="/dashboard/child/new" className="btn btn-accent mt-6">
            Add your first child
          </Link>
        </div>
      ) : (
        <ul className="mt-[22px] grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {children.map((child, i) => {
            const name = child.name?.trim() || `Child ${i + 1}`
            return (
              <li key={child.id}>
                <Link
                  href={`/dashboard/child/${child.id}`}
                  className="flex h-full items-center gap-3 rounded-[18px] border border-line bg-surface p-5 text-ink shadow-e1 transition-shadow hover:shadow-e2"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 flex-none place-items-center rounded-full text-[15px] font-extrabold text-[var(--tink)]"
                    style={{ background: TINTS[i % TINTS.length] }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-extrabold">{name}</span>
                    <span className="block text-[13px] text-muted">{childSummary(child)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
          <li>
            <Link
              href="/dashboard/child/new"
              className="grid h-full min-h-[84px] place-items-center rounded-[18px] border border-dashed border-line p-5 text-center text-[15px] font-extrabold text-muted"
            >
              <span>
                <span aria-hidden="true" className="mb-1.5 block text-[22px] leading-none">+</span>
                Add another
              </span>
            </Link>
          </li>
        </ul>
      )}
    </section>
  )
}
