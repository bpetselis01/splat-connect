import { describe, it, expect } from 'vitest'
import { OUTCOME_STEPS, outcomeStates } from '@splat-connect/types'

describe('outcomeStates', () => {
  it('puts a pending idea at the first step, a live challenge at the second, a graduated one at the third', () => {
    expect(outcomeStates('pending')).toEqual(['now', 'todo', 'todo', 'todo'])
    expect(outcomeStates('challenge')).toEqual(['done', 'now', 'todo', 'todo'])
    expect(outcomeStates('graduated')).toEqual(['done', 'done', 'now', 'todo'])
  })
  it('leaves every step to do on a rejected idea', () => {
    expect(outcomeStates('rejected')).toEqual(['todo', 'todo', 'todo', 'todo'])
  })
  it('names the board’s four steps', () => {
    expect(OUTCOME_STEPS.map((s) => s.label)).toEqual([
      'Idea approved', 'Makers working', 'Written up as a guide', 'Guide published',
    ])
  })
})
