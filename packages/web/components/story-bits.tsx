/**
 * The pieces every story surface shares — /about/stories, a story page, and
 * the featured story on /impact: each kind's tint and glyph, and the photo
 * slot that falls back to them.
 */
import Image from 'next/image'
import { Buildings, Heart, Megaphone, Wrench } from '@phosphor-icons/react/dist/ssr'
import { STORY_KIND_LABEL, type StoryKind } from '@splat-connect/types'
import { safePhotoSrc } from '@/lib/photo-src'

export const STORY_KIND_STYLE: Record<StoryKind, { tint: string; icon: typeof Heart }> = {
  family: { tint: 'var(--tcoral)', icon: Heart },
  maker: { tint: 'var(--tamber)', icon: Wrench },
  org_update: { tint: 'var(--tviolet)', icon: Buildings },
  announcement: { tint: 'var(--b100)', icon: Megaphone },
}

/** Fills its (positioned) parent: the story's first photo, else its kind's tint. */
export function StoryPhoto({
  kind,
  photos,
  iconSize = 48,
}: {
  kind: StoryKind
  photos?: string[] | null
  iconSize?: number
}) {
  const src = safePhotoSrc(photos?.[0] ?? null)
  const { tint, icon: Glyph } = STORY_KIND_STYLE[kind]
  return src ? (
    <Image src={src} alt="" fill className="object-cover" />
  ) : (
    <span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center"
      style={{ background: tint, color: 'var(--tink)' }}
    >
      <Glyph size={iconSize} weight="duotone" opacity={0.7} />
    </span>
  )
}

export function StoryKindPill({ kind, className = '' }: { kind: StoryKind; className?: string }) {
  return (
    <span
      className={`inline-block self-start rounded-pill px-2.5 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--tink)] ${className}`}
      style={{ background: STORY_KIND_STYLE[kind].tint }}
    >
      {STORY_KIND_LABEL[kind]}
    </span>
  )
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
