'use client'
// next/dynamic with ssr: false is only allowed in a client component; the
// /impact/map page is a server component, so this is the seam (and the one
// the page test mocks, since jsdom cannot run Leaflet).
import dynamic from 'next/dynamic'
import type { ImpactMapSuburb } from '@splat-connect/types'

const DeliveriesMap = dynamic(() => import('@/components/deliveries-map'), {
  ssr: false,
  loading: () => <div className="h-[480px] w-full rounded-card border border-line bg-sunken max-sm:h-[360px]" />,
})

export function DeliveriesMapLoader({ suburbs }: { suburbs: ImpactMapSuburb[] }) {
  return <DeliveriesMap suburbs={suburbs} />
}
