/**
 * Was an "Events" placeholder. Events live at /get-involved/events since 061 —
 * an event is something you turn up to rather than something already achieved.
 * A redirect rather than a deletion, for the same reason as /impact/news.
 */
import { permanentRedirect } from 'next/navigation'

export default function ImpactEventsPage() {
  permanentRedirect('/get-involved/events')
}
