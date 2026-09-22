import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import { ShareButton } from '@/components/share-button'
import { SaveButton } from '@/components/save-button'
import { ThanksButton } from '@/components/thanks-button'
import { apiClient } from '@/lib/api-client'
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
  // Only asked when signed in; a signed-out visitor has thanked nothing. A
  // failed read degrades to "not yet" — the POST's 409 corrects it on tap.
  const thanks =
    saved === null
      ? { thanked: false, own: false }
      : await apiClient
          .get<{ thanked: boolean; own: boolean }>(`/api/tutorials/${id}/thanks`)
          .catch(() => ({ thanked: false, own: false }))

  const signedIn = saved !== null

  return (
    <>
      {/* The board's trail. The layout's shared Breadcrumb draws nothing on a
          guide (it is not inside a nav section), so the page carries its own. */}
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm font-bold text-muted">
        <Link href="/library">Guides</Link>
        <CaretRight aria-hidden="true" />
        <span aria-current="page" className="text-ink">{tutorial.title}</span>
      </nav>
      <TutorialView
        tutorial={tutorial}
        signedIn={signedIn}
        actions={
          /* The board gives a guest Share alone: saving and thanking both need
             an account, and the rail already says so under the button. */
          signedIn ? (
            <>
              <SaveButton
                slug="tutorials"
                id={tutorial.id}
                saved={saved.tutorials.includes(tutorial.id)}
                signedIn
                withLabel
              />
              <ShareButton title={tutorial.title} />
              <ThanksButton
                tutorialId={tutorial.id}
                count={tutorial.thanks_count ?? 0}
                thanked={thanks.thanked}
                own={thanks.own}
                signedIn
              />
            </>
          ) : (
            <ShareButton title={tutorial.title} />
          )
        }
      />
    </>
  )
}
