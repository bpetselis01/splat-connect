/**
 * Publish a story. The leader check, and the form.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'
import { StoryForm } from '@/components/story-form'

export const metadata = { title: 'Publish a story — SPLAT Connect' }

export default async function PublishStoryPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  return (
    <div className="max-w-[760px]">
      <nav aria-label="Back to the list" className="form-trail">
        <Link href="/dashboard/organisation/publish">Events and stories</Link>
        <CaretRight weight="bold" aria-hidden="true" className="text-xs" />
        <span>New story</span>
      </nav>
      <h1 className="title-hub">Publish a story</h1>
      <p className="dash-head__lede dash-head__lede--lg">
        One thing that happened, told plainly. The best ones are short, name the toy, and let the
        family speak in their own words.
      </p>
      <StoryForm orgId={org.id} orgName={org.name} />
    </div>
  )
}
