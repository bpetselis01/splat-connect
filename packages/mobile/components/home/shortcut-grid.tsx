// packages/mobile/components/home/shortcut-grid.tsx
//
// Home's shortcut grid, from the approved mockup: four across, tinted glyphs
// sized to the column (the mockup's 62 on a 322 phone is ~76 on a 393 one), a dashed Add tile last. Tiles are absolutely placed by slot so a drag
// can shift the others out of the way with a spring; reanimated plus a plain
// PanResponder, no gesture-handler. Edit mode wiggles the tiles, badges each
// with a minus, and a tap or a drop opens a small manage menu beside the tile.
import { useEffect, useRef, useState } from 'react'
import { PanResponder, PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import type { Feature } from '../../lib/home-shortcuts'
import { TINT_BG } from './tint'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const COLS = 4
const GAP_X = 6
const GAP_Y = 18
const MAX_GLYPH = 76
const LABEL_LINE = 16
// The most the labels grow with the system text size, so large text cannot break the grid.
const MAX_FONT_SCALE = 1.3
const MENU_W = 196
// Room under the last row for the menu when it opens beside a bottom tile.
const MENU_ROOM = 150

/** Everything about a tile that follows from its column width and the text size. */
export function tileMetrics(cellW: number, fontScale = PixelRatio.getFontScale()) {
  const glyph = Math.min(MAX_GLYPH, Math.round(cellW * 0.88))
  // Glyph, the 6px gap, then two lines of label.
  const labelH = Math.ceil(2 * LABEL_LINE * Math.min(fontScale, MAX_FONT_SCALE))
  const cellH = glyph + 6 + labelH
  return { glyph, radius: Math.round(glyph * 0.32), labelH, cellH, pitchY: cellH + GAP_Y }
}

export function slotPos(slot: number, cellW: number) {
  return { x: (slot % COLS) * (cellW + GAP_X), y: Math.floor(slot / COLS) * tileMetrics(cellW).pitchY }
}

/** The slot nearest a tile's top-left corner, clamped to the tiles that exist. */
export function slotAt(x: number, y: number, cellW: number, count: number) {
  const rows = Math.ceil(count / COLS)
  const col = Math.min(COLS - 1, Math.max(0, Math.round(x / (cellW + GAP_X))))
  const row = Math.min(rows - 1, Math.max(0, Math.round(y / tileMetrics(cellW).pitchY)))
  return Math.min(count - 1, row * COLS + col)
}

export function reorder<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

type TileProps = {
  feature: Feature
  index: number
  slot: number
  cellW: number
  editing: boolean
  dragging: boolean
  count: number
  onPress: () => void
  onLongPress: () => void
  onRemove: () => void
  onDragStart: () => void
  onDragOver: (slot: number) => void
  onDrop: (slot: number) => void
  onMove: (to: number) => void
  onMoveToTop: () => void
}

function Tile(props: TileProps) {
  const { feature, index, slot, cellW, editing, dragging } = props
  const reduced = useReducedMotion()
  const target = slotPos(slot, cellW)
  const m = tileMetrics(cellW)
  const x = useSharedValue(target.x)
  const y = useSharedValue(target.y)
  const lift = useSharedValue(0)
  const phase = useSharedValue(0)
  // The responder is made once; it reads the latest props through this.
  const latest = useRef(props)
  latest.current = props
  const held = useRef(false)
  const start = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (held.current) return
    x.value = withSpring(target.x, theme.motion.settle)
    y.value = withSpring(target.y, theme.motion.settle)
  }, [target.x, target.y, x, y])

  const wiggling = editing && !reduced && !dragging
  useEffect(() => {
    if (wiggling) phase.value = withRepeat(withTiming(1, { duration: 280, easing: Easing.inOut(Easing.ease) }), -1, true)
    else {
      cancelAnimation(phase)
      phase.value = withTiming(0.5, { duration: 100 })
    }
  }, [wiggling, phase])

  const pan = useRef(
    PanResponder.create({
      // Only a real move in edit mode takes the touch from the Pressable, so
      // a plain tap still reaches it.
      onMoveShouldSetPanResponderCapture: (_, g) => latest.current.editing && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const l = latest.current
        held.current = true
        start.current = slotPos(l.slot, l.cellW)
        lift.value = withSpring(1, theme.motion.press)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        l.onDragStart()
      },
      onPanResponderMove: (_, g) => {
        const l = latest.current
        x.value = start.current.x + g.dx
        y.value = start.current.y + g.dy
        l.onDragOver(slotAt(x.value, y.value, l.cellW, l.count))
      },
      onPanResponderRelease: () => {
        const l = latest.current
        const to = slotAt(x.value, y.value, l.cellW, l.count)
        const end = slotPos(to, l.cellW)
        held.current = false
        lift.value = withSpring(0, theme.motion.press)
        x.value = withSpring(end.x, theme.motion.settle)
        y.value = withSpring(end.y, theme.motion.settle)
        l.onDrop(to)
      },
    }),
  ).current

  const placed = useAnimatedStyle(() => ({ left: x.value, top: y.value }))
  const glyph = useAnimatedStyle(() => {
    // Even tiles (1-based) run the other way round, so the grid never wiggles in step.
    const deg = interpolate(phase.value, [0, 1], index % 2 ? [2.2, -2.2] : [-2.2, 2.2])
    return { transform: [{ rotate: `${deg}deg` }, { scale: 1 + 0.14 * lift.value }] }
  })

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[styles.cell, { width: cellW, height: m.cellH, zIndex: dragging ? 10 : 0 }, placed]}
    >
      <AnimatedPressable
        pressScale={0.94}
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={feature.name}
        accessibilityHint={editing ? 'Editing Home. Use the actions to move or remove it.' : undefined}
        accessibilityActions={[
          { name: 'moveEarlier', label: 'Move earlier' },
          { name: 'moveLater', label: 'Move later' },
          { name: 'moveTop', label: 'Move to the top' },
          { name: 'remove', label: 'Remove from Home' },
        ]}
        onAccessibilityAction={(e) => {
          const n = e.nativeEvent.actionName
          if (n === 'moveEarlier') props.onMove(Math.max(0, index - 1))
          else if (n === 'moveLater') props.onMove(Math.min(props.count - 1, index + 1))
          else if (n === 'moveTop') props.onMoveToTop()
          else if (n === 'remove') props.onRemove()
        }}
        style={styles.tile}
      >
        <Animated.View
          testID={`glyph-${feature.id}`}
          style={[
            styles.glyph,
            { width: m.glyph, height: m.glyph, borderRadius: m.radius, backgroundColor: TINT_BG[feature.tint] },
            dragging && styles.glyphLifted,
            glyph,
          ]}
        >
          <Ionicons name={feature.icon} size={32} color={theme.colors.ink} />
        </Animated.View>
        <Text style={[styles.label, { height: m.labelH }]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {feature.name}
        </Text>
      </AnimatedPressable>
      {editing ? (
        <Pressable
          testID={`remove-${feature.id}`}
          onPress={props.onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${feature.name} from Home`}
          hitSlop={8}
          style={styles.minus}
        >
          <Ionicons name="remove" size={14} color={theme.colors.danger} />
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

type Props = {
  features: Feature[]
  editing: boolean
  onOpen: (f: Feature) => void
  onAdd: () => void
  onEnterEdit: () => void
  onRemove: (id: string) => void
  onMove: (id: string, to: number) => void
  onMoveToTop: (id: string) => void
  /** The tile whose manage menu is open. Home owns it so a tap on the page can close it. */
  menuId: string | null
  onMenuId: (id: string | null) => void
  /** True while a tile is held, so the page can stop scrolling under the finger. */
  onDragging?: (on: boolean) => void
}

export function ShortcutGrid({
  features,
  editing,
  onOpen,
  onAdd,
  onEnterEdit,
  onRemove,
  onMove,
  onMoveToTop,
  menuId,
  onMenuId,
  onDragging,
}: Props) {
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null)

  useEffect(() => {
    if (!editing) onMenuId(null)
  }, [editing, onMenuId])

  const cellW = (width - GAP_X * (COLS - 1)) / COLS
  const ids = features.map((f) => f.id)
  const from = drag ? ids.indexOf(drag.id) : -1
  const order = drag ? reorder(ids, from, drag.over) : ids
  const total = features.length + 1
  const rows = Math.ceil(total / COLS)
  const menuFeature = editing && menuId ? features.find((f) => f.id === menuId) : undefined
  const m = tileMetrics(cellW)
  // A last row holding only Add has one line of label, not two.
  const lastRowH = features.length % COLS === 0 ? m.cellH - m.labelH + Math.ceil(LABEL_LINE * Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE)) : m.cellH
  const height = (rows - 1) * m.pitchY + lastRowH + (menuFeature ? MENU_ROOM : 0)

  const closeThen = (fn: () => void) => () => {
    onMenuId(null)
    fn()
  }

  let menu = null
  if (menuFeature) {
    const at = slotPos(features.indexOf(menuFeature), cellW)
    const left = Math.min(width - MENU_W, Math.max(0, at.x + cellW / 2 - MENU_W / 2))
    menu = (
      <View
        accessibilityRole="menu"
        accessibilityLabel="Manage shortcut"
        style={[styles.menu, { top: at.y + m.cellH + 10, left }]}
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <MenuItem icon="eye-outline" label={`Open ${menuFeature.name}`} onPress={closeThen(() => onOpen(menuFeature))} />
        <MenuItem icon="move-outline" label="Move to the top" onPress={closeThen(() => onMoveToTop(menuFeature.id))} />
        <MenuItem
          icon="remove-circle-outline"
          label="Remove from Home"
          danger
          onPress={closeThen(() => onRemove(menuFeature.id))}
        />
      </View>
    )
  }

  return (
    <View testID="shortcut-grid" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: width ? height : 0 }}>
      {width > 0
        ? features.map((f, i) => (
            <Tile
              key={f.id}
              feature={f}
              index={i}
              slot={order.indexOf(f.id)}
              cellW={cellW}
              editing={editing}
              dragging={drag?.id === f.id}
              count={features.length}
              onPress={() => (editing ? onMenuId(f.id) : onOpen(f))}
              onLongPress={() => {
                if (editing) return
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                onEnterEdit()
              }}
              onRemove={() => onRemove(f.id)}
              onDragStart={() => {
                onMenuId(null)
                setDrag({ id: f.id, over: i })
                onDragging?.(true)
              }}
              onDragOver={(over) => setDrag((d) => (d && d.over !== over ? { ...d, over } : d))}
              onDrop={(to) => {
                setDrag(null)
                onDragging?.(false)
                if (to !== i) onMove(f.id, to)
                onMenuId(f.id)
              }}
              onMove={(to) => onMove(f.id, to)}
              onMoveToTop={() => onMoveToTop(f.id)}
            />
          ))
        : null}
      {width > 0 ? (
        <View
          style={[
            styles.cell,
            { width: cellW, height: m.cellH, left: slotPos(features.length, cellW).x, top: slotPos(features.length, cellW).y },
          ]}
        >
          <AnimatedPressable
            pressScale={0.94}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add a shortcut"
            style={styles.tile}
          >
            <View
              testID="glyph-add"
              style={[styles.glyph, { width: m.glyph, height: m.glyph, borderRadius: m.radius }, styles.glyphAdd]}
            >
              <Ionicons name="add" size={32} color={theme.colors.muted} />
            </View>
            <Text style={[styles.label, { height: m.labelH }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Add
            </Text>
          </AnimatedPressable>
        </View>
      ) : null}
      {menu}
    </View>
  )
}

function MenuItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const color = danger ? theme.colors.danger : theme.colors.ink
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" accessibilityLabel={label} style={styles.menuItem}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.menuText, { color }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
  tile: { alignItems: 'center', gap: 6 },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
    // The board's 0 6 16 at .14: the tiles have to stand off the page on a
    // phone in daylight. shadowRadius is half a CSS blur.
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  glyphLifted: { shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  glyphAdd: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, lineHeight: LABEL_LINE, color: theme.colors.ink, textAlign: 'center' },
  minus: {
    position: 'absolute',
    top: -5,
    left: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  menu: {
    position: 'absolute',
    zIndex: 20,
    width: MENU_W,
    padding: 6,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.glass,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    ...theme.shadow(3),
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label },
})
