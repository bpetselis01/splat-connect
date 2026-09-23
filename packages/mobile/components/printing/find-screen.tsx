// packages/mobile/components/printing/find-screen.tsx
/**
 * Find a printer. Reached from a guide (with ?guide=) or from Explore (without),
 * never a tab.
 *
 * With a guide, this is the first half of a request: pick up to three printers,
 * and the sticky button counts them and opens the request form. Without one it
 * only browses — a request's parts come from a guide's STL files, so there is
 * nothing to send yet, and the screen says where to start instead of offering
 * a Pick that leads nowhere.
 *
 * The board's "Within 10 km" and "Verified" filters are not drawn: a printer row
 * stores a suburb, not a location, and has no verified flag. A filter that
 * filters on nothing is worse than no filter.
 */
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { PrinterWithOwner, StlFile, Tutorial } from '@splat-connect/types'
import { MAX_PRINTERS_PER_REQUEST } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import {
  availability,
  initials,
  isOpen,
  partMaterials,
  partsMeta,
  pickButtonLabel,
  plural,
  togglePick,
} from '../../lib/printing'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

type Guide = Tutorial & { stl_files: StlFile[] }

const TINTS = [theme.colors.mintSoft, theme.colors.accentLight, theme.colors.honeySoft, theme.colors.violetSoft]

export function FindPrinterScreen({ guideId }: { guideId?: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [printers, setPrinters] = useState<PrinterWithOwner[] | null>(null)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [error, setError] = useState(false)
  const [picks, setPicks] = useState<string[]>([])
  const [openOnly, setOpenOnly] = useState(false)
  const [hasMaterial, setHasMaterial] = useState(false)

  useEffect(() => {
    Promise.all([
      apiClient.get<PrinterWithOwner[]>('/api/printers'),
      guideId ? apiClient.get<Guide>(`/api/public/tutorials/${guideId}`) : Promise.resolve(null),
    ])
      .then(([p, g]) => {
        setPrinters(p)
        setGuide(g)
      })
      .catch((err) => {
        console.error('[FindPrinterScreen] load failed:', err)
        setError(true)
      })
  }, [guideId])

  if (error) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load printers." hint="Check your connection and try again." />
      </Screen>
    )
  }
  if (!printers) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  // Your own machines, and your organisations', are not somewhere you send a
  // job — the API refuses it, so they are not offered.
  const ledOrgIds = new Set(caps?.ledOrgs.map((o) => o.id) ?? [])
  const theirs = printers.filter(
    (p) => p.owner_id !== caps?.profile.id && !(p.owner_org_id && ledOrgIds.has(p.owner_org_id))
  )
  const material = (guide && partMaterials(guide.stl_files)[0]) || 'PETG'
  const shown = theirs.filter((p) => (!openOnly || isOpen(p)) && (!hasMaterial || p.materials.includes(material)))
  const canPick = !!guide && guide.stl_files.length > 0

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {guide ? (
          <Card variant="feature" style={styles.guideCard}>
            <View style={styles.guideGlyph}>
              <Ionicons name="cube-outline" size={22} color={theme.colors.primaryDeep} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.guideTitle}>{guide.title}</Text>
              <Text style={styles.meta}>
                {[plural(guide.stl_files.length, 'part'), partsMeta(guide.stl_files), 'filament only']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.guideCard}>
            <View style={styles.flex}>
              <Text style={styles.guideTitle}>Every request starts from a guide</Text>
              <Text style={styles.meta}>
                The printer gets the parts and settings straight from the guide. Open one and tap Ask
                someone to print; come here to see who is printing.
              </Text>
              <Button label="Find a guide" variant="secondary" onPress={() => router.push('/guides')} style={styles.guideButton} />
            </View>
          </Card>
        )}

        {canPick ? (
          <Text style={styles.lede}>
            Pick up to three printers. The first to accept takes the job and the rest are withdrawn for you.
          </Text>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Open now" active={openOnly} onPress={() => setOpenOnly((v) => !v)} />
          <Chip label={`Has ${material}`} active={hasMaterial} onPress={() => setHasMaterial((v) => !v)} />
        </ScrollView>

        <Text style={styles.eyebrow}>{plural(shown.length, 'printer')}</Text>

        {shown.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={theirs.length ? 'No printer matches' : 'Nobody has listed a printer yet'}
            hint={theirs.length ? 'Loosen a filter — most parts print fine on any open machine.' : undefined}
          >
            {theirs.length ? (
              <Button
                label="Clear filters"
                variant="secondary"
                onPress={() => {
                  setOpenOnly(false)
                  setHasMaterial(false)
                }}
                style={styles.clear}
              />
            ) : null}
          </EmptyState>
        ) : (
          shown.map((p, i) => {
            const who = p.org_name ?? p.owner_name ?? 'A contributor'
            const avail = availability(p)
            const picked = picks.includes(p.id)
            const pickable = isOpen(p) && (picked || picks.length < MAX_PRINTERS_PER_REQUEST)
            return (
              <Card key={p.id} style={[styles.printer, !isOpen(p) && styles.dim]}>
                <View style={styles.printerTop}>
                  <View style={[styles.ini, { backgroundColor: TINTS[i % TINTS.length] }]}>
                    <Text style={styles.iniText}>{initials(who)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.printerName}>{who}</Text>
                    <Text style={styles.meta}>
                      {[p.owner_org_id ? 'Organisation' : 'Contributor', [p.suburb, p.state].filter(Boolean).join(' ') || null, p.name]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Badge status={avail.tone} label={avail.label} />
                </View>
                <View style={styles.tags}>
                  {p.materials.map((m) => (
                    <Text key={m} style={styles.tag}>
                      {m}
                    </Text>
                  ))}
                  <Text style={styles.tag}>{`${p.bed_x} mm`}</Text>
                </View>
                {canPick ? (
                  <Button
                    label={picked ? 'Picked' : 'Pick'}
                    variant={picked ? 'primary' : 'secondary'}
                    disabled={!pickable}
                    accessibilityLabel={`${picked ? 'Unpick' : 'Pick'} ${who}`}
                    onPress={() => setPicks((cur) => togglePick(cur, p.id))}
                  />
                ) : null}
              </Card>
            )
          })
        )}

        <AnimatedPressable
          onPress={() => router.push('/printing/basics')}
          accessibilityRole="button"
          accessibilityLabel="New to printing? What PETG, infill and a bed size mean."
          style={styles.basics}
        >
          <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.printerName}>New to printing?</Text>
            <Text style={styles.meta}>What PETG, infill and a bed size mean.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </AnimatedPressable>
      </ScrollView>

      {canPick ? (
        <View style={styles.footer}>
          <Button
            label={pickButtonLabel(picks.length)}
            disabled={picks.length === 0}
            onPress={() =>
              router.push({ pathname: '/printing/request', params: { guide: guide!.id, printers: picks.join(',') } })
            }
          />
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  guideCard: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(4) },
  guideGlyph: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  guideButton: { marginTop: theme.spacing(3) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  chips: { gap: theme.spacing(2) },
  eyebrow: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  clear: { marginTop: theme.spacing(4), paddingHorizontal: theme.spacing(6) },
  printer: { gap: theme.spacing(3), padding: theme.spacing(4) },
  dim: { opacity: 0.55 },
  printerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(3) },
  ini: { width: 46, height: 46, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center' },
  iniText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  printerName: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  meta: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginTop: 2,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  tag: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  basics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  footer: {
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing(3),
  },
})
