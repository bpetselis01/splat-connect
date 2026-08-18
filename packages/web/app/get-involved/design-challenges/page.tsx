import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Design challenges — SPLAT Connect' }

export default function DesignChallengesPage() {
  return (
    <ComingSoon
      featureKey="design-challenges"
      label="Design challenges"
      description="Problems nobody has solved yet — a toy that resists adaptation, or a need no existing guide covers."
      steps={[
        'A family or therapist posts a problem with no known solution',
        'Anyone can work on it, alone or together, and share attempts',
        'A working answer becomes a guide in the library',
      ]}
    />
  )
}
