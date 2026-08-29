import { notFound } from 'next/navigation'
import { SaveButton } from '@/components/save-button'
import { getSavedIds } from '@/lib/saves'
import { TutorialView } from '@/components/tutorial-view'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/tutorials/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  // The public endpoint embeds accepted backing and the approver, so a logged-out
  // parent gets them without a second, authenticated call.
  const tutorial = (await res.json()) as TutorialWithDetails & {
    tutorial_orgs?: TutorialOrg[]
    reviewer?: { name: string } | null
    reviewed_for?: { name: string } | null
  }

  const saved = await getSavedIds()

  return (
    <TutorialView
      tutorial={tutorial}
      headerAction={
        /* Not an island here: there is no card to sit on, and you often
           arrive at this page from a shared link with no card in sight. An
           ordinary control in the header row, sized up from the 34px square
           the browse grid uses. */
        <SaveButton
          slug="tutorials"
          id={tutorial.id}
          saved={saved?.tutorials.includes(tutorial.id) ?? false}
          signedIn={saved !== null}
          className="ml-auto !h-9 !w-auto gap-2 px-3"
        />
      }
    />
  )
}
