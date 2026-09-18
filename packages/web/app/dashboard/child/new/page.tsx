import { requireCapabilities } from '@/lib/require-capabilities'
import { ChildEditor } from '@/components/child-editor'

export default async function NewChildPage() {
  const caps = await requireCapabilities()

  return (
    <div>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Everything is optional and only you can see it.
      </p>
      <ChildEditor child={null} />
    </div>
  )
}
