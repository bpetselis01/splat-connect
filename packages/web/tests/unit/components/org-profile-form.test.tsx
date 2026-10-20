import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrgProfileForm } from '@/components/org-profile-form'
import { OrgImagePicker } from '@/components/org-profile-parts'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Organization } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn(), put: vi.fn(), postFormData: vi.fn() } }))
const patch = vi.mocked(browserApiClient.patch)
const put = vi.mocked(browserApiClient.put)

const ORG = {
  id: 'o1', name: 'Riverside', description: 'We adapt toys.', about: '', kind: 'Therapy practice', suburb: 'Newtown', state: 'NSW',
  contact_email: 'hi@riverside.test', contact_phone: '', website_url: '', visit_hours: '', service_area: '', rate_note: 'Materials at cost.',
  recycling_note: '', capabilities: ['Holds toys'], recycling_materials: [], payment_methods: [], logo_url: null, cover_url: null,
  doors: [{ id: 'd1', title: 'Borrow a toy', body: 'Ask us.', target: 'toy_library' }],
  rate_lines: [{ id: 'l1', description: 'Switch kit', amount_cents: 1250, claiming: false }],
} as unknown as Organization

beforeEach(() => {
  vi.clearAllMocks()
  patch.mockResolvedValue({} as never)
  put.mockResolvedValue({} as never)
})

describe('OrgProfileForm', () => {
  it('WB30 "Save and publish" patches the profile, then replaces the doors and the rate lines, and says the page changed', async () => {
    render(<OrgProfileForm org={ORG} />)
    fireEvent.change(screen.getByDisplayValue('Riverside'), { target: { value: 'Riverside Therapy' } })
    fireEvent.click(screen.getByRole('button', { name: /Save and publish/ }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/organizations/o1/profile',
        expect.objectContaining({ name: 'Riverside Therapy', suburb: 'Newtown', capabilities: ['Holds toys'], rate_note: 'Materials at cost.' }),
      ),
    )
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put).toHaveBeenCalledWith('/api/organizations/o1/doors', { doors: [{ title: 'Borrow a toy', body: 'Ask us.', target: 'toy_library' }] })
    expect(put).toHaveBeenCalledWith('/api/organizations/o1/rate-lines', { lines: [{ description: 'Switch kit', amount_cents: 1250, claiming: false }] })
    expect(await screen.findByText('Saved — your public page has changed.')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('WB30 sends nothing when a cost line has no reason, and says so', async () => {
    render(<OrgProfileForm org={{ ...ORG, rate_note: '' } as Organization} />)
    fireEvent.click(screen.getByRole('button', { name: /Save and publish/ }))
    expect(await screen.findByText('Say why these costs, in a sentence or two.')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('WB30 shows the API’s reason when the profile does not save, and writes no lists', async () => {
    patch.mockRejectedValue(new Error('400 {"error":"Name is too long"}'))
    render(<OrgProfileForm org={ORG} />)
    fireEvent.click(screen.getByRole('button', { name: /Save and publish/ }))
    expect(await screen.findByText('Name is too long')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
  })

  it('WB31 saving a removed logo sends logo_url null, and keeps a picture that was not touched', async () => {
    render(<OrgProfileForm org={{ ...ORG, logo_url: 'http://localhost/storage/v1/object/public/toy-photos/logo.png', cover_url: 'http://localhost/storage/v1/object/public/toy-photos/cover.png' } as Organization} />)
    const logoPicker = screen.getByLabelText('Replace the square logo').closest('div')!
    fireEvent.click(within(logoPicker).getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: /Save and publish/ }))
    await waitFor(() => expect(patch).toHaveBeenCalled())
    const body = patch.mock.calls[0][1] as Record<string, unknown>
    expect(body.logo_url).toBeNull()
    expect('cover_url' in body).toBe(false)
  })
})

describe('OrgImagePicker', () => {
  it('WB31 uploads the chosen file at once to /api/upload/org-image with the organisation and slot, and reports the new url', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://placeholder.invalid/new-logo.png' } as never)
    const onChange = vi.fn()
    render(<OrgImagePicker orgId="o1" slot="logo" url={null} onChange={onChange} />)
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Add a square logo'), { target: { files: [file] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://placeholder.invalid/new-logo.png'))
    const [path, body] = vi.mocked(browserApiClient.postFormData).mock.calls[0] as [string, FormData]
    expect(path).toBe('/api/upload/org-image')
    expect([body.get('orgId'), body.get('slot'), (body.get('file') as File).name]).toEqual(['o1', 'logo', 'logo.png'])
  })

  it('WB31 says the picture did not upload when the API refuses it', async () => {
    vi.mocked(browserApiClient.postFormData).mockRejectedValue(new Error('API POST /api/upload/org-image failed with status 413: That picture is too big'))
    const onChange = vi.fn()
    render(<OrgImagePicker orgId="o1" slot="cover" url={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Add a cover photo'), { target: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } })
    expect(await screen.findByText('That picture is too big')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
