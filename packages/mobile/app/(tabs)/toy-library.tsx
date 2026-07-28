import { ComingSoon } from '../../components/coming-soon'

// Copy mirrors the Toy Library flow in the design prototype (removed from the
// repo; see the 2026-07-23 mobile-frontend-redesign docs).
export default function ToyLibraryRoute() {
  return (
    <ComingSoon
      label="Toy Library"
      icon="cube-outline"
      description="Associations near you with adapted and accessible toys to borrow, donate or exchange."
      steps={[
        'Find associations near you',
        'Browse the adapted toys they hold',
        'Donate a toy, or exchange one for one',
      ]}
    />
  )
}
