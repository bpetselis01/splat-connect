/**
 * Organisations.
 *
 * Two audiences on one route. Signed out it is an explainer: what an
 * organisation is, and what their name on a tutorial means. Signed in it also
 * lists the directory, which exists so "Riverside Therapy backed this" is a name
 * with something behind it — for a contributor deciding who to ask, and for a
 * parent reading a badge.
 *
 * The public half is a deliberate stub. What belongs on a public organisations
 * page has not been decided, so it says what is true and no more rather than
 * inventing content that would have to be unpicked later.
 *
 * The directory is fetched only when signed in. GET /api/organizations builds
 * its Supabase client from the caller's token, so RLS resolves against their
 * identity — there is no anonymous path to this data and none is added here.
 * middleware.ts lets the exact path through while keeping /organizations/:id
 * signed in.
 *
 * Suspended organisations are listed and marked rather than hidden: one
 * vanishing from a directory is unexplainable to someone who expected to find
 * it, and their name is still on work they already backed.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: GET /api/organizations
 * - app/organizations/[id]/page.tsx: one organisation, plus its leader's workspace
 * - components/edit-backing-section.tsx: where a contributor acts on this
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { getUserRole } from '@/lib/auth'
import { Reveal } from '@/components/reveal'
import { fadeIn } from '@/lib/motion'
import { Building, Check, Shield } from '@/components/icons'
import type { Organization } from '@splat-connect/types'

const WHAT_THEY_DO = [
  {
    Icon: Check,
    title: 'They read the work',
    desc: 'A contributor can ask an organisation to look over a tutorial before it goes out. A leader there reads it properly.',
  },
  {
    Icon: Shield,
    title: 'They put their name to it',
    desc: 'If they back it, their name appears on the tutorial. That is a person standing behind it, not an automated check.',
  },
  {
    Icon: Building,
    // Deliberately not phrased "set up by SPLAT": the empty state below uses
    // that wording and a unit test matches it, so two matches would be
    // ambiguous.
    title: 'Only SPLAT creates them',
    desc: 'Organisations are therapy services, schools and community groups. They cannot sign themselves up.',
  },
]

export default async function OrganizationsPage() {
  const role = await getUserRole()

  // Fetched only for a signed-in caller. getUserRole() returns null on a failed
  // profile lookup as well as for a signed-out visitor, which fails closed to
  // the explainer rather than to an error.
  const orgs = role !== null ? await apiClient.get<Organization[]>('/api/organizations') : []

  return (
    <div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Organisations</h1>
        <p className="mt-3 leading-relaxed text-muted">
          Organisations review tutorials from contributors who ask them to. Their
          name on a tutorial means one of their leaders read it and stood behind
          it.
        </p>
      </div>

      <Reveal variants={fadeIn} className="mt-10">
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {WHAT_THEY_DO.map((item) => (
            <li key={item.title}>
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-full bg-brand-tint text-brand-dark"
              >
                <item.Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-bold text-ink">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      {role === null ? (
        <div className="mt-12 card card-tint max-w-2xl p-6">
          <h2 className="font-bold text-brand-deep">Looking for a specific organisation?</h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-deep">
            The directory is available once you are signed in.
          </p>
          <Link href="/login" className="btn btn-accent mt-4">
            Sign in
          </Link>
        </div>
      ) : (
        <div className="mt-12">
          <h2 className="mb-4 text-xl font-bold text-ink">Directory</h2>
          {orgs.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span aria-hidden="true" className="empty-badge text-brand-dark">
                <Building className="h-8 w-8" />
              </span>
              <p className="mt-4 font-bold text-ink">No organisations yet.</p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
                Organisations are set up by SPLAT. Once one exists, you can ask it
                to back a project when you submit.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="card card-link p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-bold text-ink">{org.name}</p>
                    {org.status === 'suspended' && (
                      <span className="badge bg-sunken text-muted">SUSPENDED</span>
                    )}
                  </div>
                  {org.description && (
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
                      {org.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
