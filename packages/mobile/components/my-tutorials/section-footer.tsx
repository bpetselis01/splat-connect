// packages/mobile/components/my-tutorials/section-footer.tsx
//
// The pair of controls every section screen ends with.
//
// "Checklist" is the primary and never changes — it is the way back to the hub,
// and on the create path (where the stack has nothing behind the editor) it is
// also the only way out that does not go through the ⋯ menu.
//
// "Next" is a shortcut, not a sequence. It names where it goes and points at
// the next section still missing something (nextIncompleteSection), so a fresh
// draft walks straight through while a contributor who came back to close one
// gap is offered that gap rather than a tour. With nothing left it becomes
// "Review and submit", which returns to the hub — Submit itself stays in
// exactly one place, which is the rule the hub redesign was built on.
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useDraft } from '../../lib/use-tutorial-draft'
import { nextIncompleteSection, SECTION_LABEL, type SectionId } from '../../lib/tutorial-sections'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'

export function SectionFooter({ section }: { section: SectionId }) {
  const router = useRouter()
  const { tutorial, flush } = useDraft()
  if (!tutorial) return null

  const next = nextIncompleteSection(section, tutorial)

  // Every hop flushes first. The debounce is 250ms and a tap beats it easily;
  // the hub reads the same draft, so leaving with a write still queued would
  // show a row that has not caught up with what was just typed.
  const toHub = async () => {
    await flush()
    // Pop rather than push a second copy of the hub onto the stack. Nothing is
    // behind the editor on the create path, hence the fallback.
    if (router.canGoBack()) router.back()
    else router.replace(`/tutorials/${tutorial.id}` as never)
  }

  const toSection = async (to: SectionId) => {
    await flush()
    // replace, not push: sections are siblings, so hopping between them should
    // not deepen the stack — Checklist must stay one back from wherever you are.
    router.replace(`/tutorials/${tutorial.id}/${to}` as never)
  }

  return (
    <View style={styles.footer}>
      <Button
        testID="section-back"
        label="Checklist"
        variant="secondary"
        style={styles.back}
        onPress={toHub}
      />
      <Button
        testID="section-next"
        label={next ? `Next: ${SECTION_LABEL[next]}` : 'Review and submit'}
        variant="accent"
        style={styles.next}
        onPress={() => (next ? toSection(next) : toHub())}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
  },
  // Fixed and narrow so the destination name in "Next" gets the room — "Next:
  // 3D print files" is the longest label this footer ever carries.
  back: { flex: 0, minWidth: 118, paddingHorizontal: theme.spacing(3) },
  next: { flex: 1, paddingHorizontal: theme.spacing(3) },
})
