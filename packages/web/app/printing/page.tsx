/**
 * The 3D Printing pillar hub.
 *
 * This section is mostly unbuilt, but it is one of the three things SPLAT
 * provides — so it gets a real page rather than a placeholder. The e2e suite
 * enforces that: a top-level link may never render "Not built yet", because
 * eleven scaffolds hanging off the top bar teach a visitor the site is empty.
 *
 * What makes that honest rather than a dodge is that the useful part of this
 * offer needs no software at all. You do not have to own a printer, and the
 * route to getting a part today — ask a library, a makerspace, a men's shed —
 * already works. The page leads with that, and marks the software as coming.
 */
import Link from 'next/link'
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'
import { EditorialImage } from '@/components/editorial-image'

export const metadata = {
  title: '3D Printing — SPLAT Connect',
  description:
    'Printed switch mounts, cases and battery interrupters — how to get one made, with or without a printer.',
}

export default function PrintingPage() {
  const printing = PUBLIC_NAV.find((s) => s.href === '/printing')!

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">3D Printing</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        A lot of what makes a toy usable is not the toy. It is the bracket that holds a
        switch at the angle a child can actually reach, the case that stops a battery
        interrupter being pulled apart, the mount that clamps to a wheelchair tray. Those
        parts are printed, and most of them are small enough to be printed by someone who
        already owns a printer and would rather use it for this.
      </p>

      <div className="mt-8 max-w-3xl">
        <EditorialImage illustration="printer" ratio="2/1" />
      </div>

      <h2 className="mt-10 text-lg font-bold text-ink">You do not need a printer</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm leading-relaxed text-muted">
        This is the part that already works, today, with no software from us. Ask a
        library, a makerspace, a men&apos;s shed, a school or a university — many have
        printers sitting idle and staff who would rather they made something like this
        than another keyring. Some SPLAT{' '}
        <Link href="/organizations" className="font-semibold text-brand-dark hover:underline">
          organisations
        </Link>{' '}
        keep printers specifically for assistive parts. Hand over the STL file from a
        guide and the settings from{' '}
        <Link href="/printing/basics" className="font-semibold text-brand-dark hover:underline">
          Printing basics
        </Link>
        ; that is everything a printer operator needs.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">In this section</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Some of this is not built yet. Where it isn&apos;t, you can ask to be told when
        it is.
      </p>
      <HubGrid items={printing.children} />
    </div>
  )
}
