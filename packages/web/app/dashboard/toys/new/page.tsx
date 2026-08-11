import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { NewToyForm } from '@/components/new-toy-form'

export default async function NewToyPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <Link href="/dashboard/toys" className="mb-4 inline-block text-sm text-muted">
        ← My toys
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-ink">Add a toy</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Add the basics now — photos and switch details come next.
      </p>
      <NewToyForm />
    </div>
  )
}
