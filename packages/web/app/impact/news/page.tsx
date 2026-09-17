/**
 * Was a "News and stories" placeholder. Stories live at /about/stories since
 * 062, so this is a redirect rather than a deletion: the placeholder was linked
 * from the footer and the Impact hub for weeks, and somebody has the URL.
 */
import { permanentRedirect } from 'next/navigation'

export default function ImpactNewsPage() {
  permanentRedirect('/about/stories')
}
