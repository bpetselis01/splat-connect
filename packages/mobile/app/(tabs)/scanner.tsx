import { ComingSoon } from '../../components/coming-soon'

// Copy mirrors the Toy Scanner flow in SPLAT_mobile_claude_design/, so the
// placeholder promises what the prototype actually specifies.
export default function ScannerRoute() {
  return (
    <ComingSoon
      label="Toy Scanner"
      icon="scan-outline"
      description="Point your camera at a toy to get adaptation ideas matched to your child's profile."
      steps={[
        'Scan a toy with your camera',
        'We identify its shape, buttons and switches',
        'See the adaptation guides that match',
      ]}
    />
  )
}
