import { ComingSoon } from '../../components/coming-soon'

// Copy mirrors the 3D Print Request flow in SPLAT_mobile_claude_design/.
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
