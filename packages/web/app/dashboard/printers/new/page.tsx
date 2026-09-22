import { requireCapabilities } from '@/lib/require-capabilities'
import { PrinterForm } from '@/components/printer-form'

export const metadata = { title: 'Add a printer — SPLAT Connect' }

export default async function AddPrinterPage() {
  const caps = await requireCapabilities()

  return (
    <div className="max-w-[760px]">
      <h1 className="title-hub">Add a printer</h1>
      <p className="mb-[26px] mt-2 max-w-[58ch] text-base leading-[1.55] text-muted">
        Bed size and materials decide which requests you are offered, so a family never asks for
        something you cannot make. Everything else you can change later.
      </p>

      <PrinterForm
        ledOrgs={caps.ledOrgs.map((org) => ({ id: org.id, name: org.name }))}
        defaultSuburb={caps.profile.pickup_suburb ?? ''}
        defaultState={caps.profile.pickup_state ?? ''}
      />
    </div>
  )
}
