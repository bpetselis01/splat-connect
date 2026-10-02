'use client'
/**
 * Invitations to lead an organisation, on the invitee's Account page. 084
 * makes leadership an invitation because leaders are public on the
 * organisation's page; this is where the invitee says yes or no.
 */
import { useCallback, useEffect, useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'

type Invite = { id: string; org_id: string; org_name: string }

export function OrgInvites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const load = useCallback(() => {
    browserApiClient.get<Invite[]>('/api/organizations/invites/mine').then(setInvites).catch(() => setInvites([]))
  }, [])
  useEffect(load, [load])

  async function answer(invite: Invite, accept: boolean) {
    try {
      if (accept) await browserApiClient.post(`/api/organizations/invites/${invite.id}/accept`, {})
      else await browserApiClient.delete(`/api/organizations/invites/${invite.id}`)
    } finally {
      // A hard load: the header and dashboard read what the account leads server-side.
      if (accept) window.location.reload()
      else load()
    }
  }

  if (!invites.length) return null
  return (
    <div className="mb-8 flex flex-col gap-3">
      {invites.map((i) => (
        <div key={i.id} className="rounded-[18px] border border-line bg-surface p-5 shadow-e1">
          <p className="text-[15px] text-ink">
            <strong>{i.org_name}</strong> invited you to be one of its leaders. Leaders are shown on the
            organisation&apos;s public page.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => answer(i, true)} className="btn btn-accent">Accept</button>
            <button type="button" onClick={() => answer(i, false)} className="btn btn-quiet">Decline</button>
          </div>
        </div>
      ))}
    </div>
  )
}
