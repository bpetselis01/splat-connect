import Link from 'next/link'
import type { Route } from 'next'
import type { ImpactEntity, ImpactOrgEntity } from '@splat-connect/types'

/**
 * One contributor or organisation on the public impact wall.
 *
 * A person and an org share the same three counts, but only an org carries
 * `projectsBacked` — the discriminated `kind` prop picks the link target and
 * whether that fourth count renders, rather than sniffing the entity shape.
 */
type ImpactCardProps = (
  | { kind: 'person'; entity: ImpactEntity }
  | { kind: 'org'; entity: ImpactOrgEntity }
) & { /** Picks the avatar tint, so neighbours differ. */ index?: number }

const TINTS = ['var(--b100)', 'var(--tmint)', 'var(--tcoral)', 'var(--tviolet)', 'var(--tamber)', 'var(--tok)']

export function ImpactCard({ kind, entity, index = 0 }: ImpactCardProps) {
  // Cast: /contributors/[id] and /organizations/[id]/public are built by
  // sibling tasks in this feature, so typedRoutes doesn't know them yet.
  const href = (
    kind === 'person' ? `/contributors/${entity.id}` : `/organizations/${entity.id}/public`
  ) as Route<string>
  const tint = TINTS[index % TINTS.length]
  // The board's one line of counts: what a person wrote, or what an org
  // backed, then what reached a family.
  const meta =
    kind === 'person'
      ? `${entity.tutorials} ${entity.tutorials === 1 ? 'guide' : 'guides'} · ${entity.toysDelivered} delivered`
      : `${entity.projectsBacked} backed · ${entity.toysDelivered} delivered`

  return (
    <Link
      href={href}
      data-testid="impact-card"
      className="card card-link flex items-center gap-3.5 p-5 text-ink"
      style={{ boxShadow: 'var(--shadow-e1), var(--shadow-hi)' }}
    >
      <span
        aria-hidden="true"
        className={`grid h-[52px] w-[52px] shrink-0 place-items-center text-[17px] font-extrabold text-[var(--tink)] ${
          kind === 'person' ? 'rounded-full' : 'rounded-[var(--radius-inset)]'
        }`}
        style={{ background: tint }}
      >
        {entity.name
          .split(/\s+/)
          .map((w) => w[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[17px] font-extrabold">{entity.name}</span>
        <span className="block text-[13px] font-semibold text-muted">{meta}</span>
        <span
          className="mt-1.5 inline-block rounded-pill px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--tink)]"
          style={{ background: tint }}
        >
          {kind === 'person' ? 'Person' : 'Organisation'}
        </span>
      </span>
    </Link>
  )
}
