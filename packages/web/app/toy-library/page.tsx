import { ComingSoon } from '@/components/coming-soon'

export default function ToyLibraryPage() {
  return (
    <ComingSoon
      label="Toy Library"
      description="Associations near you with adapted and accessible toys to borrow, donate or exchange."
      steps={[
        'Find associations near you',
        'Browse the adapted toys they hold',
        'Donate a toy, or exchange one for one',
      ]}
    />
  )
}
