import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { NewChildForm } from '@/components/new-child-form'

export default async function NewChildPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-ink">Add child</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Everything is optional and only you can see it.
      </p>
      <NewChildForm />
    </div>
  )
}
