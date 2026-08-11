import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildProfileForm } from '@/components/child-profile-form'
import type { ChildProfile } from '@splat-connect/types'

describe('ChildProfileForm', () => {
  // Chain: gating the tab on isParent would mean the only way to create a child
  //        profile is to already have one. This is the create path.
  it('hands the edited fields to onSave instead of calling an endpoint itself', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait for the save to fully settle (not just for `onSave` to have been called) so
    // no in-flight promise from this test resolves mid-way through the next one.
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ age: 7 }))
  })

  // Chain: name is optional, so it must round-trip as a normal field rather than
  //        being required to identify the child.
  it('edits the optional name', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Emma' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Emma' }))
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Telling the user a change was recorded when the server never recorded it
    // leaves them confused later, so a failure must never show "Saved".
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('pre-fills an existing profile', () => {
    render(
      <ChildProfileForm
        onSave={vi.fn()}
        profile={{
          age: 9,
          primary_diagnosis: 'Cerebral palsy',
          macs_level: 'II',
          grip_type: 'Palmar',
          palm_width_mm: 52.5,
        } as ChildProfile}
      />
    )
    // One field from each of the three sections — Ability profile, Everyday
    // needs, Customization metrics — plus a numeric one, so a field seeded
    // for only the first section (the bug this guards against) fails here.
    expect(screen.getByLabelText('Age')).toHaveValue(9)
    expect(screen.getByLabelText('Primary diagnosis')).toHaveValue('Cerebral palsy')
    expect(screen.getByLabelText('Grip type')).toHaveValue('Palmar')
    expect(screen.getByLabelText('Palm width (mm)')).toHaveValue(52.5)
  })

  it('saves the ability fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('MACS level'), { target: { value: 'III' } })
    fireEvent.change(screen.getByLabelText('Hand involvement'), { target: { value: 'unilateral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ macs_level: 'III', hand_involvement: 'unilateral' })
    )
  })

  it('reports a failed save instead of claiming success', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})

describe('ChildProfileForm — remaining sections', () => {
  it('saves everyday needs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Other challenges'), { target: { value: 'Tires quickly' } })
    fireEvent.change(screen.getByLabelText('Grip type'), { target: { value: 'Palmar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ challenge_other: 'Tires quickly', grip_type: 'Palmar' })
    )
  })

  it('saves customization metrics', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Palm width (mm)'), { target: { value: '52' } })
    fireEvent.click(screen.getByLabelText('Needs an arm attachment'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ palm_width_mm: 52, needs_arm_attachment: true })
    )
  })

  // Chain: challenges and sensory_preferences are text[] NOT NULL DEFAULT '{}'.
  //        Sending null violates the column.
  it('always sends the array columns as arrays', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByText('Saved')
    const body = onSave.mock.calls[0][0] as Record<string, unknown>
    expect(Array.isArray(body.challenges)).toBe(true)
    expect(Array.isArray(body.sensory_preferences)).toBe(true)
    expect(body.needs_arm_attachment).toBe(false)
  })
})

describe('ChildProfileForm — ability quiz', () => {
  const TOGGLE = "Don't know MACS level? Fill out this quick survey."
  // One option per question, all index 0 → total 0 → MACS I / BFMF 1.
  const ALL_ZERO = [
    'Easily, with either hand',
    'Independently with both hands',
    'Uses it well as a helper',
    'None',
  ]

  // jsdom applies no UA stylesheet, so a closed dialog's contents stay
  // queryable — "is it open" is read off the `open` attribute, same as
  // delete-child-button.test.tsx.
  it('keeps the quiz dialog closed until the toggle is clicked', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')

    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))
    expect(screen.getByRole('dialog')).toHaveAttribute('open')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
  })

  it('keeps Estimate disabled until every question is answered', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO.slice(0, 3)) {
      expect(screen.getByRole('button', { name: 'Estimate' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: option }))
    }
    expect(screen.getByRole('button', { name: 'Estimate' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: ALL_ZERO[3] }))
    expect(screen.getByRole('button', { name: 'Estimate' })).toBeEnabled()
  })

  // Chain: the whole point of the quiz is that a parent who does not know the
  //        clinical terms still ends up with both scores recorded — and the
  //        record has to say they were estimated, not measured.
  it('fills both scores from the quiz and marks them estimated', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO) fireEvent.click(screen.getByRole('button', { name: option }))
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))

    expect(screen.getByLabelText('MACS level')).toHaveValue('I')
    expect(screen.getByLabelText('BFMF score')).toHaveValue('1')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macs_level: 'I',
        bfmf_score: '1',
        macs_source: 'estimated',
        bfmf_source: 'estimated',
      })
    )
  })

  // Chain: an estimate the parent then overrides by hand is no longer an
  //        estimate, and storing it as one misreports how the value was got.
  it('reverts a source to manual when that dropdown is edited afterwards', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildProfileForm profile={null} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    for (const option of ALL_ZERO) fireEvent.click(screen.getByRole('button', { name: option }))
    fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    fireEvent.change(screen.getByLabelText('MACS level'), { target: { value: 'IV' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        macs_level: 'IV',
        macs_source: 'manual',
        // Untouched, so still the estimate.
        bfmf_score: '1',
        bfmf_source: 'estimated',
      })
    )
  })

  it('marks a chosen option as pressed', () => {
    render(<ChildProfileForm profile={null} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TOGGLE }))

    const option = screen.getByRole('button', { name: ALL_ZERO[0] })
    expect(option).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(option)
    expect(option).toHaveAttribute('aria-pressed', 'true')
  })
})
