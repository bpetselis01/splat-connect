import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditTutorialPage from '@/app/tutorials/[id]/edit/page'
import type { Profile, TutorialWithDetails } from '@splat-connect/types'

/*
 * The editor's server actions, called the way the sections call them: each
 * section component is replaced by a stub that records the props it was given,
 * and the test invokes those props. What it pins is the re-review rule as it is
 * today. Details, photos, the PDF, the prices-checked date and the customisation
 * questions send an approved OR rejected guide back to pending; parts, tools,
 * steps, safety notes, STL files and settings, picks, team and backing do not.
 */
type Props = Record<string, unknown> & Record<string, (...a: never[]) => Promise<unknown>>
const { seen, stub } = vi.hoisted(() => {
  const seen = { props: {} as Record<string, Props[]> }
  const stub = (name: string) => (props: Props) => {
    ;(seen.props[name] ??= []).push(props)
    return null
  }
  return { seen, stub }
})

const { mockGetCapabilities } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => null, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/components/edit-files-section', () => ({ EditFilesSection: stub('files') }))
vi.mock('@/components/add-stl-form', () => ({ AddStlForm: stub('addStl') }))
vi.mock('@/components/stl-settings-form', () => ({ StlSettingsForm: stub('stlSettings') }))
vi.mock('@/components/customization-fields-form', () => ({ CustomizationFieldsForm: stub('customization') }))
vi.mock('@/components/edit-items-section', () => ({ EditItemsSection: (p: Props) => stub(p.noun as unknown as string)(p) }))
vi.mock('@/components/prices-checked-field', () => ({ PricesCheckedField: stub('prices') }))
vi.mock('@/components/edit-details-section', () => ({ EditDetailsSection: stub('details') }))
vi.mock('@/components/edit-safety-notes-section', () => ({ EditSafetyNotesSection: stub('safety') }))
vi.mock('@/components/edit-steps-section', () => ({ EditStepsSection: stub('steps') }))
vi.mock('@/components/edit-suits-section', () => ({ EditSuitsSection: stub('suits') }))
vi.mock('@/components/edit-recommendations-section', () => ({ EditRecommendationsSection: stub('picks') }))
vi.mock('@/components/edit-collaborators-section', () => ({ EditCollaboratorsSection: stub('team') }))
vi.mock('@/components/edit-backing-section', () => ({ EditBackingSection: stub('backing') }))
vi.mock('@/components/editor-status', () => ({
  EditorChecklist: () => null,
  EditorHeader: () => null,
  EditorHistory: () => null,
  StatusCard: () => null,
  SubmitButton: stub('submit'),
}))
vi.mock('@/components/delete-entity-button', () => ({ DeleteEntityButton: stub('delete') }))
vi.mock('@/components/created-toast', () => ({ CreatedToast: () => null }))
vi.mock('@/components/pdf-import-banner', () => ({ PdfImportBanner: () => null }))
vi.mock('@/components/stepper', () => ({
  Stepper: ({ steps }: { steps: { id: string; content: React.ReactNode }[] }) => (
    <div>{steps.map((s) => <span key={s.id}>{s.content}</span>)}</div>
  ),
}))

import { apiClient } from '@/lib/api-client'

const me: Profile = { id: 'user-1', name: 'Test User', email: 't@example.com', role: 'contributor', created_at: '2026-01-01T00:00:00Z', public_showcase: true }
const guide = (status: TutorialWithDetails['status']): TutorialWithDetails => ({
  id: 'g1', title: 'Guide', difficulty: 'easy', kind: 'assistive_tech', status, safety_declared_at: '2026-08-01T00:00:00Z', build_minutes: 30,
  description: null, tutorial_pdf_url: 'g1/tutorial.pdf', photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: 'T-CURRENT', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
  parts: [], tools: [], stl_files: [{ id: 'f1', tutorial_id: 'g1', filename: 'a.stl', file_url: 'g1/a.stl' }], tutorial_recommendations: [],
  tutorial_contributors: [{ tutorial_id: 'g1', profile_id: 'user-1', role: 'primary', added_at: '', profiles: me }],
}) as unknown as TutorialWithDetails

