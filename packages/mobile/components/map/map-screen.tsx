// packages/mobile/components/map/map-screen.tsx
/**
 * The Map tab: toys, printers, events, drop-offs and organisations near you,
 * one pin per suburb (GET /api/public/map). Layer chips and a Filters sheet
 * narrow it; one button flips to the same places as a list, nearest first.
 * Mockup: https://claude.ai/artifact/Q2GMV7emYY35QYtrW8LWtb
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MapKind, MapPlace } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { nearParam } from '../../lib/near'
import { theme } from '../../lib/theme'
import { tabBarClearance } from '../../lib/tab-bar-layout'
import {
  KINDS, KIND_ORDER, MATERIALS, DISTANCES, NO_FILTERS,
  applyFilters, filterCount, itemKey, itemMeta, itemRoute, placeKey,
  type MapFilters, type When,
} from '../../lib/map-filters'
import { TextField } from '../ui/TextField'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ListRow, ListSection, RowThumb } from '../list/list-kit'
import { MapCanvas } from './MapCanvas'

const WHEN: [When, string][] = [['any', 'Any time'], ['fortnight', 'Next 2 weeks'], ['weekend', 'Weekends']]
const BANDS: [string, (km: number | null) => boolean][] = [
  ['Within 2 km', (km) => km !== null && km <= 2],
  ['2 to 10 km', (km) => km !== null && km > 2 && km <= 10],
  ['Further out', (km) => km === null || km > 10],
]

const kmLabel = (km: number | null) => (km === null ? null : km === 0 ? 'here' : `${km} km`)

export function MapScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { caps, loading: capsLoading } = useCapabilities()
  const postcode = nearParam(caps?.profile.pickup_postcode)

  const [places, setPlaces] = useState<MapPlace[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [kinds, setKinds] = useState(() => new Set<MapKind>(KIND_ORDER))
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS)
  const [draft, setDraft] = useState<MapFilters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [list, setList] = useState(false)
  // The tapped dot: its place, and its item.
  const [selected, setSelected] = useState<{ place: string; item?: string } | null>(null)
  const [query, setQuery] = useState('')
  const [topHeight, setTopHeight] = useState(140)

  const load = useCallback(() => {
    setFailed(false)
    apiClient
      .get<MapPlace[]>(postcode ? `/api/public/map?near=${encodeURIComponent(postcode)}` : '/api/public/map')
      .then(setPlaces)
      .catch(() => setFailed(true))
  }, [postcode])
  useEffect(() => {
    if (!capsLoading) load()
  }, [capsLoading, load])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = applyFilters(places ?? [], kinds, filters)
    if (!q) return filtered
    return filtered
      .map((p) => (p.suburb.toLowerCase().includes(q) ? p : { ...p, items: p.items.filter((i) => i.title.toLowerCase().includes(q)) }))
      .filter((p) => p.items.length > 0)
  }, [places, kinds, filters, query])
  const total = shown.reduce((n, p) => n + p.items.length, 0)
  const openPlace = list || !selected ? undefined : shown.find((p) => placeKey(p) === selected.place)
  const open = openPlace && selected?.item ? { ...openPlace, items: openPlace.items.filter((i) => itemKey(i) === selected.item) } : openPlace
  const count = filterCount(filters)
  const bottom = tabBarClearance(insets.bottom)

  function toggleKind(k: MapKind) {
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const row = (p: MapPlace) =>
    p.items.map((i) => (
      <ListRow
        key={itemKey(i)}
        thumb={<RowThumb glyph={KINDS[i.kind].icon} tint={KINDS[i.kind].soft} />}
        title={i.title}
        meta={[itemMeta(i), list ? p.suburb : null].filter(Boolean).join(' · ')}
        trailing={kmLabel(p.km) ? <Text style={styles.km}>{kmLabel(p.km)}</Text> : null}
        onPress={() => router.push(itemRoute(i) as never)}
      />
    ))

  let body: React.ReactNode
  if (failed) {
    body = (
      <View style={[styles.center, { paddingTop: topHeight }]}>
        <Text style={styles.error}>Could not load the map.</Text>
        <Button label="Try again" variant="ghost" onPress={load} />
      </View>
    )
  } else if (list) {
    body = (
      <ScrollView style={styles.list} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: topHeight, paddingBottom: bottom + 64, paddingHorizontal: theme.spacing(4) }}>
        {places && total === 0 ? (
          <EmptyState icon="map-outline" title="Nothing here" hint="Turn a layer back on, or clear the filters." />
        ) : (
          BANDS.map(([label, test]) => {
            const band = shown.filter((p) => test(p.km))
            if (!band.length) return null
            return (
              <View key={label}>
                {postcode ? <ListSection style={styles.band}>{label}</ListSection> : null}
                <View style={styles.rows}>{band.map(row)}</View>
              </View>
            )
          })
        )}
      </ScrollView>
    )
  } else {
    body = places ? (
      <MapCanvas
        places={shown}
        selected={selected?.item ?? null}
        onSelect={(place, item) => setSelected(place ? { place, item } : null)}
        inset={{ top: topHeight, bottom }}
      />
    ) : (
      <View style={[StyleSheet.absoluteFill, styles.loading]} />
    )
  }

  return (
    <View style={styles.screen}>
      {body}

      <View style={[styles.top, { paddingTop: insets.top + theme.spacing(2) }, list && styles.topSolid]} onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)}>
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <TextField
              search
              icon="search"
              value={query}
              onChangeText={setQuery}
              placeholder={`${postcode ? `Near ${postcode} · ` : ''}${total} ${total === 1 ? 'place' : 'places'}`}
              accessibilityLabel="Search suburbs and places"
              boxStyle={styles.searchBox}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable
            onPress={() => {
              setDraft(filters)
              setFiltersOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={count ? `Filters, ${count} on` : 'Filters'}
            style={[styles.filterButton, count > 0 && styles.filterButtonOn]}
          >
            <Ionicons name="options-outline" size={20} color={count ? theme.colors.surface : theme.colors.ink} />
            {count ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {KIND_ORDER.map((k) => (
            <Chip key={k} variant="filter" swatch={KINDS[k].color} label={KINDS[k].label} active={kinds.has(k)} onPress={() => toggleKind(k)} />
          ))}
        </ScrollView>
      </View>

      {open ? (
        <View style={[styles.sheet, { bottom }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {open.suburb}
              {kmLabel(open.km) ? <Text style={styles.sheetSub}>  {open.km === 0 ? 'your postcode' : kmLabel(open.km)}</Text> : null}
            </Text>
            <Pressable onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={16} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList}>{row(open)}</ScrollView>
        </View>
      ) : !failed ? (
        <Pressable
          onPress={() => {
            setList((v) => !v)
            setSelected(null)
          }}
          accessibilityRole="button"
          style={[styles.toggle, { bottom: bottom - theme.spacing(1) }]}
        >
          <Ionicons name={list ? 'map-outline' : 'list'} size={16} color={theme.colors.surface} />
          <Text style={styles.toggleText}>{list ? 'Map' : 'List'}</Text>
        </Pressable>
      ) : null}

      <Modal visible={filtersOpen} animationType="slide" transparent onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFiltersOpen(false)} accessibilityLabel="Close filters" accessibilityRole="button" />
        <View style={[styles.filterSheet, { paddingBottom: insets.bottom + theme.spacing(4) }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={() => setFiltersOpen(false)} accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={16} color={theme.colors.muted} />
            </Pressable>
          </View>
          {postcode ? (
            <View style={styles.group}>
              <Text style={styles.groupLabel}>Distance from {postcode}</Text>
              <View style={styles.opts} accessibilityRole="radiogroup">
                {[null, ...DISTANCES].map((d) => (
                  <Chip key={String(d)} role="radio" label={d ? `${d} km` : 'Any'} active={draft.within === d} onPress={() => setDraft({ ...draft, within: d })} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Filament, for printers and drop-offs</Text>
            <View style={styles.opts}>
              {MATERIALS.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={draft.materials.includes(m)}
                  onPress={() =>
                    setDraft({ ...draft, materials: draft.materials.includes(m) ? draft.materials.filter((x) => x !== m) : [...draft.materials, m] })
                  }
                />
              ))}
            </View>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Events</Text>
            <View style={styles.opts} accessibilityRole="radiogroup">
              {WHEN.map(([w, label]) => (
                <Chip key={w} role="radio" label={label} active={draft.when === w} onPress={() => setDraft({ ...draft, when: w })} />
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <Button label="Clear all" variant="ghost" onPress={() => setDraft(NO_FILTERS)} />
            <View style={styles.flex}>
              <Button
                label="Show places"
                onPress={() => {
                  setFilters(draft)
                  setFiltersOpen(false)
                  setSelected(null)
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  loading: { backgroundColor: theme.colors.surfaceSunken },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(2) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.danger },
  list: { flex: 1 },
  band: { marginTop: theme.spacing(3) },
  rows: { gap: theme.spacing(2) },
  km: { fontFamily: theme.fonts.numeral, fontSize: 12, color: theme.colors.muted },

  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2), gap: theme.spacing(2) },
  topSolid: { backgroundColor: theme.colors.background, borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  searchBox: { borderRadius: theme.radii.pill, ...theme.shadow(2) },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(2),
  },
  filterButtonOn: { backgroundColor: theme.colors.ink },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.apricot,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.black, fontSize: 11, color: theme.colors.surface },
  chips: { gap: theme.spacing(2), paddingRight: theme.spacing(4) },

  toggle: {
    position: 'absolute',
    right: theme.spacing(4),
    minHeight: 44,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...theme.shadow(3),
  },
  toggleText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.surface },

  sheet: {
    position: 'absolute',
    left: theme.spacing(3),
    right: theme.spacing(3),
    maxHeight: 320,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    padding: theme.spacing(3),
    ...theme.shadow(3),
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(1) },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink, flexShrink: 1 },
  sheetSub: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  sheetList: { flexGrow: 0 },
  close: { width: 32, height: 32, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,37,48,0.4)' },
  filterSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(4),
  },
  group: { paddingVertical: theme.spacing(3), borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.border, gap: theme.spacing(2) },
  groupLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(4) },
})
