import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Support SPLAT — SPLAT Connect' }

export default function SupportPage() {
  return (
    <ComingSoon
      featureKey="support"
      label="Support SPLAT"
      description="Ways to help that don’t involve a soldering iron."
      steps={[
        'Donate parts, filament or printer time',
        'Fund a build day at a school or therapy centre',
        'Sponsor the platform so it stays free to use',
      ]}
    />
  )
}
