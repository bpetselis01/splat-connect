import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { requireCapabilities } from '@/lib/require-capabilities'
import { revalidatePath } from 'next/cache'
import { Suspense } from 'react'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { StlSettingsForm, type StlSettings } from '@/components/stl-settings-form'
import { EditItemsSection, type ItemInput } from '@/components/edit-items-section'
import { EditBackingSection } from '@/components/edit-backing-section'
import { EditDetailsSection } from '@/components/edit-details-section'
import { EditStepsSection, type StepInput } from '@/components/edit-steps-section'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { EditRecommendationsSection } from '@/components/edit-recommendations-section'
import { Stepper } from '@/components/stepper'
import { CreatedToast } from '@/components/created-toast'
import { PdfImportBanner } from '@/components/pdf-import-banner'
import { ToastProvider } from '@/components/toast'
import { computeStepStatuses, stepsFor, type EditStep, type EditStepId } from '@/lib/edit-steps'
import type { Step } from '@/lib/steps'
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowBendDownRight,
  ArrowSquareOut,
  Cube,
  Eye,
  FileArrowDown,
  FlagBanner,
  FloppyDisk,
  Info,
  ListNumbers,
  Nut,
  PaperPlaneTilt,
  Plus,
  SealCheck,
  ChatTeardropText,
  UsersThree,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import {
  EditorChecklist,
  EditorHeader,
  EditorHistory,
  StatusCard,
  SubmitButton,
  type HistoryRow,
} from '@/components/editor-status'
import { TUTORIAL_STAGE } from '@/components/dashboard-tutorial-card'
import { formatRelativeTime } from '@/lib/relative-time'
import { TutorialView } from '@/components/tutorial-view'
import { getMissingFields } from '@/lib/validation'
import { DeleteEntityButton } from '@/components/delete-entity-button'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, TutorialKind, BuyLink, TutorialOrg, Organization, TutorialMaturity, TutorialStep, PressForce, Hold } from '@splat-connect/types'

/**
 * The body both file-saving actions share. A plain function at module scope,
 * NOT a third 'use server' action, and that distinction is the whole point.
 *
 * Next lifts every inline action out of the component to module scope. One
 * that closes over a variable — `id`, here — cannot be lifted cleanly, so it
 * compiles to `var patchFiles = $$RSC_SERVER_ACTION_7.bind(null, <encrypted
 * id>)` *inside the component body*, created while rendering. The two actions
 * that called it were lifted out and kept referring to that name, which does
 * not exist when an action is POSTed on its own: the component never ran.
 * Every guide photo add answered "patchFiles is not defined" and the upload,
 * already in storage by then, was never recorded.
 *
 * Taking `id` as an argument is what removes the closure and with it the bind.
 * Ordinary server code called from inside an action needs no marker of its own.
 * Same family as the wrapped-saveParts bug below: an inline action survives
 * being *called by* an action, never being wrapped or captured by one.
 */
async function patchTutorialFiles(id: string, updates: Record<string, unknown>) {
  // Read first for updated_at: the tutorials PATCH takes it as an optimistic
  // lock, so a save built on a stale copy is refused rather than silently
  // overwriting a collaborator.
  const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
  if (current.status === 'approved' || current.status === 'rejected') {
    updates.status = 'pending'
  }
  await apiClient.patch(`/api/tutorials/${id}`, { ...updates, updated_at: current.updated_at })
  revalidatePath(`/tutorials/${id}/edit`)
}

