import { notFound } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { requireCapabilities } from '@/lib/require-capabilities'
import { ToyEditor } from '@/components/toy-editor'
import type { Toy } from '@splat-connect/types'

export default async function ToyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireCapabilities()

  // Reads the collection rather than one row, same reasoning as
  // EditChildPage: RLS scopes it to the caller, so a toy missing from it is
  // either gone or someone else's — 404 either way, never 403.
  const [toys, guides] = await Promise.all([
    apiClient.get<Toy[]>('/api/toys'),
    // For "Built from a guide?": the public list is exactly the approved
    // guides. A failure only empties the picker.
    fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ id: string; title: string }[]>) : []))
      .catch(() => []),
  ])
  const toy = toys.find((t) => t.id === id)
  if (!toy) notFound()

  return (
    // The editor draws its own header: the stage pill and title change the
    // moment the toy is listed, and only the client side knows when that is.
    <ToyEditor toy={toy} guides={guides.map((g) => ({ id: g.id, title: g.title }))} />
  )
}
