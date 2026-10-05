// packages/mobile/components/guides/guide-parts.tsx
//
// The Parts & tools tab's parts: tick each one as it is gathered (kept on the
// device, per guide, like the tools), its price, where to buy it, and the
// total with when the prices were checked.
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { checkedOn, formatCents, partsTotalCents, type BuyLink, type Part } from '@splat-connect/types'
import { ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'

/** "Jaycar · Core Electronics", each opening its shop. */
export function BuyLinks({ links }: { links: BuyLink[] }) {
  if (!links.length) return null
  return (
    <View style={styles.links}>
      {links.map((l) => (
        <Text key={l.url} accessibilityRole="link" onPress={() => void Linking.openURL(l.url)} style={styles.link}>
          {l.label}
        </Text>
      ))}
    </View>
  )
}

export function GuideParts({ tutorialId, parts, pricesCheckedOn }: { tutorialId: string; parts: Part[]; pricesCheckedOn: string | null | undefined }) {
  const { ticked, toggle } = useDeviceTicks(ticksKey('parts', tutorialId), parts.map((p) => p.id))
  const total = partsTotalCents(parts)
  const got = parts.filter((p) => ticked.has(p.id)).length

  return (
    <Section title="Parts" hint="What you'll need to buy or salvage. Tick each one as you gather it.">
      {parts.length ? <Text style={styles.count}>{`${got} of ${parts.length} gathered`}</Text> : null}
      {parts.length ? (
        parts.map((p) => {
          const on = ticked.has(p.id)
          return (
            <View key={p.id} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={on ? `${p.name}: not gathered yet` : `${p.name}: gathered`}
                onPress={() => toggle(p.id)}
                hitSlop={8}
                style={[styles.tick, on && styles.tickOn]}
              >
                <Ionicons name={on ? 'checkmark' : 'ellipse-outline'} size={16} color={on ? theme.colors.onColor : theme.colors.muted} />
              </Pressable>
              <View style={styles.rowText}>
                <Text style={[styles.name, on && styles.gathered]}>{`${p.name} ×${p.quantity}${p.is_optional ? ' (optional)' : ''}`}</Text>
                <BuyLinks links={p.buy_links ?? []} />
              </View>
              {p.price_cents != null ? <Text style={styles.cost}>{formatCents(p.price_cents)}</Text> : null}
            </View>
          )
        })
      ) : (
        <Text style={styles.name}>No parts listed.</Text>
      )}
      {total != null ? (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.cost}>{formatCents(total)}</Text>
          </View>
          {pricesCheckedOn ? <Text style={styles.checked}>{`Prices checked ${checkedOn(pricesCheckedOn)}`}</Text> : null}
        </>
      ) : null}
    </Section>
  )
}

const styles = StyleSheet.create({
  count: { alignSelf: 'flex-start', fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2, marginBottom: theme.spacing(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: theme.border.hairline, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  gathered: { textDecorationLine: 'line-through', color: theme.colors.muted },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) },
  link: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDark, textDecorationLine: 'underline' },
  cost: { fontFamily: theme.fonts.numeral, fontSize: theme.type.caption, color: theme.colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, marginTop: theme.spacing(2) },
  totalLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  checked: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
})
