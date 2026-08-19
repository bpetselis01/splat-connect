import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Deliveries map — SPLAT Connect' }

export default function MapPage() {
  return (
    <ComingSoon
      featureKey="map"
      label="Deliveries map"
      description="Where adapted toys have actually landed — a picture of the reach, without identifying anyone."
      steps={[
        'Every completed handover adds a point, by area rather than address',
        'Filter by state, or by the kind of toy',
        'See where there are makers, and where there are none yet',
      ]}
    />
  )
}