async function mount(status: TutorialWithDetails['status']) {
  for (const k of Object.keys(seen.props)) delete seen.props[k]
  vi.mocked(apiClient.get).mockReset().mockImplementation(async (path: string) => (path === '/api/tutorials/g1' ? guide(status) : []))
  render(await EditTutorialPage({ params: Promise.resolve({ id: 'g1' }) }))
  const last = (name: string) => seen.props[name].at(-1)!
  return last
}
const patched = () => vi.mocked(apiClient.patch).mock.calls

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCapabilities.mockResolvedValue({ profile: me, isAdmin: false, ledOrgs: [], unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0 })
})

const detailsPatch = { title: 'T', description: null, difficulty: 'easy', build_minutes: 30, age_min: null, age_max: null, kind: 'assistive_tech', toy_name: null, toy_brand: null, works_with: null, no_build_note: null, done_note: null, updated_at: 'T-LOADED' }

describe('the editor sets an approved or rejected guide back to pending', () => {
  it.each(['approved', 'rejected'] as const)('WT18 Details on a %s guide patches the guide with status pending and the loaded updated_at', async (status) => {
    const last = await mount(status)
    await last('details').onSave(detailsPatch as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { ...detailsPatch, status: 'pending' }]])
  })

  it.each(['draft', 'pending'] as const)('WT18 Details on a %s guide leaves the status alone', async (status) => {
    const last = await mount(status)
    await last('details').onSave(detailsPatch as never)
    expect(patched()).toEqual([['/api/tutorials/g1', detailsPatch]])
  })

  it('WT23 a photo save patches photo_urls, and captions with them, setting pending on an approved guide and not on a draft', async () => {
    let last = await mount('approved')
    await last('files').onSavePhotos(['u1', 'u2'] as never, ['one', null] as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { photo_urls: ['u1', 'u2'], photo_captions: ['one', null], status: 'pending', updated_at: 'T-CURRENT' }]])

    vi.mocked(apiClient.patch).mockClear()
    last = await mount('draft')
    await last('files').onSavePhotos(['u1'] as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { photo_urls: ['u1'], updated_at: 'T-CURRENT' }]])
  })

  it('WT24 a PDF save patches tutorial_pdf_url, setting pending on a rejected guide and not on a pending one', async () => {
    let last = await mount('rejected')
    await last('files').onSave('g1/new.pdf' as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { tutorial_pdf_url: 'g1/new.pdf', status: 'pending', updated_at: 'T-CURRENT' }]])

    vi.mocked(apiClient.patch).mockClear()
    last = await mount('pending')
    await last('files').onSave(null as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { tutorial_pdf_url: null, updated_at: 'T-CURRENT' }]])
  })

  it('WT25 the prices-checked date sets pending on an approved guide', async () => {
    const last = await mount('approved')
    await last('prices').onSave('2026-08-02' as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { prices_checked_on: '2026-08-02', status: 'pending', updated_at: 'T-CURRENT' }]])
  })

  it('WT28 the customisation questions set pending on an approved guide', async () => {
    const last = await mount('approved')
    const fields = [{ label: 'Colour', type: 'choice', options: ['red'] }]
    await last('customization').onSave(fields as never)
    expect(patched()).toEqual([['/api/tutorials/g1', { customization_fields: fields, status: 'pending', updated_at: 'T-CURRENT' }]])
  })
})

