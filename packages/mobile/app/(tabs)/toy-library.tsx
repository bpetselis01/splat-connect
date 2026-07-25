import { ComingSoon } from '../../components/coming-soon'

// Copy mirrors the Toy Library flow in SPLAT_mobile_claude_design/.
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
