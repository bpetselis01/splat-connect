import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Ask an expert — SPLAT Connect' }

export default function AskAnExpertPage() {
  return (
    <ComingSoon
      featureKey="ask-an-expert"
      label="Ask an expert"
      description="Put a question to an occupational therapist or an experienced maker, and read the answers to everyone else's."
      steps={[
        'Send a question about a switch, a toy or a child’s access needs',
        'An occupational therapist or experienced maker answers it',
        'The answer joins a searchable archive here in Learn',
      ]}
    />
  )
}
