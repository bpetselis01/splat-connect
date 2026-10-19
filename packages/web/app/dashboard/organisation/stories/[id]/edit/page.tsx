/**
 * Edit a story already saved, draft or published, in the form it was written in.
 */
import { notFound } from 'next/navigation'
import { actingOrg } from '@/lib/acting-org'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { StoryForm } from '@/components/story-form'
import type { OrgStory } from '@splat-connect/types'

export const metadata = { title: 'Edit a story — SPLAT Connect' }

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caps = await getCapabilities()
  if (!caps || caps.ledOrgs.length === 0) notFound()
  const org = await actingOrg(caps)

  const stories = await apiClient
    .get<OrgStory[]>(`/api/organizations/${org.id}/stories`)
    .catch(() => [] as OrgStory[])
  const story = stories.find((s) => s.id === id)
  if (!story) notFound()

  return (
    <div className="max-w-[760px]">
      <h1 className="title-hub">Edit a story</h1>
      <p className="dash-head__lede dash-head__lede--lg">
        Confirm consent again before saving: it covers everyone the story names now.
      </p>
      <StoryForm orgId={org.id} orgName={org.name} story={story} />
    </div>
  )
}
