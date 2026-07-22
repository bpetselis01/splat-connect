import * as SecureStore from 'expo-secure-store'
import { resolveAuthStorage } from '../../../lib/supabase-storage'

describe('resolveAuthStorage', () => {
  it('uses localStorage on web', async () => {
    const backing: Record<string, string> = {}
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => (k in backing ? backing[k] : null),
      setItem: (k: string, v: string) => { backing[k] = v },
      removeItem: (k: string) => { delete backing[k] },
    }
    const storage = resolveAuthStorage('web')
    await storage.setItem('session', 'abc')
    expect(await storage.getItem('session')).toBe('abc')
    await storage.removeItem('session')
    expect(await storage.getItem('session')).toBeNull()
  })

  it('delegates to expo-secure-store on native platforms', async () => {
    const get = jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValue('stored')
    const set = jest.spyOn(SecureStore, 'setItemAsync').mockResolvedValue()
    const del = jest.spyOn(SecureStore, 'deleteItemAsync').mockResolvedValue()
    const storage = resolveAuthStorage('ios')
    await storage.setItem('session', 'abc')
    expect(await storage.getItem('session')).toBe('stored')
    await storage.removeItem('session')
    expect(set).toHaveBeenCalledWith('session', 'abc')
    expect(get).toHaveBeenCalledWith('session')
    expect(del).toHaveBeenCalledWith('session')
  })
})
