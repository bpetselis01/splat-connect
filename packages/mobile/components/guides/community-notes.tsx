// packages/mobile/components/guides/community-notes.tsx
//
// The guide's Feedback tab (spec 2026-10-07): a composer bar that opens the
// FeedbackSheet, filter chips, pinned notes as Fix cards, then one row per
// note with everything a viewer can do behind ⋯. Report targets the note.
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { View, Text, Image, Pressable, Modal, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { initials } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { relativeTime } from '../../lib/notifications'
import { noteSummary, stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'
import { PhotoViewer } from '../ui/PhotoViewer'
import { ReportProblem } from '../reports/report-problem'
import { FeedbackSheet } from './feedback-sheet'

type Props = {
  tutorialId: string
  guideTitle: string
  authorName: string
  steps: TutorialStep[]
  notes: GuideNote[]
  reload: () => Promise<unknown>
  canPin: boolean
  viewerId: string | null
  viewerName: string | null
  highlightId?: string | null
  onHighlightRow?: (row: ComponentRef<typeof View>) => void
  onPosted?: (note: GuideNote) => void
}

type Filter = 'all' | 'fixes' | 'missing' | number

const isMissing = (n: GuideNote, count: number) => n.step_position == null || n.step_position > count

/** Opens the report sheet as soon as it mounts: the ⋯ menu has already closed. */
// ReportProblem hands a fresh `open` every render and open() resets the sheet,
// so fire exactly once per mount (the key remounts it for each menu choice).
function AutoOpen({ open }: { open: () => void }) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    open()
  }, [open])
  return null
}

function MenuButton({ note, onPress }: { note: GuideNote; onPress: () => void }) {
  return (
    <Pressable testID={`note-menu-${note.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={`More on ${note.author_name}'s note`} hitSlop={8} style={styles.more}>
      <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.muted} />
    </Pressable>
  )
}

