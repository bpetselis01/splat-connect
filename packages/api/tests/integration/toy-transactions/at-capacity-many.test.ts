/**
 * The capacity scan over more toy ids than fit in one PostgREST URL (~300
 * uuids). It used to 414 and return null, which the exchange list reads as
 * "we do not know" and so never marks a full toy.
 */
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { atCapacityToyIds } from '../../../src/toy-access.js'
import { adminClient } from '../../helpers/auth.js'

describe('atCapacityToyIds with more than 300 toys', () => {
  it('returns an empty set rather than null', async () => {
    const ids = Array.from({ length: 350 }, () => randomUUID())
    const full = await atCapacityToyIds(adminClient() as never, ids)
    expect(full).toEqual(new Set())
  })
})
