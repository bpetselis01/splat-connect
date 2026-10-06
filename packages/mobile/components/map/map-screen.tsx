// packages/mobile/components/map/map-screen.tsx
/**
 * The Map tab: toys, printers, events, drop-offs and organisations near you,
 * one pin per suburb (GET /api/public/map). Layer chips and a Filters sheet
 * narrow it; one button flips to the same places as a list, nearest first.
 * Mockup: https://claude.ai/artifact/Q2GMV7emYY35QYtrW8LWtb
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { useFocusEffect, useRouter } from 'expo-router'
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
import { FilterButton, GroupLabel, OptionPill } from '../ui/FilterControls'

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
  // The kinds picked with the chips. None picked shows every kind; picking one
  // shows only it, and more can be added (Byron, 2026-10-05).
  const [picked, setPicked] = useState(() => new Set<MapKind>())
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS)
  const [draft, setDraft] = useState<MapFilters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [list, setList] = useState(false)
  // The tapped dot: its place, and its item.
  const [selected, setSelected] = useState<{ place: string; item?: string } | null>(null)
  const [query, setQuery] = useState('')
  // Leaving the tab clears the search, so a forgotten one cannot hide places
  // the next time the map is opened (Byron, 2026-10-05).
  useFocusEffect(useCallback(() => () => setQuery(''), []))
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
    const filtered = applyFilters(places ?? [], picked.size ? picked : new Set(KIND_ORDER), filters)
    if (!q) return filtered
    return filtered
      .map((p) => (p.suburb.toLowerCase().includes(q) ? p : { ...p, items: p.items.filter((i) => i.title.toLowerCase().includes(q)) }))
      .filter((p) => p.items.length > 0)
  }, [places, picked, filters, query])
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
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setSelected(null)
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

      {filtersOpen ? (
        <Animated.View entering={FadeIn.duration(theme.motion.fast)} exiting={FadeOut.duration(theme.motion.fast)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={() => setFiltersOpen(false)} accessibilityLabel="Close filters" accessibilityRole="button" />
        </Animated.View>
      ) : null}

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
          <FilterButton
            count={count}
            open={filtersOpen}
            onPress={() => {
              if (!filtersOpen) setDraft(filters)
              setFiltersOpen((v) => !v)
              setSelected(null)
            }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips}>
          {KIND_ORDER.map((k) => (
            <LayerChip key={k} kind={k} on={picked.has(k)} onPress={() => toggleKind(k)} />
          ))}
        </ScrollView>
      </View>

      {filtersOpen ? null : open ? (
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
          <Ionicons name={list ? 'map-outline' : 'list'} size={16} color={theme.colors.onInverse} />
          <Text style={styles.toggleText}>{list ? 'Map' : 'List'}</Text>
        </Pressable>
      ) : null}

      {filtersOpen ? (
        <Animated.View
          entering={SlideInDown.duration(theme.motion.base)}
          exiting={SlideOutDown.duration(theme.motion.fast)}
          style={[styles.filterSheet, { paddingBottom: bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable onPress={() => setDraft(NO_FILTERS)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
          </View>
          {postcode ? (
            <View style={styles.group}>
              <GroupLabel label="Distance" hint={`from ${postcode}`} />
              <View style={styles.opts} accessibilityRole="radiogroup">
                {[null, ...DISTANCES].map((d) => (
                  <OptionPill key={String(d)} radio label={d ? `${d} km` : 'Any'} on={draft.within === d} onPress={() => setDraft({ ...draft, within: d })} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.group}>
            <GroupLabel label="Filament" hint="printers and drop-offs" />
            <View style={styles.opts}>
              {MATERIALS.map((m) => (
                <OptionPill
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
                <OptionPill key={w} radio label={label} on={draft.when === w} onPress={() => setDraft({ ...draft, when: w })} />
              ))}
            </View>
          </View>
          <View style={styles.actions}>
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
        </Animated.View>
      ) : null}
    </View>
  )
}

/** A kind filter: white with its colour dot; picked, it takes its kind's tint and edge. */
function LayerChip({ kind, on, onPress }: { kind: MapKind; on: boolean; onPress: () => void }) {
  const k = KINDS[kind]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={k.label}
      style={[styles.layer, on && { backgroundColor: k.soft, borderColor: k.color }]}
    >
      <View style={[styles.layerDot, { backgroundColor: k.color }]}>
        <Ionicons name={k.icon} size={13} color={theme.colors.onColor} />
      </View>
      <Text style={styles.layerText}>{k.label}</Text>
    </Pressable>
  )
}

/** One item in the pin's sheet and the list: tinted icon tile, title, kind and detail, distance. */
function PlaceRow({ item, meta, km, onPress }: { item: MapItem; meta: string; km: string | null; onPress: () => void }) {
  const k = KINDS[item.kind]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.title, meta, km].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.tile, { backgroundColor: k.soft }]}>
        <Ionicons name={k.icon} size={22} color={k.color} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: theme.spacing(3), paddingHorizontal: theme.spacing(1), borderRadius: theme.radii.field },
  rowPressed: { backgroundColor: theme.colors.background },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, lineHeight: 21, color: theme.colors.ink },
  rowMeta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: 2 },
  layer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingLeft: 9,
    paddingRight: 15,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  layerDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  layerText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.muted, opacity: 0.3, marginBottom: theme.spacing(2) },
  clearText: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, textDecorationLine: 'underline' },
  km: { fontFamily: theme.fonts.numeral, fontSize: theme.type.caption, color: theme.colors.muted },

  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2), gap: theme.spacing(2) },
  topSolid: { backgroundColor: theme.colors.background, borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  searchBox: { borderRadius: theme.radii.pill, ...theme.shadow(2) },
  // Room inside the scroll view for the chips' shadows, which it would clip.
  chipRow: { marginHorizontal: -theme.spacing(4), marginVertical: -theme.spacing(2) },
  chips: { gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(2) },

  toggle: {
    position: 'absolute',
    right: theme.spacing(4),
    minHeight: 44,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.inverse,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...theme.shadow(3),
  },
  toggleText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.onInverse },

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

  backdrop: { flex: 1, backgroundColor: theme.colors.scrim },
  filterSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    ...theme.shadow(3),
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.card,
    borderTopRightRadius: theme.radii.card,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(4),
  },
  group: { paddingVertical: theme.spacing(3), borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.border, gap: theme.spacing(2) },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(4) },
})
