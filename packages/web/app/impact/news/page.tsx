import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'News and stories — SPLAT Connect' }

export default function NewsPage() {
  return (
    <ComingSoon
      featureKey="news"
      label="News and stories"
      description="What families and makers have actually done with SPLAT, in their own words."
      steps={[
        'A family or contributor shares what they made and what changed',
        'We write it up with their permission and their photographs',
        'It appears here and on the homepage',
      ]}
    />
  )
}
