/**
 * Print orders — the same three tabs as Print for others, scoped to the
 * organisation's machines.
 *
 * The artboard says exactly that, so this renders the same screen rather than a
 * second copy of it. Every leader sees this queue, and pickup is always the
 * organisation's address — which is not a rule enforced here but in 033's
 * accept, where a leader's own address is ignored for an org-held record.
 *
 * Was a ComingSoon placeholder until 058.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { PrintOfferScreen } from '@/app/dashboard/printers/page'

export const metadata = { title: 'Print orders — SPLAT Connect' }

export default async function OrgPrintOrdersPage() {
  const caps = await getCapabilities()
  // The tab strip hides this for a non-leader, but the strip is an affordance —
  // the page is its own control (lib/org-access.ts states the same rule).
  if (!caps || caps.ledOrgs.length === 0) notFound()

  // One organisation per leader is the shape everywhere else in this tab; a
  // leader of two sees the first, which is the same narrowing
  // /dashboard/organisation already makes.
  const org = caps.ledOrgs[0]

  return (
    <PrintOfferScreen
      orgId={org.id}
      title="Print orders"
      lead="Every leader sees this queue. Pickup is always the organisation’s address."
    />
  )
}
