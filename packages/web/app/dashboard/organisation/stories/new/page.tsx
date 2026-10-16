/**
 * Publish a story. The leader check, and the form.
 */
import { notFound } from 'next/navigation'
import { actingOrg } from '@/lib/acting-org'
import { getCapabilities } from '@/lib/capabilities'
import { StoryForm } from '@/components/story-form'

export const metadata = { title: 'Publish a story — SPLAT Connect' }

export default async function PublishStoryPage() {
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = await actingOrg(caps)

  return (
    <div className="max-w-[760px]">
      <h1 className="title-hub">Publish a story</h1>
      <p className="dash-head__lede dash-head__lede--lg">
        One thing that happened, told plainly. The best ones are short, name the toy, and let the
        family speak in their own words.
      </p>
      <StoryForm orgId={org.id} orgName={org.name} />
    </div>
  )
}
