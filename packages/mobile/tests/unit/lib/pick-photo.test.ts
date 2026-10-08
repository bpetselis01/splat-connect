import * as ImagePicker from 'expo-image-picker'
import { pickPreviewedPhoto, registerPhotoPreviewHost } from '../../../lib/pick-photo'

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
const launch = ImagePicker.launchImageLibraryAsync as jest.Mock
const shot = { canceled: false, assets: [{ uri: 'file:///a.jpg' }] }

describe('pickPreviewedPhoto', () => {
  beforeEach(() => launch.mockReset().mockResolvedValue(shot))

  it('passes straight through with no host', async () => {
    expect(await pickPreviewedPhoto()).toBe(shot)
  })

  it('returns the pick when the preview says use, and shows the picked uris', async () => {
    const host = jest.fn().mockResolvedValue('use')
    const off = registerPhotoPreviewHost(host)
    expect(await pickPreviewedPhoto()).toBe(shot)
    expect(host).toHaveBeenCalledWith(['file:///a.jpg'])
    off()
  })

  it('reopens the picker on choose-another, and cancels on cancel', async () => {
    const host = jest.fn().mockResolvedValueOnce('again').mockResolvedValueOnce('cancel')
    const off = registerPhotoPreviewHost(host)
    expect(await pickPreviewedPhoto()).toEqual({ canceled: true, assets: null })
    expect(launch).toHaveBeenCalledTimes(2)
    off()
  })
})
