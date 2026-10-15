/**
 * Thank-you notes: what people wrote when they thanked you (117). Private to
 * you, shown nowhere else; Hide just clears one off this list.
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { PersonThanksNotes } from '@/components/person-thanks-notes'
import type { PersonThanks } from '@splat-connect/types'

export const metadata = { title: 'Thank-you notes — SPLAT Connect' }

export default async function ThanksNotesPage() {
  await requireCapabilities()
  const thanks = await apiClient.get<PersonThanks[]>('/api/contributors/me/thanks')

  return (
    <div className="max-w-[860px]">
      <h1 className="title-hub">Thank-you notes</h1>
      <p className="dash-head__lede dash-head__lede--lg max-w-[62ch]">
        Notes people left when they thanked you. Only you can see them.
      </p>
      <div className="mt-5">
        <PersonThanksNotes thanks={thanks} />
      </div>
    </div>
  )
}
