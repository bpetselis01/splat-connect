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