export default async function EditTutorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ preview?: string }>
}) {
  const { id } = await params
  const preview = (await searchParams)?.preview === '1'

  const { profile } = await requireCapabilities()

  let tutorial: TutorialWithDetails
  try {
    tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
  } catch {
    redirect('/dashboard')
  }

  const isContributor = tutorial.tutorial_contributors.some(
    (tc) => tc.profile_id === profile.id
  )
  if (!isContributor) redirect('/dashboard')

  const parts = tutorial.parts as Part[]
  const tools = tutorial.tools as Tool[]
  const stlFiles = tutorial.stl_files as StlFile[]

  // Backing rows and the organisation list for the picker. Both tolerate failure:
  // a backing panel that cannot load is a worse reason to 500 the whole edit page
  // than it is to render empty.
  // The recommendation picker's choices ride along on the same terms: approved
  // tutorials from the public list, which is already exactly the set a parent
  // could follow a recommendation to.
  const [backing, organizations, candidates] = await Promise.all([
    apiClient.get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`).catch(() => [] as TutorialOrg[]),
    apiClient.get<Organization[]>('/api/organizations').catch(() => [] as Organization[]),
    apiClient.get<Tutorial[]>('/api/public/tutorials').catch(() => [] as Tutorial[]),
  ])

  async function askOrg(orgId: string) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/orgs`, { org_id: orgId })
    revalidatePath(`/tutorials/${id}/edit`)
    revalidatePath('/dashboard')
  }

  async function withdrawOrg(orgId: string) {
    'use server'
    await apiClient.delete(`/api/tutorials/${id}/orgs/${orgId}`)
    revalidatePath(`/tutorials/${id}/edit`)
    revalidatePath('/dashboard')
  }

  async function saveDetails(patch: { title: string; description: string | null; difficulty: Difficulty; build_minutes: number | null; age_min: number | null; age_max: number | null; kind: TutorialKind; maturity: TutorialMaturity; switch_target: 'large' | 'small' | null; switch_force: PressForce | null; switch_hold: Hold | null; safety_declared?: true; updated_at: string }) {
    'use server'
    const body: Record<string, unknown> = { ...patch }
    if (tutorial.status === 'approved' || tutorial.status === 'rejected') {
      body.status = 'pending'
    }
    await apiClient.patch(`/api/tutorials/${id}`, body)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function inviteCollaborator(emailAddr: string) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/collaborators/invite`, { email: emailAddr })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function removeCollaborator(profileId: string) {
    'use server'
    await apiClient.delete(`/api/tutorials/${id}/collaborators/${profileId}`)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  // Receives only string URLs (no file bytes) — no Server Action body size limit risk.
  // File bytes are uploaded directly browser -> Hono API by EditFilesSection.
  async function patchFileUrls(pdfUrl: string | null) {
    'use server'
    return patchTutorialFiles(id, { tutorial_pdf_url: pdfUrl })
  }

  // Photos save one at a time as they are added or removed, so they get their
  // own action rather than riding along with the PDF's Save button.
  async function patchPhotoUrls(photoUrls: string[]) {
    'use server'
    return patchTutorialFiles(id, { photo_urls: photoUrls })
  }

  // Takes ItemInput, the exact type EditItemsSection emits, so it can be handed
  // over as-is.
  //
  // WHY: it previously required `quantity: number` while ItemInput declares it
  //      optional, so the call site wrapped this in `(items) => saveParts(items
  //      as ...)`. That arrow is an ordinary function, not a server action —
  //      React rejects it with "Event handlers cannot be passed to Client
  //      Component props" and the whole edit page 500s. Tools was unaffected
  //      only because its types lined up and it needed no wrapper.
  // HOW: widening the parameter removes the reason for the wrapper, and the
  //      default below states the guarantee EditItemsSection already makes at
  //      runtime (it always sets quantity when withQuantity is on) instead of
  //      casting it away.
  async function saveParts(newParts: ItemInput[]) {
    'use server'
    const parts = newParts.map((p) => ({ ...p, quantity: p.quantity ?? 1 }))
    await apiClient.post(`/api/tutorials/${id}/parts`, { parts })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveSteps(steps: StepInput[]) {
    'use server'
    await apiClient.put(`/api/tutorials/${id}/steps`, { steps })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveTools(newTools: { name: string; is_optional: boolean; buy_links: BuyLink[] }[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/tools`, { tools: newTools })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  // Receives only filename + URL strings — no file bytes, no size limit risk.
  async function addStlFileRecord(filename: string, fileUrl: string) {
    'use server'
    const current = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
    await apiClient.post(`/api/tutorials/${id}/stl-files`, {
      stl_files: [...current.stl_files, { filename, file_url: fileUrl }],
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveStlSettings(fileId: string, settings: StlSettings) {
    'use server'
    await apiClient.patch(`/api/tutorials/${id}/stl-files/${fileId}`, settings)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveRecommendations(recommendedIds: string[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/recommendations`, {
      recommendations: recommendedIds.map((recommended_id) => ({ recommended_id })),
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function submitForReview() {
    'use server'
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    await apiClient.patch(`/api/tutorials/${id}`, { status: 'pending', updated_at: current.updated_at })
    revalidatePath(`/tutorials/${id}/edit`)
  }


  const missing = getMissingFields(tutorial!)
  const stepStatuses = computeStepStatuses(tutorial!, backing)

  // Every step this page knows how to draw. Which of them show, and in what
  // order, is stepsFor()'s answer below — the STL step exists only for an
  // assistive-tech tutorial, and /upload draws its locked preview from the
  // same list so the two never disagree.
  const allSteps: EditStep[] = [
    {
      id: 'details',
      label: 'Details',
      icon: <Info size={19} weight="duotone" aria-hidden="true" />,
      hint: 'What the toy is, how hard it is, how long it takes, and the safety declaration.',
      status: stepStatuses.details,
      content: (
        <div className="panel pt-5">
          <EditDetailsSection tutorial={tutorial!} onSave={saveDetails} />
        </div>
      ),
    },
    {
      id: 'steps',
      label: 'Steps',
      icon: <ListNumbers size={19} weight="duotone" aria-hidden="true" />,
      hint: 'One photo and one instruction per action, in order. Optional — the PDF still carries the guide.',
      status: stepStatuses.steps,
      content: (
        <div className="panel pt-5">
          <EditStepsSection tutorialId={id} steps={tutorial.steps ?? []} onSave={saveSteps} />
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      icon: <FileArrowDown size={19} weight="duotone" aria-hidden="true" />,
      hint: 'The photos a parent sees first, and the guide PDF itself.',
      status: stepStatuses.files,
      content: (
        <div className="panel pt-5">
          <EditFilesSection
            tutorialId={id}
            photoUrls={tutorial.photo_urls}
            currentPdfUrl={tutorial.tutorial_pdf_url}
            onSavePhotos={patchPhotoUrls}
            onSave={patchFileUrls}
          />
        </div>
      ),
    },
    {
      id: 'parts',
      label: 'Parts',
      icon: <Nut size={19} weight="duotone" aria-hidden="true" />,
      hint: 'Everything a family has to buy, and where to buy it.',
      status: stepStatuses.parts,
      content: (
        <div className="panel pt-5">
          {/* Passed directly, never wrapped in an arrow: a server action loses
              its marker the moment it is wrapped, and the page 500s. */}
          <EditItemsSection
            noun="part"
            withQuantity
            initialItems={parts}
            onSave={saveParts}
          />
        </div>
      ),
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench size={19} weight="duotone" aria-hidden="true" />,
      hint: 'What they need on the bench.',
      status: stepStatuses.tools,
      content: (
        <div className="panel pt-5">
          <EditItemsSection noun="tool" initialItems={tools} onSave={saveTools} />
        </div>
      ),
    },
    {
      id: 'stl',
      label: 'STL Files',
      icon: <Cube size={19} weight="duotone" aria-hidden="true" />,
      hint: 'STL models and anything printable.',
      status: stepStatuses.stl,
      content: (
        <div className="panel px-5 pt-5 pb-5">
          {stlFiles.length > 0 && <StlSettingsForm files={stlFiles} onSave={saveStlSettings} />}
          <AddStlForm tutorialId={id} onAdd={addStlFileRecord} />
        </div>
      ),
    },
    {
      id: 'recommended',
      label: 'Worth a look',
      icon: <ArrowBendDownRight size={19} weight="duotone" aria-hidden="true" />,
      hint: 'Up to three guides you point a reader at next.',
      status: stepStatuses.recommended,
      content: (
        <div className="panel pt-5">
          <EditRecommendationsSection
            tutorialId={id}
            recommendations={tutorial.tutorial_recommendations}
            candidates={candidates}
            onSave={saveRecommendations}
          />
        </div>
      ),
    },
    {
      id: 'team',
      label: 'Team',
      icon: <UsersThree size={19} weight="duotone" aria-hidden="true" />,
      hint: 'Co-authors, and the organisations backing this guide.',
      status: stepStatuses.team,
      // Beside the walk, not on it: the pill sits at the right end of the
      // rail in its own colour, nothing offers it as Next, and it carries no
      // finish bar. Review is where a contributor is asked whether they want
      // it. See Step.offWalk.
      offWalk: true,
      content: (
        // Two cards rather than one, because they are two separate asks — you
        // invite a person, you ask an organisation — and the heading each one
        // now carries is the one the pill used to give it.
        <div className="flex flex-col gap-4">
          <div className="panel pt-5">
            <h2 className="px-5 pb-3 text-sm font-bold text-ink">Collaborators</h2>
            <EditCollaboratorsSection
              contributors={tutorial.tutorial_contributors}
              invites={tutorial.tutorial_collaborator_invites ?? []}
              currentProfileId={profile.id}
              isPrimary={tutorial.tutorial_contributors.some(
                (tc) => tc.profile_id === profile.id && tc.role === 'primary'
              )}
              onInvite={inviteCollaborator}
              onRemove={removeCollaborator}
            />
          </div>
          <div className="panel pt-5">
            <h2 className="px-5 pb-3 text-sm font-bold text-ink">Backing</h2>
            <EditBackingSection
              backing={backing}
              organizations={organizations}
              tutorialStatus={tutorial.status}
              reviewedForOrgId={tutorial.reviewed_for_org_id}
              onAsk={askOrg}
              onWithdraw={withdrawOrg}
            />
          </div>
        </div>
      ),
    },
  ]
  /*
   * The board's Status section, first in the rail: where the guide is, what is
   * left, its history, and the one action that moves it on. It replaces the
   * old Review step and the sticky finish bar — both said the same things.
   */
  const stage = TUTORIAL_STAGE[tutorial.status]
  const orgName = (orgId: string | null) =>
    organizations.find((o) => o.id === orgId)?.name ?? null
  const backer = backing.find((b) => b.status === 'accepted')
  const reviewer =
    orgName(tutorial.reviewed_for_org_id) ?? (backer && orgName(backer.org_id)) ?? 'SPLAT'
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const fullDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const walk = stepsFor(tutorial.kind).filter((s) => s !== 'review' && s !== 'team')
  const byStep = (step: EditStepId) => missing.filter((m) => m.step === step).map((m) => m.label)
  const checklist = walk.map((step) => {
    const gaps = byStep(step)
    // Steps are optional too (080): guides written before them have none.
    const optional = step === 'recommended' || step === 'steps'
    const done = optional ? stepStatuses[step] === 'done' : gaps.length === 0
    return {
      step,
      label: allSteps.find((s) => s.id === step)!.label,
      note: done
        ? 'Done'
        : optional
          ? step === 'steps'
            ? 'No steps yet — optional'
            : 'Nothing picked yet — optional'
          : `Still needs ${gaps.map((g) => g.charAt(0).toLowerCase() + g.slice(1)).join(', ')}`,
      done,
    }
  })
  const filled = checklist.filter((c) => c.done).length

  const COPY: Record<typeof stage, { meta: string; head: string; body: React.ReactNode; progress: string; privacyLead: string; privacy: string }> = {
    hidden: {
      meta: `Draft · saved ${formatRelativeTime(tutorial.updated_at)}`,
      head: 'Only you can see this',
      body: 'A draft is invisible to everyone — families, organisations, even us. It stays here as long as you like, and nothing is checked until you ask for it to be.',
      progress: `${filled} of ${checklist.length} sections filled in. Steps and Worth a look are optional — Safety is not.`,
      privacyLead: 'Nothing here is public.',
      privacy: 'A draft is visible only to you. Submitting shows it to your reviewer, and nobody else, until it is approved.',
    },
    waiting: {
      meta: `With a reviewer since ${day(tutorial.updated_at)}`,
      head: `${reviewer} is reading it`,
      body: 'Someone there reads the whole guide, not a summary. You will get a notification either way, and nothing about it is public in the meantime.',
      progress: `With ${reviewer} since ${day(tutorial.updated_at)}.`,
      privacyLead: 'Still not public.',
      privacy: `Only ${reviewer} can open it while it is in review. It does not appear in the library or in search.`,
    },
    needsyou: {
      meta: `Sent back ${day(tutorial.reviewed_at ?? tutorial.updated_at)}`,
      head: 'Your reviewer sent this back',
      body: tutorial.rejection_note ?? 'No feedback was provided.',
      progress: 'The note from your reviewer is on the Status tab. Saving a change sends it back for review.',
      privacyLead: 'Nobody else saw this.',
      privacy: 'A guide sent back for changes never became public, and the note is between you and your reviewer.',
    },
    live: {
      meta: `Published ${day(tutorial.reviewed_at ?? tutorial.updated_at)}`,
      head: 'Families are using this',
      body: 'It is in the library, in search, and in the PDF anyone can download.',
      progress: `Live since ${day(tutorial.reviewed_at ?? tutorial.updated_at)}. Saving a change sends it back for review.`,
      privacyLead: 'This one is public.',
      privacy: 'Families can read it and download the PDF.',
    },
    declined: { meta: '', head: '', body: '', progress: '', privacyLead: '', privacy: '' },
    gone: { meta: '', head: '', body: '', progress: '', privacyLead: '', privacy: '' },
  }
  const copy = COPY[stage]

  const history: HistoryRow[] = [
    { icon: <Plus weight="bold" />, t: 'Created', d: fullDay(tutorial.created_at) },
    ...(tutorial.reviewed_at && tutorial.status !== 'pending'
      ? [
          {
            icon:
              tutorial.status === 'approved' ? <SealCheck weight="bold" /> : <ChatTeardropText weight="bold" />,
            t: tutorial.status === 'approved' ? 'Approved and published' : `Sent back by ${reviewer}`,
            d: fullDay(tutorial.reviewed_at),
          },
        ]
      : []),
    { icon: <FloppyDisk weight="bold" />, t: 'Last saved', d: formatRelativeTime(tutorial.updated_at), now: true },
  ]

  // Only a published guide has a public page. Anything else previews here, from
  // the contributor's own read of it, through the same view a reader gets.
  const previewHref = (
    tutorial.status === 'approved' ? `/tutorials/${id}` : `/tutorials/${id}/edit?preview=1`
  ) as Route

  if (preview) {
    return (
      <div>
        <div className="editor-privacy mb-6 mt-0 flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong className="text-ink">Previewing as a reader.</strong> This is how the guide
            reads once it is published. Nobody else can see it yet.
          </p>
          <Link href={`/tutorials/${id}/edit` as Route} className="btn btn-quiet btn-sm">
            Back to the editor
          </Link>
        </div>
        <TutorialView tutorial={tutorial} backing={backing} signedIn />
      </div>
    )
  }
  const submit =
    tutorial.status === 'draft' ? (
      <SubmitButton
        label="Submit for review"
        busyLabel="Submitting…"
        errorMessage="Could not submit this tutorial. Please try again."
        onSubmit={submitForReview}
        disabled={missing.length > 0}
        icon={<PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />}
      />
    ) : tutorial.status === 'approved' ? (
      <Link href={previewHref} className="btn btn-primary">
        <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
        Open the live guide
      </Link>
    ) : null

  const statusStep: Step<EditStepId | 'status'> = {
    id: 'status',
    label: 'Status',
    status: 'neutral',
    icon: <FlagBanner size={19} weight="duotone" aria-hidden="true" />,
    hint: 'Where this guide is in its life, and what you can do about it right now.',
    content: (
      <div className="flex flex-col gap-5">
        <StatusCard stage={stage} head={copy.head} body={copy.body} />
        {tutorial.status === 'draft' && (
          <EditorChecklist
            title="What is left before you can submit"
            sub="Everything but Steps and Worth a look has to be filled in before a reviewer can read it."
            rows={checklist}
          />
        )}
        <EditorHistory rows={history} />
        <div className="flex flex-wrap gap-2.5 border-t border-line pt-[18px]">
          {submit}
          <Link href={previewHref} className="btn btn-quiet min-h-[52px]">
            <Eye size={16} aria-hidden="true" />
            Preview as a reader
          </Link>
          {/* Rendered only on a draft: RLS refuses the delete on every other
              status, so a control there could never work. */}
          {tutorial.status === 'draft' && (
            <DeleteEntityButton
              endpoint={`/api/tutorials/${id}`}
              redirectTo="/dashboard/tutorials"
              label="draft"
              className="btn btn-danger min-h-[52px]"
            />
          )}
        </div>
        {tutorial.status === 'draft' && (
          <p className="text-[13px] leading-normal text-muted">
            Submitting sends it to {reviewer}. You can carry on editing until they open it.
          </p>
        )}
      </div>
    ),
  }

  // The board has no Review step — Status says the same thing — and puts Team
  // last, where the pill row had it off to one side.
  const steps: Step<EditStepId | 'status'>[] = [
    statusStep,
    ...stepsFor(tutorial.kind)
      .filter((stepId) => stepId !== 'review')
      .map((stepId) => allSteps.find((s) => s.id === stepId)!),
  ]

  return (
    <div>
      <EditorHeader
        stage={stage}
        stageLabel={stage === 'hidden' ? 'Hidden' : undefined}
        meta={copy.meta}
        title={tutorial.title}
        actions={
          <>
            <Link href={previewHref} className="btn btn-quiet min-h-12">
              <Eye size={16} aria-hidden="true" />
              Preview
            </Link>
            {tutorial.status === 'draft' && (
              <SubmitButton
                label="Submit for review"
                busyLabel="Submitting…"
                errorMessage="Could not submit this tutorial. Please try again."
                onSubmit={submitForReview}
                disabled={missing.length > 0}
                icon={<PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />}
                size="md"
              />
            )}
          </>
        }
      />

      {/* useSearchParams() inside Stepper and CreatedToast requires a Suspense
          boundary, or `next build` fails to prerender this page.

          ToastProvider sits here rather than inside the stepper: every panel's
          save announces itself through it, and so does the arrival from
          /upload, which is the one thing the stepper never had a reason to
          know about. */}
      <Suspense>
        <ToastProvider>
          <CreatedToast />
          <PdfImportBanner />
          <Stepper steps={steps} label="Tutorial sections" layout="rail" railFoot={copy.progress} />
        </ToastProvider>
      </Suspense>

      <p className="editor-privacy lg:ml-[258px]">
        <strong className="text-ink">{copy.privacyLead}</strong> {copy.privacy}
      </p>
    </div>
  )
}
