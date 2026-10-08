// packages/mobile/components/my-tutorials/sections/suits-section.tsx
//
// Optional (128): no gap ever names it, so it never blocks submit. Saves
// through the draft like every section; a value the API refuses shows the
// API's sentence.
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
  if (!tutorial) return null
  const change = (next: SuitsForm) => {
    setForm(next)
    save({ ...suitsPayload(next, true) })
  }
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SuitsFields value={form} onChange={change} guide />
        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section="suits" />
    </Screen>
  )
}