describe('the editor leaves an approved guide approved', () => {
  it('WT25 WT26 parts (quantity defaulting to 1) and tools post their list and patch nothing', async () => {
    const last = await mount('approved')
    await last('part').onSave([{ name: 'Switch jack' }] as never)
    await last('tool').onSave([{ name: 'Screwdriver', is_optional: false }] as never)
    expect(vi.mocked(apiClient.post).mock.calls).toEqual([
      ['/api/tutorials/g1/parts', { parts: [{ name: 'Switch jack', quantity: 1 }] }],
      ['/api/tutorials/g1/tools', { tools: [{ name: 'Screwdriver', is_optional: false }] }],
    ])
    expect(patched()).toEqual([])
  })

  it('WT19 WT21 safety notes post and steps put, and patch nothing', async () => {
    const last = await mount('approved')
    await last('safety').onSave([{ title: 'Batteries', detail: null }] as never)
    await last('steps').onSave([{ body: 'Open it' }] as never)
    expect(vi.mocked(apiClient.post).mock.calls).toEqual([['/api/tutorials/g1/safety-notes', { safety_notes: [{ title: 'Batteries', detail: null }] }]])
    expect(vi.mocked(apiClient.put).mock.calls).toEqual([['/api/tutorials/g1/steps', { steps: [{ body: 'Open it' }] }]])
    expect(patched()).toEqual([])
  })

  it('WT27 WT28 an STL record is posted with the files already there, and settings patch the one file', async () => {
    const last = await mount('approved')
    await last('addStl').onAdd('b.stl' as never, 'g1/b.stl' as never)
    await last('stlSettings').onSave('f1' as never, { layer_height_mm: 0.2 } as never)
    expect(vi.mocked(apiClient.post).mock.calls).toEqual([
      ['/api/tutorials/g1/stl-files', { stl_files: [{ id: 'f1', tutorial_id: 'g1', filename: 'a.stl', file_url: 'g1/a.stl' }, { filename: 'b.stl', file_url: 'g1/b.stl' }] }],
    ])
    expect(patched()).toEqual([['/api/tutorials/g1/stl-files/f1', { layer_height_mm: 0.2 }]])
  })

  it('WT29 WT30 WT31 picks, an invite, a removal, an ask and a withdrawal go to their own endpoints and patch nothing', async () => {
    const last = await mount('approved')
    await last('picks').onSave([{ recommended_id: 'r1', required: true }] as never)
    await last('team').onInvite('friend@example.com' as never)
    await last('team').onRemove('p9' as never)
    await last('backing').onAsk('org1' as never)
    await last('backing').onWithdraw('org1' as never)
    expect(vi.mocked(apiClient.post).mock.calls).toEqual([
      ['/api/tutorials/g1/recommendations', { recommendations: [{ recommended_id: 'r1', required: true }] }],
      ['/api/tutorials/g1/collaborators/invite', { email: 'friend@example.com' }],
      ['/api/tutorials/g1/orgs', { org_id: 'org1' }],
    ])
    expect(vi.mocked(apiClient.delete).mock.calls).toEqual([['/api/tutorials/g1/collaborators/p9'], ['/api/tutorials/g1/orgs/org1']])
    expect(patched()).toEqual([])
  })
})

describe('Submit for review', () => {
  it('WT32 patches status pending with the current updated_at, on a draft only', async () => {
    const last = await mount('draft')
    await last('submit').onSubmit()
    expect(patched()).toEqual([['/api/tutorials/g1', { status: 'pending', updated_at: 'T-CURRENT' }]])

    await mount('approved')
    expect(seen.props.submit).toBeUndefined()
  })
})

describe('Delete draft', () => {
  it('WT34 points the typed-confirmation delete at this guide and returns to My tutorials, on a draft only', async () => {
    const last = await mount('draft')
    expect(last('delete')).toMatchObject({ endpoint: '/api/tutorials/g1', redirectTo: '/dashboard/tutorials', label: 'draft' })

    for (const status of ['pending', 'approved', 'rejected'] as const) {
      await mount(status)
      expect(seen.props.delete).toBeUndefined()
    }
  })
})
