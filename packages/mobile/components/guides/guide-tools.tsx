// packages/mobile/components/guides/guide-tools.tsx
//
// The board's "Tools you'll need": tick the ones you already own (kept on the
// device, per guide), and a way into Tools and materials on Learn.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TOOL_GET_BY_LABEL, type Tool } from '@splat-connect/types'
import type { Ticks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { BuyLinks } from './guide-parts'

/** Ticks come from the screen (useGatherTicks), so its counts agree with this list. */
export function GuideTools({ tools, ticks: { ticked, toggle } }: { tools: Tool[]; ticks: Ticks }) {
  const router = useRouter()
  const have = tools.filter((t) => ticked.has(t.id)).length

  return (
    <Section title="Tools">
      {tools.length ? <Text style={styles.count}>{`${have} of ${tools.length} already yours`}</Text> : null}
      <Text style={styles.hint}>
        Not in the parts total.{' '}
        <Text
          accessibilityRole="link"
          accessibilityLabel="Tools and materials on Learn"
          onPress={() => router.push('/explore/learn/tools-and-materials')}
          style={styles.learnLink}
        >
          Tools and materials
        </Text>
      </Text>
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
                hitSlop={6}
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
  learnLink: { fontFamily: theme.fonts.black, color: theme.colors.primaryDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  tick: { width: 32, height: 32, borderRadius: 16, borderWidth: theme.border.hairline, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.text },
  why: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  tag: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2, overflow: 'hidden' },
  owned: { textDecorationLine: 'line-through', color: theme.colors.muted },
})
