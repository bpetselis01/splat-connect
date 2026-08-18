import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Events — SPLAT Connect' }

export default function EventsPage() {
  return (
    <ComingSoon
      featureKey="events"
      label="Events"
      description="Build days, workshops and wherever else you can find us in person."
      steps={[
        'Browse upcoming build days and workshops near you',
        'Register for one, or ask us to run one at your school or centre',
        'Toys built on the day go to local families',
      ]}
    />
  )
}
