import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChildSurveyForm } from '@/components/child-survey-form'
import { QUESTIONS } from '@splat-connect/types'

function answerAllQuestions(optionIndex = 0) {
  for (const q of QUESTIONS) {
    fireEvent.click(screen.getByRole('button', { name: q.options[optionIndex] }))
  }
}

describe('ChildSurveyForm', () => {
  it('explains what the survey is for', () => {
    render(<ChildSurveyForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByText(/we'll estimate both for you/i)).toBeInTheDocument()
  })

  it('disables Estimate & save until every question is answered', () => {
    render(<ChildSurveyForm profile={null} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Estimate & save' })).toBeDisabled()
  })

  it('computes MACS/BFMF from the answers and saves both scores as estimated', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ChildSurveyForm profile={null} onSave={onSave} />)

    answerAllQuestions(0)
    fireEvent.click(screen.getByRole('button', { name: 'Estimate & save' }))

    await screen.findByText('Saved')
    expect(onSave).toHaveBeenCalledWith({
      macs_level: 'I',
      bfmf_score: '1',
      macs_source: 'estimated',
      bfmf_source: 'estimated',
    })
  })

  it('shows an error and no saved indicator when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ChildSurveyForm profile={null} onSave={onSave} />)

    answerAllQuestions(0)
    fireEvent.click(screen.getByRole('button', { name: 'Estimate & save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your changes')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
