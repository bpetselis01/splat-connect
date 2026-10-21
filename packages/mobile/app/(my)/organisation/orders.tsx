// packages/mobile/app/(my)/organisation/orders.tsx
// Print for others, scoped to the organisation (the board's Print orders), for the
// organisation being acted for.
import { PrintForOthersScreen } from '../../../components/printing/offer-screen'
import { useActingOrg } from '../../../lib/acting-org'
import { SectionStub } from '../../../components/ui/SectionStub'

export default function OrgOrders() {
  const { org, loading } = useActingOrg()
  if (loading) return null
  if (!org) {
    return (
      <SectionStub
        title="Print orders"
        blurb="This screen belongs to organisation leaders. When an organisation makes you a leader, its print orders show up here."
      />
    )
  }
  return <PrintForOthersScreen orgId={org.id} />
}
