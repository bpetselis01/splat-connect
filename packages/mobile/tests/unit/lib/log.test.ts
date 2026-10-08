// journeys: G29
import { isNetworkError } from '@splat-connect/types'
import { logFailure } from '../../../lib/log'

const apiErr = (status: number) =>
  Object.assign(new Error(`API GET /x failed with status ${status}`), { status })
const named = (name: string, msg: string) => Object.assign(new Error(msg), { name })

describe('isNetworkError', () => {
  it.each([
    ['react native offline', new TypeError('Network request failed')],
    ['browser offline', new TypeError('Failed to fetch')],
    ['safari offline', new TypeError('Load failed')],
    ['abort', named('AbortError', 'Aborted')],
    ['timeout', named('TimeoutError', 'The operation timed out')],
  ])('%s is a network error', (_n, e) => expect(isNetworkError(e)).toBe(true))

  it.each([
    ['api 500', apiErr(500)],
    ['api 404', apiErr(404)],
    ['plain error', new Error('boom')],
    ['string', 'Network request failed'],
    ['null', null],
  ])('%s is not', (_n, e) => expect(isNetworkError(e)).toBe(false))
})

describe('logFailure', () => {
  let error: jest.SpyInstance
  let debug: jest.SpyInstance
  beforeEach(() => {
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
    debug = jest.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('keeps a network failure out of console.error', () => {
    logFailure('load', new TypeError('Network request failed'))
    expect(error).not.toHaveBeenCalled()
    expect(debug).toHaveBeenCalled()
  })
  it('still console.errors everything else', () => {
    const e = apiErr(500)
    logFailure('load', e)
    expect(error).toHaveBeenCalledWith('load', e)
  })
})
