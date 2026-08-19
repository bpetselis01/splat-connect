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
type ImpactCardProps =
  | { kind: 'person'; entity: ImpactEntity }
  | { kind: 'org'; entity: ImpactOrgEntity }

export function ImpactCard({ kind, entity }: ImpactCardProps) {
  // Cast: /contributors/[id] and /organizations/[id]/public are built by
  // sibling tasks in this feature, so typedRoutes doesn't know them yet.
  const href = (
    kind === 'person' ? `/contributors/${entity.id}` : `/organizations/${entity.id}/public`
  ) as Route<string>

  return (
    <Link href={href} data-testid="impact-card" className="card-playroom card-link block p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink">{entity.name}</p>
        <span
          className={`badge shrink-0 ${
            kind === 'person' ? 'bg-brand-tint text-brand-deep' : 'bg-mint-soft text-mint-deep'
          }`}
        >
          {kind === 'person' ? 'Person' : 'Organisation'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-muted">Tutorials</dt>
          <dd className="text-lg font-bold text-ink">{entity.tutorials}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Toys shared</dt>
          <dd className="text-lg font-bold text-ink">{entity.toysShared}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Toys delivered</dt>
          <dd className="text-lg font-bold text-ink">{entity.toysDelivered}</dd>
        </div>
      </dl>
      {kind === 'org' && (
        <p className="mt-2 text-xs text-muted">{entity.projectsBacked} projects backed</p>
      )}
    </Link>
  )
}
