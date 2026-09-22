import { requireCapabilities } from '@/lib/require-capabilities'
import { ChildEditor } from '@/components/child-editor'

export default async function NewChildPage() {
  await requireCapabilities()

  return <ChildEditor child={null} />
}
