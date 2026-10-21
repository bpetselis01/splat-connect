'use client'
/**
 * "Join online" for a registrant of an online event. The link is never in the
 * public event payload (packages/api/src/routes/public.ts); this asks the
 * authenticated route, which answers only a registrant. Draws nothing on a
 * refusal, so a stale "going" never shows a dead button.
 */
import { useEffect, useState } from 'react'
import { VideoCamera } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function EventJoiningLink({ eventId }: { eventId: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    browserApiClient
      .get<{ online_url: string }>(`/api/events/${eventId}/joining-link`)
      .then((r) => setUrl(/^https?:\/\//i.test(r.online_url) ? r.online_url : null))
      .catch(() => setUrl(null))
  }, [eventId])

  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary min-h-[52px] px-[18px]">
      <VideoCamera weight="bold" aria-hidden="true" />
      Join online
    </a>
  )
}
