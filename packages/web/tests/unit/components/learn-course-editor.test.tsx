import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LEARN_COURSE } from '@splat-connect/types'
import { LearnCourseEditor } from '@/components/learn-course-editor'

const put = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { put: (...a: unknown[]) => put(...a) } }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

beforeEach(() => {
  vi.clearAllMocks()
  put.mockResolvedValue({})
})

describe('LearnCourseEditor', () => {
  it('saves the course fields, a renamed unit, the new order and a lesson change as one value', async () => {
    render(<LearnCourseEditor course={LEARN_COURSE} version={null} />)

    fireEvent.change(screen.getByLabelText('Course title'), { target: { value: 'Toy adaptation, start to finish' } })
    fireEvent.change(screen.getByLabelText('Shown as'), { target: { value: 'sign_in' } })
    fireEvent.change(screen.getByLabelText('Unit 1 title'), { target: { value: 'Begin here' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move unit 2 up' }))
    // Unit 2 is now "Start here" (renamed "Begin here"); open its lessons.
    fireEvent.click(screen.getByRole('button', { name: 'Edit lessons in unit 2' }))
    const first = screen.getAllByRole('group', { name: /^Lesson / })[0]
    fireEvent.change(within(first).getByLabelText('Minutes'), { target: { value: '9' } })
    fireEvent.change(within(first).getByLabelText('Kind'), { target: { value: 'build' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('Saved.')
    const [path, body] = put.mock.calls[0] as [string, { value: Record<string, unknown> & { units: any[] } }]
    expect(path).toBe('/api/admin/content/learn-course')
    expect(body.value).toMatchObject({ title: 'Toy adaptation, start to finish', shown_as: 'sign_in' })
    expect(body.value.units.map((u) => u.id)).toEqual(['bench', 'start-here', 'connector', 'first-toys', 'own-switch', 'handover'])
    expect(body.value.units[1].title).toBe('Begin here')
    expect(body.value.units[1].lessons[0]).toEqual({ slug: 'toy-adaptation-101', title: 'Toy adaptation 101', minutes: 9, kind: 'build' })
    expect(refresh).toHaveBeenCalled()
    // Nothing was saved when the form loaded, so it says so.
    expect(body).toMatchObject({ expected_updated_at: null })
  })

  it('offers no way to add a unit or a lesson', async () => {
    render(<LearnCourseEditor course={LEARN_COURSE} version={null} />)
    expect(screen.queryByRole('button', { name: /Add a unit|Add a lesson/ })).toBeNull()
  })

  it("shows the API's sentence when the save is refused", async () => {
    put.mockRejectedValue(
      Object.assign(
        new Error('API PUT /api/admin/content/learn-course failed with status 400: A lesson length must be a whole number of minutes from 1 to 240.'),
        { status: 400 }
      )
    )
    render(<LearnCourseEditor course={LEARN_COURSE} version={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A lesson length must be a whole number of minutes from 1 to 240.')
  })

  // Byron 2026-10-02: several admins may edit the course.
  it('WM36 shows who saved last and sends the version it loaded', async () => {
    render(
      <LearnCourseEditor
        course={LEARN_COURSE}
        version={{ updated_at: '2026-09-20T02:00:00.000000+00:00', updated_by_name: 'Ada Admin' }}
      />
    )
    expect(screen.getByText('Last edited by Ada Admin on Sunday 20 September 2026')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Saved.')
    expect(put.mock.calls[0][1]).toMatchObject({ expected_updated_at: '2026-09-20T02:00:00.000000+00:00' })
  })

  it('WM36 offers a reload when someone else saved first', async () => {
    put.mockRejectedValue(
      Object.assign(
        new Error(
          'API PUT /api/admin/content/learn-course failed with status 409: Someone else saved this course since you opened it. Reload to see their changes.'
        ),
        { status: 409 }
      )
    )
    render(<LearnCourseEditor course={LEARN_COURSE} version={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Someone else saved this course since you opened it. Reload to see their changes.')
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeTruthy()
  })
})
