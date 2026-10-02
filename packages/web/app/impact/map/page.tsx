/**
 * The deliveries map (impact-map) — story s4 made real: completed handoffs by
 * suburb, never at address level, never for fewer than three in a suburb.
 * The rule lives in impact_map() (121); this page shows what it returns, a
 * circle per suburb and the same suburbs as a list a screen reader can read.
 */
import type { ImpactMapSuburb } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { DeliveriesMapLoader } from '@/components/deliveries-map-loader'

export const metadata = { title: 'Deliveries map — SPLAT Connect' }

export default async function MapPage() {
  const suburbs = await apiClient.get<ImpactMapSuburb[]>('/api/public/impact/map').catch(() => null)

  return (
    <div className="max-w-[1000px]">
      <h1 className="title-hub">Deliveries map</h1>
      <p className="mt-2.5 max-w-[62ch] text-[17px] leading-[1.55] text-muted">Where adapted toys have actually landed.</p>
      <p className="mt-2 max-w-[62ch] text-sm leading-normal text-muted">
        The map shows completed handoffs at suburb level, never at address level, and never for fewer than three
        deliveries in a suburb. It does not show individual families.
      </p>

      <div className="mt-6">
        {suburbs === null ? (
          <p role="alert" className="alert alert-danger">
            The map could not load. Try again soon.
          </p>
        ) : suburbs.length === 0 ? (
          <p className="font-bold text-ink">No suburb has three deliveries yet.</p>
        ) : (
          <>
            <DeliveriesMapLoader suburbs={suburbs} />
            <ul className="mt-5 grid list-none gap-2 p-0 sm:grid-cols-2">
              {suburbs.map((s) => (
                <li key={`${s.suburb}|${s.state}`} className="text-[15px] font-semibold text-ink">
                  {`${s.suburb}, ${s.state} · ${s.deliveries} deliveries`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
