import { setGuideFocus, takeGuideFocus } from '../../../lib/guide-focus'

it('hands a focus to the guide it names, once', () => {
  setGuideFocus({ tutorialId: 'g1', noteId: 'n1' })
  expect(takeGuideFocus('g1')).toEqual({ tutorialId: 'g1', noteId: 'n1' })
  expect(takeGuideFocus('g1')).toBeNull()
})

it('keeps a focus meant for another guide', () => {
  setGuideFocus({ tutorialId: 'g1', noteId: null })
  expect(takeGuideFocus('g2')).toBeNull()
  expect(takeGuideFocus('g1')).toEqual({ tutorialId: 'g1', noteId: null })
})
