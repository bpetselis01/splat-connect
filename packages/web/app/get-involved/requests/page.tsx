import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Adaptation requests — SPLAT Connect' }

export default function RequestsPage() {
  return (
    <ComingSoon
      featureKey="requests"
      label="Adaptation requests"
      description="Ask for a toy to be adapted for your child, and let a contributor or organisation near you pick it up."
      steps={[
        'Describe the toy and what your child needs it to do',
        'A contributor or organisation nearby claims the request',
        'They build it, then arrange handover through the platform',
      ]}
    />
  )
}
