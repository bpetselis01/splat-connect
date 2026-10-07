// packages/mobile/lib/use-tutorial-draft.tsx
//
// One owner for every write the guide editor makes.
//
// The sections used to each carry their own copy of three rules: send the
// updated_at the screen last saw (the API's optimistic-concurrency token, which
// 400s without it), re-queue an approved or rejected tutorial to pending (RLS
// only admits contributor updates in draft/pending/rejected), and merge the
// response back before writing again. Six screens is six chances to forget one,
// so they live here instead and a section screen only ever calls save().
//
// The debounce/serialise shape is lib/use-child-profile.ts's, including its
// 250ms: writes queue on one promise chain so a second save always sees the
// updated_at the first established, rather than racing it into a 400.
import { logFailure } from './log'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiMessage } from '@splat-connect/types'
import type { BuyLink, Part, Tool, ToolGetBy, TutorialSafetyNote, TutorialStep, TutorialWithDetails } from '@splat-connect/types'
import { apiClient } from './api-client'

// GET /api/tutorials/:id embeds this join (reviewer/reviewed_for name); it is
// only on that one contributor-facing route, not on the shared type — see
// packages/api/src/routes/tutorials.ts.
type EditorTutorial = TutorialWithDetails & { reviewed_for?: { name: string } | null }

/** One editable row of the parts/tools replace-set. `quantity` is only ever
 *  read for parts — tools leave it undefined and the stepper never renders. */
export interface ItemRow {
  name: string
  quantity?: number
  is_optional: boolean
  buy_links: BuyLink[]
  /** Parts only (086). The line at its quantity, in cents. */
  price_cents?: number | null
  /** Tools only (085). Carried through postItems, or a save erases them. */
  note?: string | null
  get_by?: ToolGetBy | null
}

/** One editable step (080). Blank-bodied rows are never sent, like blank names. */
export interface StepRow {
  title: string | null
  body: string
  photo_url: string | null
  /** 129. Optional tip (≤300) and minutes (1–600). */
  tip?: string | null
  minutes?: number | null
}

/** One editable safety note (090). Blank-titled rows are never sent. */
export interface SafetyNoteRow {
  title: string
  detail: string | null
}

export type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_ERROR = 'Could not save. Your changes are still here - try again.'
const DEBOUNCE_MS = 250
// How long "Saved" stays up before the chip goes quiet again.
const SAVED_VISIBLE_MS = 2000

export interface TutorialDraft {
  tutorial: EditorTutorial | null
  loading: boolean
  loadError: boolean
  saveState: DraftSaveState
  saveError: string | null
  /** Debounced PATCH. Optimistic: the value is on screen before it lands. */
  save: (fields: Record<string, unknown>) => void
  /** Immediate, awaited PATCH — uploads and submit, which have a result to show. */
  saveNow: (fields: Record<string, unknown>) => Promise<void>
  /** Debounced replace-set POST. Blank-named rows are never sent. */
  replaceItems: (noun: 'parts' | 'tools', rows: ItemRow[]) => void
  /** Debounced PUT of the whole step list, in order. */
  replaceSteps: (rows: StepRow[]) => void
  /** Debounced replace-set POST of the author's safety notes. */
  replaceSafetyNotes: (rows: SafetyNoteRow[]) => void
  /** Send anything pending now — called when a section screen is left. */
  flush: () => Promise<void>
  reload: () => void
}

