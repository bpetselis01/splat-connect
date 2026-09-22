import { requireCapabilities } from '@/lib/require-capabilities'
import { NewToyForm } from '@/components/new-toy-form'

export const metadata = { title: 'Add a toy — SPLAT Connect' }

/** The board's single card; the listing editor carries everything after it. */
export default async function NewToyPage() {
  const caps = await requireCapabilities()

  return (
    <div className="max-w-[720px]">
      <h1 className="title-hub">Add a toy</h1>
      <p className="mt-2.5 max-w-[60ch] text-[17px] text-muted">
        Two things to start: what it is, and one photo. Notes and handover can wait for the
        listing editor.
      </p>
      <div className="mt-7">
        <NewToyForm ledOrgs={caps.ledOrgs} />
      </div>
    </div>
  )
}
