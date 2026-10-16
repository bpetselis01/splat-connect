// "3 of 4 done" with a bar, at the top of a section page. It reads the same
// sectionChecks the hub's gap list reads, so the two cannot disagree. Sections
// with no requirements (Who it's for, Worth a look, Collaborators, Backing)
// render nothing.
import { View, Text, StyleSheet } from 'react-native'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { sectionChecks, type SectionId } from '../../../lib/tutorial-sections'
import { theme } from '../../../lib/theme'

export function SectionProgress({ section }: { section: SectionId }) {
  const { tutorial } = useDraft()
  if (!tutorial) return null
  const checks = sectionChecks(tutorial).filter((c) => c.section === section)
  if (!checks.length) return null
  const done = checks.filter((c) => c.done).length
  const left = checks.filter((c) => !c.done)
  const complete = left.length === 0
  return (
    <View testID="section-progress" style={styles.wrap} accessibilityLabel={`${done} of ${checks.length} done`}>
      <View style={styles.top}>
        <Text style={styles.count}>{`${done} of ${checks.length} done`}</Text>
      </View>
      <View style={styles.track}>
        <View
          testID="section-progress-bar"
          style={[styles.fill, { width: `${(done / checks.length) * 100}%`, backgroundColor: complete ? theme.colors.success : theme.colors.primary }]}
        />
      </View>
      <Text style={styles.sub}>{complete ? 'Nothing left here' : `Still needed: ${left.map((c) => c.label).join(' · ')}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing(4) },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(1) },
  count: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  track: { height: 7, borderRadius: 4, backgroundColor: theme.colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
})
