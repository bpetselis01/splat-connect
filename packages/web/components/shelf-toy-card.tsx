/**
 * The board's small toy tile on a profile page — an organisation's shelf, a
 * contributor's toys: a 92px photo band, the name, the offer and the grade.
 * The browse card (toy-library-card.tsx) is the big one on /toy-library.
 */
import Image from 'next/image'
import Link from 'next/link'
import type { Toy } from '@splat-connect/types'
import { GRADE_ICON, OFFER } from '@/components/toy-library-card'
import { tintFor } from '@/components/card-photo'
import { gradeOf } from '@/lib/toy-grade'
import { safePhotoSrc } from '@/lib/photo-src'

export function ShelfToyCard({ toy }: { toy: Toy }) {
  const photo = safePhotoSrc(toy.cover_photo_url)
  const grade = gradeOf(toy.condition)
  const GradeIcon = GRADE_ICON[grade.key]
  return (
    <Link
      href={`/toy-library/${toy.id}`}
      className="overflow-hidden rounded-[var(--radius-inset)] border border-line bg-surface text-ink hover:shadow-[var(--shadow-e2)]"
      style={{ boxShadow: 'var(--shadow-e1)' }}
    >
      <span className="relative block h-[92px]" style={{ background: tintFor(toy.id) }}>
        {photo && <Image src={photo} alt="" fill className="object-cover" />}
      </span>
      <span className="block px-3.5 pb-3.5 pt-3">
        <span className="block text-sm font-extrabold">{toy.name}</span>
        <span className="mt-[5px] flex items-center gap-1.5 text-xs text-muted">
          {toy.offer_type && OFFER[toy.offer_type].label}
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-[9px] py-[3px] text-xs font-extrabold text-[var(--tink)]"
            style={{ background: grade.tint }}
          >
            <GradeIcon weight="bold" aria-hidden="true" />
            {grade.label}
          </span>
        </span>
      </span>
    </Link>
  )
}
