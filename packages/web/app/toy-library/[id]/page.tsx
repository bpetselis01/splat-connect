/**
 * One toy, in the board's detail shape.
 *
 * It was a `panel` holding a four-row <dl> — Name / Condition / Description /
 * Switch-adapted — which is a form's review step, not the page a stranger reads
 * to decide whether to ask for a child's toy. ToySummary still draws that <dl>,
 * and still should: it is exactly right for the owner checking their own
 * listing, which is its other caller.
 *
 * The board's shape is the same one the tutorial detail uses, and for the same
 * reason: the facts belong to the whole page, the photographs take the wide
 * column, and the rail carries the one action.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Gift, ArrowsLeftRight, HandTap, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { PhotoCarousel } from '@/components/photo-carousel'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { SaveButton } from '@/components/save-button'
import { getSavedIds } from '@/lib/saves'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { toyHolderName, type Toy, type ToyWithOwner } from '@splat-connect/types'

/** The same three buckets the toy library filters on, so the pill and the
 *  filter that found this toy say the same word. */
function grade(condition: number): { label: string; tint: string } {
  if (condition >= 7) return { label: 'Good condition', tint: 'var(--tok)' }
  if (condition >= 4) return { label: 'Fair condition', tint: 'var(--tamber)' }
  return { label: 'Well-loved', tint: 'var(--surface2)' }
}

function Chip({
  tint,
  icon,
  children,
}: {
  tint: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] font-extrabold"
      style={{ background: tint, color: 'var(--tink)' }}
    >
      {icon}
      {children}
    </span>
  )
}

export default async function ToyLibraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await fetch(`${process.env.API_URL}/api/public/toys/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const toy = (await res.json()) as ToyWithOwner

  const caps = await getCapabilities()
  const rawMyToys = caps ? await apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]) : []
  const myToys = rawMyToys.filter((t) => t.status === 'published')

  const saved = await getSavedIds()
  const holder = toyHolderName(toy)
  const { label: gradeLabel, tint: gradeTint } = grade(toy.condition)

  return (
    <div className="flex flex-col gap-7">
      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip tint="var(--tok)" icon={<CheckCircle size={15} weight="fill" aria-hidden="true" />}>
            Available
          </Chip>
          {toy.offer_type && (
            <Chip
              tint="var(--b100)"
              icon={
                toy.offer_type === 'exchange' ? (
                  <ArrowsLeftRight size={15} weight="fill" aria-hidden="true" />
                ) : (
                  <Gift size={15} weight="fill" aria-hidden="true" />
                )
              }
            >
              {toy.offer_type === 'exchange' ? 'Open to a swap' : 'Giving it away'}
            </Chip>
          )}
          {toy.switch_adapted && (
            <Chip
              tint="var(--surface2)"
              icon={<HandTap size={15} weight="fill" aria-hidden="true" />}
            >
              Any 3.5 mm switch
            </Chip>
          )}
          <Chip tint={gradeTint} icon={<Sparkle size={15} weight="fill" aria-hidden="true" />}>
            {gradeLabel}
          </Chip>
          {/* Not an island here: there is no card to sit on, and you often
              arrive at this page from a shared link with no card in sight. An
              ordinary control in the header row, sized up from the 34px square
              the browse grid uses. */}
          <SaveButton
            slug="toys"
            id={toy.id}
            saved={saved?.toys.includes(toy.id) ?? false}
            signedIn={saved !== null}
            className="ml-auto !h-9 !w-auto gap-2 px-3"
          />
        </div>
        <h1 className="title-article">{toy.name}</h1>
        {toy.description && (
          <p className="mt-3 max-w-[60ch] text-lg leading-[1.55] text-muted">{toy.description}</p>
        )}
        {holder && (
          <p className="mt-5 flex flex-wrap items-center gap-2.5 text-sm font-bold text-ink">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-extrabold"
              style={{ background: 'var(--tviolet)', color: 'var(--tink)' }}
            >
              {holder.slice(0, 2).toUpperCase()}
            </span>
            Held by {holder}
            {toy.owner_org_id && toy.quantity > 1 && (
              <>
                <span className="font-semibold text-muted">·</span>
                <span className="font-semibold text-muted">{toy.quantity} available</span>
              </>
            )}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <PhotoCarousel
            urls={toy.photo_urls}
            switchUrl={toy.switch_adapted ? toy.switch_photo_url : null}
            alt={toy.name}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          {/* The inline control is the entry to /request, not the request
              itself: asking has three parts — how, what you offer, and a
              paragraph about a child — and the board draws that on its own
              screen. */}
          <ToyTransactionRequest toy={toy} viewerId={caps?.profile.id ?? null} myToys={myToys} />

          <div className="rounded-card border border-line bg-mint-soft p-[22px] text-ink">
            <p className="m-0 font-display text-lg font-extrabold leading-[1.2]">Not this one?</p>
            <p className="m-0 mt-1 text-sm leading-[1.5]">
              Nobody&apos;s address is ever shown — you agree a pickup in the thread and confirm
              the handoff with a six-digit code.
            </p>
            <Link href="/toy-library" className="mt-3 inline-block font-extrabold text-ink underline">
              Back to the toy library →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