function useTutorialDraft(id: string): TutorialDraft {
  const [tutorial, setTutorial] = useState<EditorTutorial | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveState, setSaveState] = useState<DraftSaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const pendingFields = useRef<Record<string, unknown>>({})
  const pendingItems = useRef<Partial<Record<'parts' | 'tools', ItemRow[]>>>({})
  const pendingSteps = useRef<StepRow[] | null>(null)
  const pendingSafety = useRef<SafetyNoteRow[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  // The token and status the next write must quote. Refs, not state: a write
  // queued behind another needs the value the earlier one established, and
  // reading it off a render-time closure would quote a stale one.
  const token = useRef<string | null>(null)
  const status = useRef<string>('draft')

  useEffect(() => {
    let ignore = false
    const load = apiClient
      .get<EditorTutorial>(`/api/tutorials/${id}`)
      .then((data) => {
        token.current = data.updated_at
        status.current = data.status
        if (!ignore) {
          setTutorial(data)
          setLoadError(false)
        }
      })
      .catch((err) => {
        logFailure('[useTutorialDraft] fetch failed:', err)
        if (!ignore) setLoadError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    writes.current = load
    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  function absorb(updated: Partial<EditorTutorial>) {
    if (updated.updated_at) token.current = updated.updated_at
    if (updated.status) status.current = updated.status
    setTutorial((prev) => (prev ? { ...prev, ...updated } : (updated as EditorTutorial)))
  }

  async function patchNow(fields: Record<string, unknown>) {
    const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
      ...fields,
      updated_at: token.current,
      // RLS refuses a status-preserving update on an approved or rejected row,
      // so an edit there is also a re-submission. Same call web's edit page makes.
      ...(status.current === 'approved' || status.current === 'rejected'
        ? { status: 'pending' as const }
        : {}),
    })
    absorb(updated)
  }

  async function postItems(noun: 'parts' | 'tools', rows: ItemRow[]) {
    const clean = rows.filter((r) => r.name.trim())
    // A link is sent only once it has an address: a half-typed row must not reach the web as a dead link.
    const links = (r: ItemRow) => r.buy_links.filter((l) => l.url.trim())
    if (noun === 'parts') {
      const saved = await apiClient.post<Part[]>(`/api/tutorials/${id}/parts`, {
        parts: clean.map((r) => ({
          name: r.name,
          quantity: r.quantity ?? 1,
          is_optional: r.is_optional,
          buy_links: links(r),
          price_cents: r.price_cents ?? null,
        })),
      })
      setTutorial((prev) => (prev ? { ...prev, parts: saved } : prev))
    } else {
      const saved = await apiClient.post<Tool[]>(`/api/tutorials/${id}/tools`, {
        tools: clean.map((r) => ({ name: r.name, is_optional: r.is_optional, buy_links: links(r), note: r.note ?? null, get_by: r.get_by ?? null })),
      })
      setTutorial((prev) => (prev ? { ...prev, tools: saved } : prev))
    }
  }

  async function putSteps(rows: StepRow[]) {
    const steps = rows
      .filter((r) => r.body.trim())
      .map((r) => ({ title: r.title?.trim() || null, body: r.body, photo_url: r.photo_url, tip: r.tip?.trim() || null, minutes: r.minutes ?? null }))
    const saved = await apiClient.put<TutorialStep[]>(`/api/tutorials/${id}/steps`, { steps })
    setTutorial((prev) => (prev ? { ...prev, steps: saved } : prev))
  }

  async function postSafetyNotes(rows: SafetyNoteRow[]) {
    const safety_notes = rows.filter((r) => r.title.trim()).map((r) => ({ title: r.title, detail: r.detail }))
    const saved = await apiClient.post<TutorialSafetyNote[]>(`/api/tutorials/${id}/safety-notes`, { safety_notes })
    setTutorial((prev) => (prev ? { ...prev, safety_notes: saved } : prev))
  }

  /** Drain whatever is queued, on the one write chain. */
  function drain(): Promise<void> {
    const fields = pendingFields.current
    const items = pendingItems.current
    pendingFields.current = {}
    pendingItems.current = {}
    const steps = pendingSteps.current
    pendingSteps.current = null
    const safety = pendingSafety.current
    pendingSafety.current = null
    const hasFields = Object.keys(fields).length > 0
    const nouns = Object.keys(items) as ('parts' | 'tools')[]
    if (!hasFields && nouns.length === 0 && !steps && !safety) return writes.current as Promise<void>

    writes.current = writes.current
      .then(async () => {
        setSaveState('saving')
        setSaveError(null)
        if (hasFields) await patchNow(fields)
        for (const noun of nouns) await postItems(noun, items[noun] as ItemRow[])
        if (steps) await putSteps(steps)
        if (safety) await postSafetyNotes(safety)
        setSaveState('saved')
        // "Saved" is news, and news goes stale. One provider serves the hub and
        // all six sections, so a chip left reading Saved followed the
        // contributor to the next screen and reported a write they had not made
        // there — Safety greeted you with Saved before you touched it. Clearing
        // it makes the chip say what it means: a save just happened.
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(
          () => setSaveState((s) => (s === 'saved' ? 'idle' : s)),
          SAVED_VISIBLE_MS
        )
      })
      .catch((err) => {
        logFailure('[useTutorialDraft] save failed:', err)
        // The optimistic value stays on screen. Reverting it would throw away
        // typing the contributor can still see and would have to redo.
        // Nor does the server forget it: what failed goes back in the queue
        // under anything newer, for the next save or flush. Two exceptions: a
        // Submit is never re-queued, or the next edit would send it unasked,
        // and neither is a write the server refused as wrong (4xx other than
        // 408/429), which would only fail every later save the same way.
        const status = (err as { status?: number }).status
        const refused = typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
        if (!refused) {
          const { status: _submit, ...retry } = fields
          pendingFields.current = { ...retry, ...pendingFields.current }
          pendingItems.current = { ...items, ...pendingItems.current }
          pendingSteps.current ??= steps
          pendingSafety.current ??= safety
        }
        setSaveState('error')
        // A refused write carries its own sentence (a range out of bounds); anything else is the generic line.
        setSaveError(refused ? apiMessage(err, SAVE_ERROR) : SAVE_ERROR)
      })
    return writes.current as Promise<void>
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(drain, DEBOUNCE_MS)
  }

  function save(fields: Record<string, unknown>) {
    pendingFields.current = { ...pendingFields.current, ...fields }
    setTutorial((prev) => (prev ? ({ ...prev, ...fields } as EditorTutorial) : prev))
    schedule()
  }

  function replaceItems(noun: 'parts' | 'tools', rows: ItemRow[]) {
    pendingItems.current = { ...pendingItems.current, [noun]: rows }
    schedule()
  }

  function replaceSteps(rows: StepRow[]) {
    pendingSteps.current = rows
    schedule()
  }

  function replaceSafetyNotes(rows: SafetyNoteRow[]) {
    pendingSafety.current = rows
    schedule()
  }

  async function saveNow(fields: Record<string, unknown>) {
    pendingFields.current = { ...pendingFields.current, ...fields }
    if (timer.current) clearTimeout(timer.current)
    await drain()
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    await drain()
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  return {
    tutorial,
    loading,
    loadError,
    saveState,
    saveError,
    save,
    saveNow,
    replaceItems,
    replaceSteps,
    replaceSafetyNotes,
    flush,
    reload: () => setReloadKey((k) => k + 1),
  }
}

// The stack shares one instance: the hub and all six sections read and write the
// same draft, so a section's save is already reflected when you go back — no
// refetch on focus, and no second copy to fall out of step with the first.
const DraftContext = createContext<TutorialDraft | null>(null)

export function TutorialDraftProvider({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const draft = useTutorialDraft(id)
  return <DraftContext.Provider value={draft}>{children}</DraftContext.Provider>
}

export function useDraft(): TutorialDraft {
  const draft = useContext(DraftContext)
  if (!draft) throw new Error('useDraft must be used inside a TutorialDraftProvider')
  return draft
}
