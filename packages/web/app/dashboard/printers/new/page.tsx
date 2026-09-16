import { requireCapabilities } from '@/lib/require-capabilities'
import { BackLink } from '@/components/back-link'
import { PrinterForm } from '@/components/printer-form'

export const metadata = { title: 'Add a printer — SPLAT Connect' }

export default async function AddPrinterPage() {
  const caps = await requireCapabilities()

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/dashboard/printers" label="Print for others" />
      <h1 className="mt-2 title-detail">Add a printer</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
        Bed size and materials decide which requests you are offered.
      </p>

      <PrinterForm ledOrgs={caps.ledOrgs.map((org) => ({ id: org.id, name: org.name }))} />
    </div>
  )
}
