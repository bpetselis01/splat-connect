// packages/mobile/components/guides/guide-tools.tsx
//
// The board's "Tools you'll need": tick the ones you already own (kept on the
// device, per guide), and a way into Tools and materials on Learn.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TOOL_GET_BY_LABEL, type Tool } from '@splat-connect/types'
import { ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { BuyLinks } from './guide-parts'

export function GuideTools({ tutorialId, tools }: { tutorialId: string; tools: Tool[] }) {
  const router = useRouter()
  const { ticked, toggle } = useDeviceTicks(ticksKey('tools', tutorialId), tools.map((t) => t.id))
  const have = tools.filter((t) => ticked.has(t.id)).length

  return (
    <Section title="Tools you'll need">
      {tools.length ? <Text style={styles.count}>{`${have} of ${tools.length} already yours`}</Text> : null}
      <Text style={styles.hint}>Not counted in the parts total — tools are a one-off.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tools and materials on Learn"
        onPress={() => router.push('/explore/learn/tools-and-materials')}
        style={styles.learn}
      >
        <Ionicons name="construct-outline" size={22} color={theme.colors.ink} />
        <Text style={styles.learnText}>
          You may already own most of these — if you&apos;re a seasoned switch adapter, this list is a formality.{' '}
          <Text style={styles.learnLink}>Tools and materials on Learn →</Text>
        </Text>
      </Pressable>
      {tools.length ? (
        tools.map((t) => {
          const owned = ticked.has(t.id)
          return (
            <View key={t.id} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: owned }}
                accessibilityLabel={owned ? `I do not have ${t.name}` : `I already have ${t.name}`}
                onPress={() => toggle(t.id)}
                hitSlop={8}
                style={[styles.tick, owned && styles.tickOn]}
              >
                <Ionicons name={owned ? 'checkmark' : 'ellipse-outline'} size={16} color={owned ? theme.colors.onColor : theme.colors.muted} />
              </Pressable>
              <View style={styles.rowText}>
                <Text style={[styles.name, owned && styles.owned]}>{`${t.name}${t.is_optional ? ' (optional)' : ''}`}</Text>
                {t.note ? <Text style={styles.why}>{t.note}</Text> : null}
                <BuyLinks links={t.buy_links ?? []} />
              </View>
              {t.get_by ? <Text style={styles.tag}>{TOOL_GET_BY_LABEL[t.get_by]}</Text> : null}
            </View>
          )
        })
      ) : (
        <Text style={styles.name}>No tools listed.</Text>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  count: { alignSelf: 'flex-start', fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2 },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginVertical: theme.spacing(2) },
  learn: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, marginBottom: theme.spacing(3) },
  learnText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  learnLink: { fontFamily: theme.fonts.black },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: theme.border.hairline, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  why: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  tag: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2, overflow: 'hidden' },
  owned: { textDecorationLine: 'line-through', color: theme.colors.muted },
})
