import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Request a print — SPLAT Connect' }

export default function PrintingRequestsPage() {
  return (
    <ComingSoon
      featureKey="printing"
      label="Request a print"
      description="Request a printed part at a public association, sized to your child’s measurements — or volunteer your own printer."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
