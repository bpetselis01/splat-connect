import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: '3D print requests — SPLAT Connect' }

export default function PrintingPage() {
  return (
    <ComingSoon
      featureKey="printing"
      label="3D print requests"
      description="Request a printed part at a public association, sized to your child’s measurements — or volunteer your own printer."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
