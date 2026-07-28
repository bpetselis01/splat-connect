import { ComingSoon } from '../../components/coming-soon'

// Copy mirrors the 3D Print Request flow in the design prototype (removed from
// the repo; see the 2026-07-23 mobile-frontend-redesign docs).
export default function PrintRoute() {
  return (
    <ComingSoon
      label="3D Print Requests"
      icon="print-outline"
      description="Request a printed part at a public association, sized to your child's measurements."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
