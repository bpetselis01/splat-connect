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
import type { ReactNode } from 'react'
import {
  ArrowsLeftRight,
  CheckCircle,
  Gift,
  HandHeart,
  HandTap,
  Heart,
} from '@phosphor-icons/react/dist/ssr'
import { PhotoCarousel } from '@/components/photo-carousel'
import { ToyTransactionRequest } from '@/components/toy-transaction-request'
import { SaveButton } from '@/components/save-button'
import { BoundaryLink } from '@/components/boundary-link'
import { tintFor } from '@/components/card-photo'
import { getSavedIds } from '@/lib/saves'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { gradeOf } from '@/lib/toy-grade'
import { agoInWords } from '@/lib/relative-time'
import { toyHolderName, type OfferType, type Toy, type ToyWithOwner } from '@splat-connect/types'

/** The board's three offers: the chip's word and tint, and the rail's sentence. */
const OFFER: Record<OfferType, { label: string; tint: string; Icon: typeof Gift; note: (holder: string) => string }> = {
  donation: {
    label: 'Giving it away',
    tint: 'var(--tmint)',
    Icon: Gift,
    note: (h) => `A one-way gift. Nothing is expected back, and ${h} confirms the handover on their own.`,
  },
  exchange: {
    label: 'Swap only',
    tint: 'var(--tviolet)',
    Icon: ArrowsLeftRight,
    note: (h) => `${h} wants a toy back. You offer one of yours, and you both confirm the handover.`,
  },
  both: {
    label: 'Swap or gift',
    tint: 'var(--tamber)',
    Icon: HandHeart,
    note: (h) => `${h} is open to either. Offer one of yours, or just ask — they decide which.`,
  },
}

