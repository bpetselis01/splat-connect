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
import type { MapItem, MapKind, MapPlace } from '@splat-connect/types'
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
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ListSection } from '../list/list-kit'
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
  // The whole point, as the mockup's sheet lists it, with the tapped dot first.
  const open = openPlace && {
    ...openPlace,
    items: [...openPlace.items].sort((a, b) => Number(itemKey(b) === selected?.item) - Number(itemKey(a) === selected?.item)),
  }
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
      <PlaceRow
        key={itemKey(i)}
        item={i}
        meta={[itemMeta(i), list ? [p.address, p.suburb].filter(Boolean).join(', ') : null].filter(Boolean).join(' · ')}
        km={kmLabel(p.km)}
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
      <ScrollView style={styles.list} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: topHeight + theme.spacing(3), paddingBottom: bottom + 64, paddingHorizontal: theme.spacing(4) }}>
        {places && total === 0 ? (
          <EmptyState icon="map-outline" title="Nothing here" hint="Turn a layer back on, or clear the filters." />
        ) : (
          BANDS.map(([label, test]) => {
            const band = shown.filter((p) => test(p.km))
            if (!band.length) return null
            return (
              <View key={label}>
                {postcode ? <ListSection style={styles.band}>{label}</ListSection> : null}
                <View style={styles.card}>{band.map(row)}</View>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips}>
          {KIND_ORDER.map((k) => (
            <LayerChip key={k} kind={k} on={kinds.has(k)} onPress={() => toggleKind(k)} />
          ))}
        </ScrollView>
      </View>

      {open ? (
        <View style={[styles.sheet, { paddingBottom: bottom }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {open.suburb}
              <Text style={styles.sheetSub}>
                {'  '}
                {[open.state, open.km === 0 ? 'your postcode' : kmLabel(open.km)].filter(Boolean).join(' · ')}
              </Text>
            </Text>
            <Pressable onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={16} color={theme.colors.muted} />
            </Pressable>
          </View>
          {open.address ? <Text style={styles.sheetAddress}>{open.address}</Text> : null}
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
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={() => setFiltersOpen(false)} accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={16} color={theme.colors.muted} />
            </Pressable>
          </View>
          {postcode ? (
            <View style={styles.group}>
              <GroupLabel label="Distance" hint={`from ${postcode}`} />
              <View style={styles.opts} accessibilityRole="radiogroup">
                {[null, ...DISTANCES].map((d) => (
                  <Option key={String(d)} radio label={d ? `${d} km` : 'Any'} on={draft.within === d} onPress={() => setDraft({ ...draft, within: d })} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.group}>
            <GroupLabel label="Filament" hint="printers and drop-offs" />
            <View style={styles.opts}>
              {MATERIALS.map((m) => (
                <Option
                  key={m}
                  label={m}
                  on={draft.materials.includes(m)}
                  onPress={() =>
                    setDraft({ ...draft, materials: draft.materials.includes(m) ? draft.materials.filter((x) => x !== m) : [...draft.materials, m] })
                  }
                />
              ))}
            </View>
          </View>
          <View style={styles.group}>
            <GroupLabel label="Events" />
            <View style={styles.opts} accessibilityRole="radiogroup">
              {WHEN.map(([w, label]) => (
                <Option key={w} radio label={label} on={draft.when === w} onPress={() => setDraft({ ...draft, when: w })} />
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => setDraft(NO_FILTERS)} accessibilityRole="button" hitSlop={8} style={styles.clear}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
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

/** A layer toggle: white with its colour dot when on, sunken grey when off. */
function LayerChip({ kind, on, onPress }: { kind: MapKind; on: boolean; onPress: () => void }) {
  const k = KINDS[kind]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={k.label}
      style={[styles.layer, !on && styles.layerOff]}
    >
      <View style={[styles.layerDot, { backgroundColor: on ? k.color : theme.colors.muted }]}>
        <Ionicons name={k.icon} size={11} color={theme.colors.surface} />
      </View>
      <Text style={[styles.layerText, !on && styles.layerTextOff]}>{k.label}</Text>
    </Pressable>
  )
}

/** One item in the pin's sheet and the list: tinted icon tile, title, kind and detail, distance. */
function PlaceRow({ item, meta, km, onPress }: { item: MapItem; meta: string; km: string | null; onPress: () => void }) {
  const k = KINDS[item.kind]
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.tile, { backgroundColor: k.soft }]}>
        <Ionicons name={k.icon} size={20} color={k.color} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {km ? <Text style={styles.km}>{km}</Text> : null}
    </Pressable>
  )
}

function GroupLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupLabel}>{label}</Text>
      {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
    </View>
  )
}

/** A filter option: outlined, ink when chosen. */
function Option({ label, on, onPress, radio }: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { checked: on } : { selected: on }}
      style={[styles.option, on && styles.optionOn]}
    >
      <Text style={[styles.optionText, on && styles.optionTextOn]}>{label}</Text>
    </Pressable>
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
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    paddingHorizontal: theme.spacing(2),
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(2.5), paddingHorizontal: theme.spacing(1), borderRadius: theme.radii.field },
  rowPressed: { backgroundColor: theme.colors.background },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: 15, lineHeight: 19, color: theme.colors.ink },
  rowMeta: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 17, color: theme.colors.muted, marginTop: 2 },
  layer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingLeft: 8,
    paddingRight: 13,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  layerOff: { backgroundColor: theme.colors.surfaceSunken, shadowOpacity: 0, elevation: 0 },
  layerDot: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  layerText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  layerTextOff: { color: theme.colors.muted },
  handle: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: theme.colors.muted, opacity: 0.3, marginBottom: theme.spacing(2) },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing(2) },
  groupHint: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted },
  option: {
    minHeight: 36,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  optionText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  optionTextOn: { color: theme.colors.surface },
  clear: { paddingHorizontal: theme.spacing(3), minHeight: 44, justifyContent: 'center' },
  clearText: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.ink, textDecorationLine: 'underline' },
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
  // Room inside the scroll view for the chips' shadows, which it would clip.
  chipRow: { marginHorizontal: -theme.spacing(4), marginVertical: -theme.spacing(2) },
  chips: { gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(2) },

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
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '60%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(3),
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(1) },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink, flexShrink: 1 },
  sheetSub: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  sheetList: { flexGrow: 0 },
  sheetAddress: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: -theme.spacing(1), marginBottom: theme.spacing(1) },
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
