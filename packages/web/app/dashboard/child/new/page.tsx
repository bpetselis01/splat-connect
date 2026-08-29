import { BackLink } from '@/components/back-link'
import { requireCapabilities } from '@/lib/require-capabilities'
import { ChildEditor } from '@/components/child-editor'

export default async function NewChildPage() {
  const caps = await requireCapabilities()

  return (
    <div>
      <BackLink href="/dashboard/profile" label="Account" />
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Everything is optional and only you can see it.
      </p>
      <ChildEditor child={null} />
    </div>
  )
}
