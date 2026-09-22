import { MapTrifold } from '@phosphor-icons/react/dist/ssr'
import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Deliveries map — SPLAT Connect' }

export default function MapPage() {
  return (
    <ComingSoon
      featureKey="map"
      label="Deliveries map"
      description="Where adapted toys have actually landed."
      icon={MapTrifold}
      steps={[]}
      alternatives={[
        { label: 'Community impact', href: '/impact' },
        { label: 'Organisations', href: '/organizations' },
      ]}
    />
  )
}
