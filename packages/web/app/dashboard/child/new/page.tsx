import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { ChildEditor } from '@/components/child-editor'

export default async function NewChildPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <Link href="/dashboard/child" className="mb-4 inline-block text-sm text-muted">
        ← Child profiles
      </Link>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Everything is optional and only you can see it.
      </p>
      <ChildEditor child={null} />
    </div>
  )
}
