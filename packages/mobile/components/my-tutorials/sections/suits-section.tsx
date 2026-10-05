// packages/mobile/components/my-tutorials/sections/suits-section.tsx
//
// Optional (127): no gap ever names it, so it never blocks submit. Saves
// through the draft like every section; a range that fails the bounds is
// caught here, and one the API refuses shows the API's sentence.
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { Screen } from '../../ui/Screen'
import { ErrorRow } from '../../ui/ErrorRow'
import { SuitsFields, suitsForm, suitsPayload, type SuitsForm } from '../../suits/suits-fields'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'

export function SuitsSection() {
  return <DraftGate>{() => <SuitsEditor />}</DraftGate>
}

function SuitsEditor() {
  const { tutorial, save, saveError } = useDraft()
  const [form, setForm] = useState<SuitsForm>(() => suitsForm(tutorial ?? {}))
  const [invalid, setInvalid] = useState<string | null>(null)
  if (!tutorial) return null
  const change = (next: SuitsForm) => {
    setForm(next)
    const payload = suitsPayload(next)
    if ('error' in payload) return setInvalid(payload.error)
    setInvalid(null)
    save(payload)
  }
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        <SuitsFields value={form} onChange={change} />
        <ErrorRow message={invalid ?? saveError} />
      </ScrollView>
      <SectionFooter section="suits" />
    </Screen>
  )
}
