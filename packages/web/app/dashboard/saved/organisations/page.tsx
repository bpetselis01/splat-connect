/**
 * A static segment beside [type], so it wins the route match and the dynamic
 * list never sees this slug — the same reason 'organisation' has no entry in
 * packages/api's SOURCE map.
 *
 * A placeholder route rather than a card that links to the page it is already
 * on: that is what /dashboard/print-requests does for the same situation, and
 * it gives each hub card a distinct href.
 */
import { ComingSoon } from '@/components/coming-soon'

export const metadata = {
  title: 'Saved organisations — SPLAT Connect',
}

export default function SavedOrganisationsPage() {
  return (
    <ComingSoon
      label="Saved organisations"
      description="Groups whose work you want to follow, kept in one place."
      steps={[
        'Save an organisation from its public page',
        'See what they have backed and shared',
        'Find them again without searching',
      ]}
    />
  )
}
