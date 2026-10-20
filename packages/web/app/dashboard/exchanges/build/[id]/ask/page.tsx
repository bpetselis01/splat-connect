/**
 * Ask first (makers-ask-first): GET /api/toy-transactions/:id/questions, then
 * the client thread. A 404 from the API (a stranger to a claimed build) is a
 * page-level not found.
 */
import { notFound } from 'next/navigation'
import type { BuildQuestions } from '@splat-connect/types'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BuildQuestionsThread } from '@/components/build-questions'

export default async function AskFirstPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ maker?: string }>
}) {
  const caps = await requireCapabilities()
  const { id } = await params
  const { maker } = await searchParams
  const data = await apiClient.get<BuildQuestions>(`/api/toy-transactions/${id}/questions`).catch(() => null)
  if (!data) notFound()
  return (
    <div className="max-w-[760px]">
      <BuildQuestionsThread data={data} viewerId={caps.profile.id} makerId={maker ?? null} isAdmin={caps.isAdmin} />
    </div>
  )
}