export function CommunityNotes({ tutorialId, guideTitle, authorName, steps, notes, reload, canPin, viewerId, viewerName, highlightId, onHighlightRow, onPosted }: Props) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const [filter, setFilter] = useState<Filter>('all')
  const [composer, setComposer] = useState(false)
  const [menuFor, setMenuFor] = useState<GuideNote | null>(null)
  const pendingReport = useRef<GuideNote | null>(null)
  const [reportFor, setReportFor] = useState<{ note: GuideNote; n: number } | null>(null)
  const [viewing, setViewing] = useState<{ uri: string; caption: string | null } | null>(null)
  const [flash, setFlash] = useFlash()
  const [ringed, setRinged] = useState<string | null>(null)
  const summary = noteSummary(notes, steps.length)

  // The ring starts when the highlighted row lays out (a slow reload must not
  // spend it before the row exists) and fades after two seconds.
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringStarted = useRef<string | null>(null)
  useEffect(() => () => { if (ringTimer.current) clearTimeout(ringTimer.current) }, [])
  useEffect(() => { if (!highlightId) ringStarted.current = null }, [highlightId])
  // False on the relayouts the ring itself causes (border on, border off), so
  // the parent scrolls and times the hand-off once, not on each.
  const startRing = (id: string) => {
    if (ringStarted.current === id) return false
    ringStarted.current = id
    setRinged(id)
    if (ringTimer.current) clearTimeout(ringTimer.current)
    ringTimer.current = setTimeout(() => setRinged(null), 2000)
    return true
  }

  const stepsWithNotes = steps.filter((s) => notes.some((n) => n.step_position === s.position))
  const anyMissing = notes.some((n) => isMissing(n, steps.length))
  const shown = notes.filter((n) =>
    filter === 'all' ? true : filter === 'fixes' ? !!n.pinned_at : filter === 'missing' ? isMissing(n, steps.length) : n.step_position === filter
  )
  const fixes = shown.filter((n) => n.pinned_at)
  const rest = shown.filter((n) => !n.pinned_at)

  // A reload can empty the chosen filter (the fix was unpinned) and a hand-off
  // can target a note the filter hides; either way fall back to All.
  // `filter` is read through a ref so the person's own chip tap never re-runs
  // this: only new notes or a new highlight do.
  const filterRef = useRef(filter)
  filterRef.current = filter
  useEffect(() => {
    const filter = filterRef.current
    const matches = (n: GuideNote) =>
      filter === 'all' ? true : filter === 'fixes' ? !!n.pinned_at : filter === 'missing' ? isMissing(n, steps.length) : n.step_position === filter
    const target = highlightId ? notes.find((n) => n.id === highlightId) : undefined
    if (filter !== 'all' && (!notes.some(matches) || (target && !matches(target)))) setFilter('all')
  }, [notes, highlightId, steps.length])

  async function act(path: string, done: string, method: 'post' | 'delete' = 'post') {
    setMenuFor(null)
    try {
      if (method === 'post') await apiClient.post(path, {})
      else await apiClient.delete(path)
      setFlash(done)
      await reload()
    } catch {
      setFlash('That did not work. Try again.')
    }
  }

  const rowRefs = useRef(new Map<string, ComponentRef<typeof View>>())

  const row = (n: GuideNote) => {
    const ring = ringed === n.id
    return (
      <View
        key={n.id}
        testID={`note-row-${n.id}`}
        ref={(r) => { if (r && n.id === highlightId) rowRefs.current.set(n.id, r) }}
        onLayout={() => { const r = rowRefs.current.get(n.id); if (r && n.id === highlightId && startRing(n.id)) onHighlightRow?.(r) }}
        style={[styles.row, n.pinned_at && styles.fix, ring && styles.ring]}
      >
        {n.pinned_at ? (
          <View style={styles.fixHead}>
            <Ionicons name="pin" size={14} color={theme.colors.ink} />
            <Text style={styles.fixHeadText}>{`Fix · approved by ${n.pinned_by_name ? n.pinned_by_name.split(' ')[0] : 'the author'}`}</Text>
            <MenuButton note={n} onPress={() => setMenuFor(n)} />
          </View>
        ) : null}
        <View style={styles.rowMain}>
          {n.pinned_at ? null : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(n.author_name, '?')}</Text></View>
          )}
          <View style={styles.rowBody}>
            {n.pinned_at ? null : (
              <View style={styles.top}>
                <Text style={styles.author}>{n.author_id === viewerId ? 'You' : n.author_name}</Text>
                <Text style={styles.when}>{relativeTime(n.created_at)}</Text>
                <MenuButton note={n} onPress={() => setMenuFor(n)} />
              </View>
            )}
            {n.pinned_at ? (
              <Text style={styles.body}><Text style={styles.strong}>{`${stepLabel(n, steps.length)}. `}</Text><Text>{n.body}</Text></Text>
            ) : (
              <>
                <View style={styles.stepTag}><Text style={styles.stepTagText}>{stepLabel(n, steps.length)}</Text></View>
                <Text style={styles.body}>{n.body}</Text>
              </>
            )}
            {n.pinned_at ? <Text style={styles.when}>{`${n.author_name} · ${relativeTime(n.created_at)}`}</Text> : null}
          </View>
          {n.photo_url ? (
            <Pressable onPress={() => setViewing({ uri: n.photo_url!, caption: n.photo_caption })} accessibilityRole="imagebutton" accessibilityLabel={`Open ${n.author_name}'s photo full screen`}>
              <Image source={{ uri: n.photo_url }} style={styles.thumb} accessibilityLabel={n.photo_caption ?? 'Photo with the note'} />
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  const mine = menuFor ? menuFor.author_id === viewerId : false

  return (
    <View style={styles.wrap}>
      {viewerId === null ? (
        <Pressable onPress={() => router.push('/sign-in')} accessibilityRole="button" style={styles.composer}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.primaryDeep} />
          <Text style={styles.composerText}>Sign in to leave feedback</Text>
        </Pressable>
      ) : (
        <Pressable testID="feedback-composer" onPress={() => setComposer(true)} accessibilityRole="button" accessibilityLabel="Share a fix or a tip" style={styles.composer}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(viewerName ?? '', '?')}</Text></View>
          <Text style={[styles.composerText, styles.flex]}>Share a fix or a tip…</Text>
          <Ionicons name="camera-outline" size={20} color={theme.colors.primaryDeep} />
        </Pressable>
      )}
      <FlashLine message={flash} />

      {notes.length ? (
        <View style={styles.chips}>
          <Chip label={`All ${notes.length}`} active={filter === 'all'} onPress={() => setFilter('all')} testID="feedback-filter-all" />
          {summary.pinned.length ? <Chip label={`Fixes ${summary.pinned.length}`} active={filter === 'fixes'} onPress={() => setFilter('fixes')} testID="feedback-filter-fixes" /> : null}
          {stepsWithNotes.map((s) => (
            <Chip key={s.id} label={`Step ${s.position}`} active={filter === s.position} onPress={() => setFilter(s.position)} testID={`feedback-filter-step-${s.position}`} />
          ))}
          {anyMissing ? <Chip label="Missing" active={filter === 'missing'} onPress={() => setFilter('missing')} testID="feedback-filter-missing" /> : null}
        </View>
      ) : (
        <Text style={styles.empty}>No feedback yet. Built it? Say how it went.</Text>
      )}

      {fixes.map(row)}
      {rest.map(row)}

      <FeedbackSheet
        tutorialId={tutorialId}
        steps={steps}
        authorFirstName={authorName.split(' ')[0] ?? 'The author'}
        open={composer}
        onClose={() => setComposer(false)}
        onPosted={(note) => { void reload(); onPosted?.(note) }}
      />

      <Modal
        testID="note-menu-modal"
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
        onDismiss={() => {
          // iOS drops a Modal presented while another is still dismissing.
          if (Platform.OS !== 'ios' || !pendingReport.current) return
          setReportFor({ note: pendingReport.current, n: Date.now() })
          pendingReport.current = null
        }}
      >
        <Pressable onPress={() => setMenuFor(null)} accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} />
        <View testID="note-menu" style={[styles.menu, { paddingBottom: bottom }]}>
          <View style={styles.grabber} />
          {menuFor ? <Text style={styles.menuTitle}>{`${menuFor.author_id === viewerId ? 'Your' : `${menuFor.author_name}'s`} note on ${stepLabel(menuFor, steps.length)}`}</Text> : null}
          {menuFor && canPin ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${menuFor.id}/${menuFor.pinned_at ? 'unpin' : 'pin'}`, menuFor.pinned_at ? 'Unpinned' : 'Pinned as a fix — shows on its step in build mode')}>
              <Ionicons name="pin-outline" size={20} color={theme.colors.ink} />
              <Text style={styles.menuText}>{menuFor.pinned_at ? 'Unpin' : 'Pin as a fix'}</Text>
            </Pressable>
          ) : null}
          {menuFor && !mine ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => {
              if (Platform.OS === 'ios') pendingReport.current = menuFor
              else setReportFor({ note: menuFor, n: Date.now() })
              setMenuFor(null)
            }}>
              <Ionicons name="flag-outline" size={20} color={theme.colors.ink} />
              <Text style={styles.menuText}>Report this note</Text>
            </Pressable>
          ) : null}
          {menuFor && mine ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${menuFor.id}`, 'Note deleted', 'delete')}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.menuText, styles.danger]}>Delete</Text>
            </Pressable>
          ) : null}
          <Button label="Cancel" variant="secondary" onPress={() => setMenuFor(null)} />
        </View>
      </Modal>

      {reportFor ? (
        <ReportProblem
          key={reportFor.n}
          subjectKind="note"
          subjectId={reportFor.note.id}
          subjectLabel={`${reportFor.note.author_name}'s note on ${guideTitle}`}
          trigger={(open) => <AutoOpen open={open} />}
        />
      ) : null}

      <PhotoViewer photos={viewing ? [viewing] : []} index={viewing ? 0 : null} onClose={() => setViewing(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(3), paddingTop: theme.spacing(3) },
  flex: { flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2), borderRadius: theme.radii.pill, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  composerText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  empty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  row: { paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, gap: theme.spacing(2) },
  fix: { borderTopWidth: 0, borderRadius: theme.radii.panel, backgroundColor: theme.colors.honeySoft, paddingHorizontal: theme.spacing(4) },
  ring: { borderWidth: 2, borderColor: theme.colors.primary, borderTopWidth: 2, borderTopColor: theme.colors.primary, borderRadius: theme.radii.panel, backgroundColor: theme.colors.accentFaint, paddingHorizontal: theme.spacing(3) },
  fixHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  fixHeadText: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  rowMain: { flexDirection: 'row', gap: theme.spacing(3), alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: theme.spacing(1) },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.mintSoft },
  avatarText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  author: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  when: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepTag: { alignSelf: 'flex-start', paddingHorizontal: theme.spacing(2), paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  stepTagText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.primaryDeep },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  strong: { fontFamily: theme.fonts.black },
  thumb: { width: 64, height: 64, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  backdrop: { flex: 1, backgroundColor: theme.colors.scrim },
  menu: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing(4), gap: theme.spacing(2) },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center' },
  menuTitle: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 48, borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  danger: { color: theme.colors.danger },
})
