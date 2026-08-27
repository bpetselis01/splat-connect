/**
 * A static segment beside [type], so it wins the route match and the dynamic
 * list never sees this slug — the same reason 'printable_part' has no entry in
 * packages/api's SOURCE map.
 *
 * Doubly not-yet: the parts catalogue at /printing/parts has not shipped
 * either, so there is nothing to have saved.
 */
import { ComingSoon } from '@/components/coming-soon'

export const metadata = {
  title: 'Saved parts — SPLAT Connect',
}

export default function SavedPartsPage() {
  return (
    <ComingSoon
      label="Saved parts"
      description="Printable parts you want to make or ask someone to print for you."
      steps={[
        'Browse the parts catalogue once it opens',
        'Save the ones that fit your toy',
        'Print them, or request a print',
      ]}
    />
  )
}
