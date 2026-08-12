import { ComingSoon } from '@/components/coming-soon'

export default function PrintingPage() {
  return (
    <ComingSoon
      label="3D Print Requests"
      description="Request a printed part at a public association, sized to your child's measurements."
      steps={[
        'Pick an association with printers free',
        'Describe the part and how many you need',
        "They'll be in touch about pickup",
      ]}
    />
  )
}
