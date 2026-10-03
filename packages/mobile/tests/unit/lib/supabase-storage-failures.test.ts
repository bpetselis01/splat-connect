import { resolveAuthStorage } from '../../../lib/supabase-storage'

const setLocalStorage = (v: unknown) => { (globalThis as unknown as { localStorage: unknown }).localStorage = v }
afterEach(() => setLocalStorage(undefined))

describe('web storage when the browser refuses', () => {
  it('rejects a write that hits the quota instead of throwing before a promise exists', async () => {
    setLocalStorage({ getItem: () => null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError') }, removeItem: () => {} })
    const p = (() => { try { return resolveAuthStorage('web').setItem('k', 'v') } catch { return 'threw synchronously' } })()
    expect(p).not.toBe('threw synchronously')
    await expect(p).rejects.toThrow('quota')
  })

  it('rejects a read that the browser blocks instead of throwing before a promise exists', async () => {
    setLocalStorage({ getItem: () => { throw new DOMException('denied', 'SecurityError') }, setItem: () => {}, removeItem: () => {} })
    const p = (() => { try { return resolveAuthStorage('web').getItem('k') } catch { return 'threw synchronously' } })()
    expect(p).not.toBe('threw synchronously')
    await expect(p).rejects.toThrow('denied')
  })

  it('reads as empty and writes as a no-op when there is no localStorage at all', async () => {
    setLocalStorage(undefined)
    const s = resolveAuthStorage('web')
    await expect(s.getItem('k')).resolves.toBeNull()
    await expect(s.setItem('k', 'v')).resolves.toBeUndefined()
    await expect(s.removeItem('k')).resolves.toBeUndefined()
  })

  it('round-trips emoji, quotes, markup and a 100 KB value', async () => {
    const backing = new Map<string, string>()
    setLocalStorage({ getItem: (k: string) => backing.get(k) ?? null, setItem: (k: string, v: string) => void backing.set(k, v), removeItem: (k: string) => void backing.delete(k) })
    const s = resolveAuthStorage('web')
    const value = `🧸 "q" <b>&</b> ${'x'.repeat(100_000)}`
    await s.setItem('guide-steps.g', value)
    await expect(s.getItem('guide-steps.g')).resolves.toBe(value)
  })

  it('picks the web adapter only for web', () => {
    expect(resolveAuthStorage('web')).not.toBe(resolveAuthStorage('ios'))
    expect(resolveAuthStorage('android')).toBe(resolveAuthStorage('ios'))
  })
})
