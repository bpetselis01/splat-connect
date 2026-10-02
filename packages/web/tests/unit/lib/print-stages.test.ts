import { describe, it, expect } from 'vitest'
import type { ToyTransactionDetail } from '@splat-connect/types'
import { answerBy, shortDate } from '@splat-connect/types'
import { printStages, printStageFacts } from '@/lib/print-stages'

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()
const tx = (over: Partial<ToyTransactionDetail>) =>
  ({
    status: 'requested', type: 'print', owner_confirmed_at: null, requester_confirmed_at: null, printing_started_at: null, ready_at: null,
    decline_reason: null, created_at: ago(1), updated_at: ago(1), print_files: [], tutorial_title: 'Mount', printer: null,
    ...over,
  }) as ToyTransactionDetail

describe('a waiting print request', () => {
  it('says when the printer has to answer by', () => {
    const t = tx({})
    expect(printStageFacts(t, false).facts).toContainEqual({ label: 'Answer by', value: shortDate(answerBy(t.created_at)) })
    expect(printStages(t)[0].state).toBe('now')
  })
  it('reads Expired after seven days, on the rail and in the facts', () => {
    const t = tx({ created_at: ago(8) })
    expect(printStages(t)[1]).toEqual({ key: 'accepted', label: 'Accepted', caption: 'Expired', state: 'stop' })
    expect(printStageFacts(t, true).facts).toContainEqual({ label: 'Answer by', value: `Expired ${shortDate(answerBy(t.created_at))}` })
  })
})
