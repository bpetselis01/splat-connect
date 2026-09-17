/**
 * Publish a story. The leader check, and the form.
 */
import { notFound } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { StoryForm } from '@/components/story-form'

export const metadata = { title: 'Publish a story — SPLAT Connect' }

export default async function PublishStoryPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = caps.ledOrgs[0]

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="title-article">Publish a story</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        One thing that happened, told plainly. The best ones are short, name the toy, and let the
        family speak in their own words.
      </p>
      <StoryForm orgId={org.id} orgName={org.name} />
    </div>
  )
}
