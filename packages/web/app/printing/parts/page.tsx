import { ComingSoon } from '@/components/coming-soon'

export const metadata = { title: 'Printable parts — SPLAT Connect' }

export default function PrintingPartsPage() {
  return (
    <ComingSoon
      featureKey="printing-parts"
      label="Printable parts"
      description="A catalogue of STL files for switch mounts, cases and interrupter housings — each one sized and print-tested rather than guessed at."
      steps={[
        'Search by what the part has to do, not by filename',
        'Check the tested filament and settings before you print',
        'Print it yourself, or send it to an association that will',
      ]}
    />
  )
}
