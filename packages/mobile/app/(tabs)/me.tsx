// The fourth tab. Grouped by the things you can do, a count on anything
// waiting, and Explore at the bottom — the board's "Me" (#my_splat): a
// greeting card with the mascot, the money panel when anything is owed, then
// the grouped rows with an icon each.
import { useEffect, useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { buildNav, formatCents, type IconName as NavIcon } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { myRoute } from '../../lib/my-routes'
import { theme } from '../../lib/theme'
import { Screen } from '../../components/ui/Screen'
import { ScreenHeader } from '../../components/ui/ScreenHeader'
import { Mascot } from '../../components/ui/TabHero'

type Glyph = React.ComponentProps<typeof Ionicons>['name']

// buildNav names its icons for web's Phosphor set; these are the Ionicons
// that say the same thing.
const GLYPH: Record<NavIcon, Glyph> = {
  book: 'book-outline',
  toy: 'game-controller-outline',
  printer: 'print-outline',
  building: 'business-outline',
  file: 'document-text-outline',
  box: 'cube-outline',
  clipboard: 'clipboard-outline',
  inbox: 'file-tray-outline',
  shelf: 'library-outline',
  orders: 'receipt-outline',
  user: 'person-outline',
  shield: 'shield-checkmark-outline',
  bell: 'notifications-outline',
  handshake: 'swap-horizontal-outline',
  bookmark: 'heart-outline',
  calendar: 'calendar-outline',
  recycle: 'leaf-outline',
  lightbulb: 'bulb-outline',
  map: 'map-outline',
  chat: 'chatbubbles-outline',
  heart: 'heart-outline',
  wrench: 'construct-outline',
  sparkle: 'sparkles-outline',
  lifebuoy: 'help-buoy-outline',
  shopping: 'bag-outline',
  gift: 'gift-outline',
  switch: 'radio-button-on-outline',
  scales: 'scale-outline',
  users: 'people-outline',
}

// Mobile routes, not web hrefs: these are the Explore stack's own screens.
const EXPLORE: { label: string; href: string; icon: Glyph }[] = [
  { label: 'Learn', href: '/explore/learn', icon: 'school-outline' },
  { label: 'Design challenges', href: '/explore/challenges', icon: 'extension-puzzle-outline' },
  { label: 'Organisations', href: '/toy-library/organisations', icon: 'business-outline' },
  { label: 'About SPLAT', href: '/explore/about', icon: 'information-circle-outline' },
  // Explore's own screen has no tab; this row is the way in.
  { label: 'Everything in Explore', href: '/explore', icon: 'compass-outline' },
]

/** GET /api/exchange-costs/outstanding — web's dashboard money panel. */
type Outstanding = {
  lines: {
    id: string
    transaction_id: string
    description: string
    amount_cents: number
    toy_transactions: { id: string; type: string; toys: { name: string } | null } | null
  }[]
  total_cents: number
  exchange_count: number
}

function Row({
  label,
  icon,
  count,
  soon,
  onPress,
}: {
  label: string
  icon: Glyph
  count?: number
  soon?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={soon}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, soon && styles.soon, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={21} color={theme.colors.primaryDark} />
      <Text style={styles.rowLabel}>{label}</Text>
      {count ? <Text style={styles.count}>{String(count)}</Text> : null}
      {soon ? <Text style={styles.soonTag}>SOON</Text> : null}
    </Pressable>
  )
}

/**
 * "Money you have agreed to" — what web's dashboard shows, on a phone: the
 * total, the sentence that SPLAT never handles it, and the first three lines.
 * Read-only; settling happens on the exchange, where the context is.
 */
function MoneyPanel({ money, onOpen }: { money: Outstanding; onOpen: (transactionId: string) => void }) {
  if (money.lines.length === 0) return null
  const n = money.exchange_count
  return (
    <View style={styles.money}>
      <View>
        <Text style={styles.eyebrow}>Money you have agreed to</Text>
        <Text style={styles.moneyTotal}>{formatCents(money.total_cents)}</Text>
        <Text style={styles.moneySub}>
          Still to settle across {n} {n === 1 ? 'exchange' : 'exchanges'}. SPLAT never handles the money — you pay
          each person directly.
        </Text>
      </View>
      {money.lines.slice(0, 3).map((line) => (
        <Pressable
          key={line.id}
          onPress={() => onOpen(line.transaction_id)}
          accessibilityRole="button"
          accessibilityLabel={`${line.description}, ${formatCents(line.amount_cents)} to settle`}
          style={({ pressed }) => [styles.moneyLine, pressed && styles.pressed]}
        >
          <View style={styles.moneyWhat}>
            <Ionicons name="cash-outline" size={22} color={theme.colors.primaryDark} />
            <View style={styles.flex}>
              <Text style={styles.moneyLineTitle} numberOfLines={1}>
                {line.description}
              </Text>
              <Text style={styles.moneyLineWho} numberOfLines={1}>
                {line.toy_transactions?.toys?.name ?? 'This exchange'}
              </Text>
            </View>
          </View>
          <View style={styles.moneyAmountRow}>
            <Text style={styles.settle}>TO SETTLE</Text>
            <Text style={styles.amount}>{formatCents(line.amount_cents)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

export default function MeTab() {
  const { caps } = useCapabilities()
  const router = useRouter()
  const [money, setMoney] = useState<Outstanding | null>(null)
  const go = (href: string) => () => router.push(href as never)

  useEffect(() => {
    let ignore = false
    // Degrades to absent, as on web: a failed money fetch must not cost
    // somebody the rest of this tab.
    apiClient
      .get<Outstanding>('/api/exchange-costs/outstanding')
      .then((m) => {
        if (!ignore) setMoney(m)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  const waiting = caps?.exchangeActions ?? 0
  const leads = caps?.ledOrgs.map((o) => o.name).join(', ')
  const standing = leads
    ? `Leads ${leads}${waiting ? ` · ${waiting} waiting` : ''}`
    : waiting
      ? `${waiting} waiting on you`
      : null

  return (
    <Screen ownHeader>
      {caps ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="My SPLAT" />
          <View style={styles.hero}>
            <Mascot pose="wave" size={72} />
            <View style={styles.flex}>
              <Text style={styles.name}>Hi, {caps.profile.name.trim().split(/\s+/)[0]}</Text>
              {standing ? <Text style={styles.meta}>{standing}</Text> : null}
            </View>
          </View>
          {money ? <MoneyPanel money={money} onOpen={(id) => router.push(`/exchanges/${id}` as never)} /> : null}
          {buildNav(caps).map((group) => (
            <View key={group.heading} style={styles.group}>
              <Text style={styles.eyebrow}>{group.heading}</Text>
              {group.rows.map((row) => {
                // A web row with no mobile screen yet is SOON here, not a tap
                // that lands back on Me. my-routes.test fails the day one is.
                const to = myRoute(row.href)
                return (
                  <Row
                    key={row.href}
                    label={row.label}
                    icon={GLYPH[row.icon] ?? 'ellipse-outline'}
                    count={row.count}
                    soon={row.soon || to === '/me'}
                    onPress={go(to)}
                  />
                )
              })}
            </View>
          ))}
          <View style={styles.group}>
            <Text style={styles.eyebrow}>Explore</Text>
            {EXPLORE.map((row) => (
              <Row key={row.href} label={row.label} icon={row.icon} onPress={go(row.href)} />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: theme.spacing(8) },
  flex: { flex: 1, minWidth: 0 },
  pressed: { transform: [{ scale: 0.98 }] },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginHorizontal: 2,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentLight,
    ...theme.shadow(2),
  },
  name: { fontFamily: theme.fonts.display, fontSize: 21, lineHeight: 28, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.ink, opacity: 0.75, marginTop: 2 },
  money: {
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  moneyTotal: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 40, color: theme.colors.ink, marginTop: 4 },
  moneySub: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 19, color: theme.colors.muted, marginTop: 2 },
  moneyLine: {
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
  },
  moneyWhat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moneyLineTitle: { fontFamily: theme.fonts.black, fontSize: 13.5, color: theme.colors.ink },
  moneyLineWho: { fontFamily: theme.fonts.semiBold, fontSize: 11.5, color: theme.colors.muted },
  moneyAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  settle: {
    fontFamily: theme.fonts.black,
    fontSize: 10.5,
    color: theme.colors.ink,
    backgroundColor: theme.colors.honeySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  amount: { fontFamily: theme.fonts.numeral, fontSize: 14, color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  group: { gap: 9 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    ...theme.shadow(1),
  },
  soon: { opacity: 0.62 },
  soonTag: { fontFamily: theme.fonts.black, fontSize: 10, letterSpacing: 0.9, color: theme.colors.muted },
  rowLabel: { flex: 1, fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.ink },
  count: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.ink,
    backgroundColor: theme.colors.apricot,
    borderRadius: theme.radii.pill,
    minWidth: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
})
