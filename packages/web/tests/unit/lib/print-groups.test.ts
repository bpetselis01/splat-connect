import { describe, it, expect } from 'vitest'
import { collapsePrintGroups } from '@splat-connect/types'
import type { PrinterWithOwner, PrintJobFile, ToyTransactionStatus } from '@splat-connect/types'
import {
  togglePrinterPick,
  pickSummary,
  askedPrintersLabel,
  othersAskedLabel,
  rankMachines,
} from '@/lib/print-groups'

const row = (id: string, print_group_id: string | null, status: ToyTransactionStatus) => ({ id, print_group_id, status })

describe('collapsePrintGroups', () => {
  it('shows one row per request, led by the job that was taken, in the original order', () => {
    const out = collapsePrintGroups([
      row('solo', null, 'requested'),
      row('g1-a', 'g1', 'withdrawn'),
      row('g1-b', 'g1', 'accepted'),
      row('g2-a', 'g2', 'requested'),
      row('g2-b', 'g2', 'rejected'),
    ])
    expect(out.map((r) => [r.id, r.print_group_size])).toEqual([
      ['solo', 1],
      ['g1-b', 2],
      ['g2-a', 2],
    ])
  })
})

describe('togglePrinterPick', () => {
  it('adds up to three, refuses a fourth, and lets one go', () => {
    let picked: string[] = []
    for (const id of ['a', 'b', 'c', 'd']) picked = togglePrinterPick(picked, id)
    expect(picked).toEqual(['a', 'b', 'c'])
    expect(togglePrinterPick(picked, 'b')).toEqual(['a', 'c'])
  })

  it('counts the picks in the board words', () => {
    expect(pickSummary(0)).toBe('Pick up to three printers')
    expect(pickSummary(2)).toBe('2 of 3 picked · first to accept wins')
  })
})

describe('group copy', () => {
  it('says nothing about a request that went to one printer', () => {
    expect(askedPrintersLabel(1)).toBeNull()
    expect(askedPrintersLabel(null)).toBeNull()
    expect(othersAskedLabel(1)).toBeNull()
  })

  it('names the others on both sides', () => {
    expect(askedPrintersLabel(3)).toBe('Asked 3 printers')
    expect(othersAskedLabel(2)).toBe('1 other printer was asked — first to accept wins')
    expect(othersAskedLabel(3)).toBe('2 other printers were asked — first to accept wins')
  })
})

describe('rankMachines', () => {
  const machine = (id: string, over: Partial<PrinterWithOwner>) =>
    ({ id, name: id, materials: ['PLA'], accepting: true, capacity: 2, open_jobs: 0, ...over }) as PrinterWithOwner
  const petg = [{ id: 'f', filename: 'a.stl', quantity: 1, material: 'PETG' }] as PrintJobFile[]

  it('preselects the machine that fits, and says why the others do not', () => {
    const ranked = rankMachines(
      [
        machine('x1c', { materials: ['PLA', 'TPU'] }),
        machine('full', { materials: ['PETG'], open_jobs: 2 }),
        machine('mk4', { materials: ['PETG', 'PLA'], open_jobs: 1 }),
      ],
      petg
    )
    expect(ranked.map((m) => [m.printer.id, m.ok])).toEqual([
      ['mk4', true],
      ['x1c', false],
      ['full', false],
    ])
    expect(ranked[1]!.why).toEqual(['No PETG listed'])
    expect(ranked[2]!.why).toEqual(['No free slot'])
  })

  it('breaks a tie on free slots, and checks no material a part does not name', () => {
    const ranked = rankMachines(
      [machine('busy', { open_jobs: 1 }), machine('idle', {})],
      [{ id: 'f', filename: 'a.stl', quantity: 1, material: null }] as PrintJobFile[]
    )
    expect(ranked.map((m) => m.printer.id)).toEqual(['idle', 'busy'])
    expect(ranked.every((m) => m.ok)).toBe(true)
  })
})
