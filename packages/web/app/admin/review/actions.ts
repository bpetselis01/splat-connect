'use server'
/**
 * Approve and send back, shared by the review queue's side pane and the full
 * review page (/admin/review/[id]) — the same two PATCHes either way, so one
 * copy. Unpublish stays on the full page: it is not a queue decision.
 */
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'

export async function approveTutorial(id: string) {
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, { status: 'approved' })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
  revalidatePath('/library')
}

export async function rejectTutorial(formData: FormData) {
  const id = formData.get('id') as string
  const note = formData.get('note') as string
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
    status: 'rejected',
    rejection_note: note || null,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
}
