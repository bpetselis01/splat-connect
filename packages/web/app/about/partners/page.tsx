import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Partners and supporters — SPLAT Connect' }

export default function PartnersPage() {
  return (
    <ComingSoon
      featureKey="partners"
      label="Partners and supporters"
      description="The organisations, funders and suppliers who make the work possible."
      steps={[
        'Therapy services, schools and disability organisations we work with',
        'Funders and grant programs supporting the platform',
        'Suppliers donating parts, filament and printer time',
      ]}
    />
  )
}
