/**
 * Request an organisation.
 *
 * Signed-in only, "since we need to know who to verify" — and because the
 * requester becomes the first leader when an admin approves it, so who is
 * asking is load-bearing rather than a byline.
 *
 * This is the missing half of the trust model the explainer page already
 * describes: leadership is granted by an admin and never self-started, and
 * until 060 there was no way for the people who run an organisation to start
 * that conversation at all.
 */
import Link from 'next/link'
import { LockSimple } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import { OrgRequestForm } from '@/components/org-request-form'
import type { OrganizationRequest } from '@splat-connect/types'

export const metadata = { title: 'Request an organisation — SPLAT Connect' }

const HERE = '/get-involved/organisations/request'

export default async function RequestAnOrganisationPage() {
  // Signed out gets the board's own screen — why an account comes first —
  // rather than a bare bounce to /login. Still nothing to fill in without one.
  if (!(await getCapabilities())) {
    return (
      <div className="max-w-[640px] text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-16 w-16 place-items-center rounded-card bg-[var(--b100)] text-[var(--b600)] shadow-[var(--e2)]"
        >
          <LockSimple weight="duotone" className="text-[34px]" />
        </span>
        <h1 className="mt-[18px] font-display text-[clamp(28px,3.2vw,38px)] font-extrabold leading-[1.1] text-ink">
          Sign in to request your organisation
        </h1>
        <p className="mt-3 text-base leading-[1.6] text-muted">
          We verify every request against the person asking, so we need an account to check it
          against before you tell us anything.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/login?next=${encodeURIComponent(HERE)}`} className="btn btn-primary px-[26px]">
            Sign in or create an account
          </Link>
        </div>
      </div>
    )
  }

  const existing = await apiClient
    .get<OrganizationRequest[]>('/api/organizations/requests')
    .catch(() => [] as OrganizationRequest[])

  return (
    <div className="max-w-[760px]">
      <BackLink href="/get-involved/organisations" label="For organisations" />
      <h1 className="font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
        Request to bring your organisation in
      </h1>
      <p className="mt-2.5 max-w-[60ch] text-[17px] leading-[1.55] text-muted">
        Leadership on SPLAT is granted, not self-started — an administrator checks that you
        actually work where you say before anything is created. Answer plainly and this is
        usually a same-week decision.
      </p>

      <OrgRequestForm existing={existing} />
    </div>
  )
}
