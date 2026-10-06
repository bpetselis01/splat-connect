import { stlName, webGuideUrl, STL_PREVIEW_MAX_BYTES } from '../../../lib/guide-files'

describe('stlName', () => {
  it.each([
    ['lts_base.stl', 'Lts base'],
    ['Rumble-Plate_lid.STL', 'Rumble Plate lid'],
    ['mount', 'Mount'],
    ['', ''],
  ])('%s → %s', (input, out) => expect(stlName(input)).toBe(out))
})

describe('webGuideUrl', () => {
  const was = process.env.EXPO_PUBLIC_WEB_URL
  afterEach(() => { process.env.EXPO_PUBLIC_WEB_URL = was })
  it('points at the guide on the website', () => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
    expect(webGuideUrl('abc')).toBe('https://splat.example/tutorials/abc')
  })
  it('is null when the web address is not configured', () => {
    delete process.env.EXPO_PUBLIC_WEB_URL
    expect(webGuideUrl('abc')).toBeNull()
  })
})

it('caps previews at 25 MB', () => expect(STL_PREVIEW_MAX_BYTES).toBe(26214400))
