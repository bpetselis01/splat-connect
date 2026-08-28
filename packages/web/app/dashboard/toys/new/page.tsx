import { BackLink } from '@/components/back-link'
import { redirect } from 'next/navigation'
import { getCapabilities } from '@/lib/capabilities'
import { NewToyForm } from '@/components/new-toy-form'
import { ToyEditStepper } from '@/components/toy-edit-stepper'

export default async function NewToyPage() {
  const caps = await getCapabilities()
  if (!caps) redirect('/login')

  return (
    <div>
      <BackLink href="/dashboard/toys" label="My toys" />
      <h1 className="mb-2 text-2xl font-bold text-ink">Add a toy</h1>
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-muted">
        Add the basics now — photos and switch details come next.
      </p>
      {/* Same stepper as the edit page so the journey is visible from the
          start. Photos and Review stay locked until the toy exists: both need
          an id to upload against, and the review reads saved fields. */}
      <ToyEditStepper
        steps={[
          {
            id: 'details',
            label: 'Details',
            status: 'attention',
            content: (
              <div className="panel pt-5">
                <div className="px-5 pb-5">
                  <NewToyForm ledOrgs={caps.ledOrgs} />
                </div>
              </div>
            ),
          },
          {
            id: 'photos',
            label: 'Photos',
            status: 'neutral',
            disabled: true,
            content: null,
          },
          {
            id: 'review',
            label: 'Review',
            status: 'neutral',
            disabled: true,
            content: null,
          },
        ]}
      />
    </div>
  )
}
