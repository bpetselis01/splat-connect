// packages/mobile/app/(my)/organisation/orders.tsx
// Print for others, scoped to the organisation (the board's Print orders). The
// first organisation led, as every organisation screen on web and mobile does.
import { PrintForOthersScreen } from '../../../components/printing/offer-screen'
import { useCapabilities } from '../../../lib/capabilities'
import { SectionStub } from '../../../components/ui/SectionStub'

export default function OrgOrders() {
  const { caps, loading } = useCapabilities()
  if (loading) return null
  const org = caps?.ledOrgs[0]
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
