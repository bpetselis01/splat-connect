import { render, screen } from '@testing-library/react-native'
import { SectionProgress } from '../../../../components/my-tutorials/sections/section-progress'

let mockTutorial: any
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => ({ tutorial: mockTutorial }) }))

const base = { title: 'Drum', difficulty: 'easy', build_minutes: null, tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [], steps: [], kind: 'toy_adaptation', safety_declared_at: null }

it('says how many of a page’s requirements are done and names what is left', () => {
  mockTutorial = { ...base }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('2 of 3 done')).toBeTruthy()
  expect(screen.getByText('Still needed: A build time')).toBeTruthy()
})

it('turns to "Nothing left here" when every check is done', () => {
  mockTutorial = { ...base, build_minutes: 30 }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('3 of 3 done')).toBeTruthy()
  expect(screen.getByText('Nothing left here')).toBeTruthy()
})

it('renders nothing for a section with no requirements', () => {
  mockTutorial = { ...base }
  render(<SectionProgress section="suits" />)
  expect(screen.queryByTestId('section-progress')).toBeNull()
})

it('lists several gaps joined with a middle dot', () => {
  mockTutorial = { ...base, title: '', build_minutes: null }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('Still needed: A title · A build time')).toBeTruthy()
})