function Chip({ tint, icon, children }: { tint: string; icon: ReactNode; children: ReactNode }) {
  return (
    <span className="pill-tag pill-tag--lg" style={{ backgroundColor: tint }}>
      {icon}
      {children}
    </span>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
  const [rawMyToys, listed, saved] = await Promise.all([
    caps ? apiClient.get<Toy[]>('/api/toys').catch(() => [] as Toy[]) : ([] as Toy[]),
    // The holder's other listings, for the board's "Also worth a look". The
    // public list is what the library already reads; a failure only loses
    // the section.
    fetch(`${process.env.API_URL}/api/public/toys`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<ToyWithOwner[]>) : []))
      .catch(() => [] as ToyWithOwner[]),
    getSavedIds(),
  ])
  const myToys = rawMyToys.filter((t) => t.status === 'published')

  const holder = toyHolderName(toy)
  const grade = gradeOf(toy.condition)
  const offer = toy.offer_type ? OFFER[toy.offer_type] : null
  const sameHolder = listed.filter((t) =>
    toy.owner_org_id ? t.owner_org_id === toy.owner_org_id : t.owner_id === toy.owner_id
  )
  // The board's "Also worth a look" is what else the holder has listed. A
  // holder with one toy would leave the section blank, so the rest of the
  // library stands in — the page always has somewhere to go next.
  const holderOthers = sameHolder.filter((t) => t.id !== toy.id)
  const others = (holderOthers.length > 0 ? holderOthers : listed.filter((t) => t.id !== toy.id)).slice(0, 3)
  const othersNote =
    holderOthers.length > 0 && holder ? `What else ${holder} has listed.` : 'More toys in the library right now.'

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-7">
        <header>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* /api/public/toys/:id only serves a toy that is up for grabs. */}
            <Chip tint="var(--tok)" icon={<CheckCircle weight="fill" aria-hidden="true" />}>
              Available
            </Chip>
            {offer && (
              <Chip tint={offer.tint} icon={<offer.Icon weight="fill" aria-hidden="true" />}>
                {offer.label}
              </Chip>
            )}
            {toy.switch_adapted && (
              <Chip tint="var(--surface2)" icon={<HandTap weight="fill" aria-hidden="true" />}>
                Any 3.5 mm switch
              </Chip>
            )}
            <Chip tint={grade.tint} icon={<Heart weight="fill" aria-hidden="true" />}>
              {grade.label}
            </Chip>
          </div>
          <h1 className="title-article">{toy.name}</h1>
          <p className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
            {holder && (
              <span className="inline-flex items-center gap-2 font-bold text-ink">
                <span aria-hidden="true" className="byline-avatar !ml-0 !border-0">
                  {initials(holder)}
                </span>
                Held by {holder}
              </span>
            )}
            {toy.owner_org_id && toy.quantity > 1 && (
              <>
                <span className="text-muted">·</span>
                <span className="font-semibold text-muted">{toy.quantity} available</span>
              </>
            )}
            {holder && <span className="text-muted">·</span>}
            <span className="font-semibold text-muted">Listed {agoInWords(toy.created_at)}</span>
          </p>
        </header>

        <PhotoCarousel
          urls={toy.photo_urls}
          switchUrl={toy.switch_adapted ? toy.switch_photo_url : null}
          alt={toy.name}
        />

        {/* The one field the holder writes is their note about the toy, and the
            board gives it a heading in their name rather than a lede under
            the title. */}
        {toy.description && (
          <section aria-labelledby="toy-notes-h" className="flex flex-col gap-3 border-t border-line pt-[26px]">
            <h2 id="toy-notes-h" className="m-0 font-display text-[26px] font-extrabold text-ink">
              Notes from {holder ?? 'the holder'}
            </h2>
            <p className="m-0 max-w-[62ch] whitespace-pre-line text-base leading-[1.6] text-ink">
              {toy.description}
            </p>
          </section>
        )}

        {others.length > 0 && (
          <section aria-labelledby="toy-rec-h" className="flex flex-col gap-4 border-t border-line pt-[26px]">
            <div>
              <h2 id="toy-rec-h" className="m-0 font-display text-[26px] font-extrabold text-ink">
                Also worth a look
              </h2>
              <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-[1.5] text-muted">{othersNote}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {others.map((t) => (
                <BoundaryLink key={t.id} href={`/toy-library/${t.id}`} className="rec-card">
                  <span aria-hidden="true" className="rec-card__band" style={{ background: tintFor(t.id) }}>
                    <Gift size={46} weight="duotone" />
                  </span>
                  <span className="rec-card__body">
                    <span className="eyebrow text-muted">Toy in the library</span>
                    <span className="text-[17px] font-extrabold leading-[1.3] text-ink">{t.name}</span>
                    {t.description && (
                      <span className="line-clamp-2 text-[13px] leading-[1.45] text-muted">{t.description}</span>
                    )}
                    <span className="mt-auto pt-2 text-[13px] font-extrabold text-brand-deep">
                      {gradeOf(t.condition).label}
                    </span>
                  </span>
                </BoundaryLink>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-[22px] shadow-[var(--shadow-e3),var(--shadow-hi)]">
          {/* The board's first figure is distance; nothing here knows where
              either party is, so the second slot says how fresh the listing is. */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-[var(--radius-field)] px-2.5 py-3" style={{ background: grade.tint }}>
              <p className="m-0 font-display text-xl font-extrabold text-ink">{grade.label}</p>
              <p className="m-0 text-xs font-bold text-ink">condition</p>
            </div>
            <div className="rounded-[var(--radius-field)] bg-sunken px-2.5 py-3">
              <p className="m-0 font-display text-xl font-extrabold text-ink">{agoInWords(toy.created_at)}</p>
              <p className="m-0 text-xs font-bold text-muted">listed</p>
            </div>
          </div>
          {offer && holder && (
            <div className="flex items-start gap-3 rounded-[var(--radius-inset)] px-4 py-3.5 text-ink" style={{ background: offer.tint }}>
              <offer.Icon size={24} weight="duotone" className="flex-none" aria-hidden="true" />
              <p className="m-0 text-sm leading-[1.5]">
                <strong>{offer.label}.</strong> {offer.note(holder)}
              </p>
            </div>
          )}
          {/* The inline control is the entry to /request, not the request
              itself: asking has three parts — how, what you offer, and a
              paragraph about a child — and the board draws that on its own
              screen. */}
          <ToyTransactionRequest toy={toy} viewerId={caps?.profile.id ?? null} myToys={myToys} />
          {saved && (
            <div className="rail-actions">
              <SaveButton slug="toys" id={toy.id} saved={saved.toys.includes(toy.id)} signedIn withLabel />
            </div>
          )}
        </div>

        {holder && (
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-[18px]">
            <span aria-hidden="true" className="byline-avatar !ml-0 !h-11 !w-11 !border-0 !text-[15px]">
              {initials(holder)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[15px] font-extrabold text-ink">{holder}</p>
              <p className="m-0 mt-0.5 text-[13px] text-muted">
                {sameHolder.length > 0 &&
                  `${sameHolder.length} toy${sameHolder.length === 1 ? '' : 's'} listed · `}
                {toy.owner_org_id ? 'an organisation' : 'a family'}
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
