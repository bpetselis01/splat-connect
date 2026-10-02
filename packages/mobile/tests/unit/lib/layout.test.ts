import { SEARCH_GAP, SCREEN_GUTTER, scrollFrame, scrollContent } from '../../../lib/layout'
import { theme } from '../../../lib/theme'

it('the gap under a search field is at least 16', () => {
  expect(SEARCH_GAP).toBeGreaterThanOrEqual(16)
  expect(SEARCH_GAP).toBe(theme.spacing(4))
})

// A scroll view clips its content to its frame, so inside a padded Screen the
// card shadows were cut at the gutter and drew as a grey rectangle between
// cards. The frame spans the screen; the content restores the gutter.
it('scrollFrame spans the Screen padding and scrollContent restores it', () => {
  expect(scrollFrame).toEqual({ marginHorizontal: -SCREEN_GUTTER })
  expect(scrollContent).toEqual({ paddingHorizontal: SCREEN_GUTTER })
})
