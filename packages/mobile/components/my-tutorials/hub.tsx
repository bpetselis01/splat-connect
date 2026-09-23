// packages/mobile/components/my-tutorials/hub.tsx
//
// The guide editor's front door, and its progress display.
//
// This replaces a six-pill horizontal rail. The rail said where you were and
// never how much was left, and the Review step it led to joined the gaps into
// prose — so the one screen that knew what was wrong could not take you to
// where it was fixed. Here every gap getMissingFields reports is a row you can
// tap, and Submit sits under the count that gates it.
import { useCallback, useState, type ComponentProps } from 'react'
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { useDraft } from '../../lib/use-tutorial-draft'
import {
  getMissingFields,
  sectionsFor,
  sectionSummary,
  SECTION_LABEL,
  type SectionId,
} from '../../lib/tutorial-sections'
import { relativeTime } from '../../lib/notifications'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { ListSection, Pill, StagePill } from '../list/list-kit'
import { TUTORIAL_STAGE } from '../list/stage'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

const SECTION_ICON: Record<SectionId, ComponentProps<typeof Ionicons>['name']> = {
  details: 'document-text-outline',
  steps: 'list-outline',
  safety: 'shield-checkmark-outline',
  parts: 'hardware-chip-outline',
  tools: 'construct-outline',
  files: 'folder-open-outline',
  stl: 'cube-outline',
}

const STATUS_WORD = { draft: 'Draft', pending: 'Submitted', approved: 'Approved', rejected: 'Returned' } as const

/** "saved 2 minutes ago" — nothing when the timestamp does not parse. */
function savedAgo(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return ''
  return ` · saved ${relativeTime(iso)}`
}

/** Set when the draft came from "Start from a PDF" (app/(tabs)/guides/new.tsx). */
export interface FromPdf {
  /** The steps endpoint answered 404, so the PDF's steps were not saved. */
  stepsLater: boolean
  /** Sections createGuideFromPdfDraft could not save. */
  missed: string[]
}

export function TutorialHub({ id, justCreated, fromPdf }: { id: string; justCreated?: boolean; fromPdf?: FromPdf }) {
  const router = useRouter()
  const { tutorial, loading, loadError, saveNow, saveState } = useDraft()
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteDismissed, setNoteDismissed] = useState(false)
  // Unlike the arrival note this one stays until dismissed: it asks the author
  // to check every section, which is exactly the trip that would clear the other.
  const [pdfNoteDismissed, setPdfNoteDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // The note is for the moment of arrival, not for the whole session. It keys
  // off a route param, and a route param outlives every trip into a section and
  // back — so it used to still be sitting above the checklist at submit time,
  // telling someone who had just finished a complete guide to come back and
  // finish it later. Opening any section is proof the message landed.
  useFocusEffect(
    useCallback(() => {
      return () => setNoteDismissed(true)
    }, [])
  )

  if (loading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  if (loadError || !tutorial) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this guide."
          hint="Check your connection and try again."
        />
      </Screen>
    )
  }

  const missing = getMissingFields(tutorial)
  const sections = sectionsFor(tutorial.kind)
  const incomplete = new Set(missing.map((g) => g.section))
  const ready = sections.filter((s) => !incomplete.has(s)).length
  const isDraft = tutorial.status === 'draft'

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await saveNow({ status: 'pending' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete() {
    setMenuOpen(false)
    Alert.alert('Delete this draft?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/tutorials/${id}`)
            router.replace('/tutorials')
          } catch (err) {
            console.error('[TutorialHub] delete failed:', err)
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <View style={styles.headCard}>
        <View style={styles.headTop}>
          <StagePill stage={TUTORIAL_STAGE[tutorial.status]} />
          <Text style={styles.headState} numberOfLines={1}>
            {saveState === 'saving' ? `${STATUS_WORD[tutorial.status]} · saving` : `${STATUS_WORD[tutorial.status]}${savedAgo(tutorial.updated_at)}`}
          </Text>
        </View>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>
            {tutorial.title || 'Untitled guide'}
          </Text>
            <Pressable
              testID="hub-menu-trigger"
              accessibilityRole="button"
              accessibilityLabel="More actions"
              onPress={() => setMenuOpen((o) => !o)}
              style={styles.kebab}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.ink} />
            </Pressable>
        </View>
        <View
          style={styles.bar}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: sections.length, now: ready }}
        >
          <View testID="hub-progress-fill" style={[styles.barFill, { width: `${(ready / sections.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {ready} of {sections.length} sections complete
        </Text>
      </View>

      {menuOpen ? (
        <View style={styles.menu}>
          <Pressable
            testID="hub-menu-my-tutorials"
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false)
              router.replace('/tutorials')
            }}
            style={styles.menuItem}
          >
            <Text style={styles.menuText}>My tutorials</Text>
          </Pressable>
          {/* The reader's view of your own guide, before you ask anyone to
              review it. The route already exists — the Files section opens it
              for the PDF — so this was only ever a missing entry point. */}
          <Pressable
            testID="hub-menu-preview"
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false)
              router.push({ pathname: '/guides/[id]', params: { id } })
            }}
            style={[styles.menuItem, !isDraft && styles.menuItemLast]}
          >
            <Text style={styles.menuText}>Preview as a reader</Text>
          </Pressable>
          {/* Rendered only on a draft. RLS refuses the delete on any other
              status, so a control here would be one that cannot work — and
              "how do I enable it?" has no answer worth giving. */}
          {isDraft ? (
            <Pressable
              testID="hub-menu-delete"
              accessibilityRole="button"
              onPress={handleDelete}
              style={[styles.menuItem, styles.menuItemLast]}
            >
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete draft</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {fromPdf && !pdfNoteDismissed ? (
        <View testID="hub-pdf-note" style={styles.note}>
          <View style={styles.noteText}>
            <Text style={styles.noteTitle}>Filled in from your PDF</Text>
            <Text style={styles.noteBody}>
              Check every section before you submit — it is a best guess from the PDF&apos;s text, and
              photos inside the PDF were not copied.
              {fromPdf.stepsLater ? ' The steps could not be saved yet; add them in Steps.' : ''}
              {fromPdf.missed.length ? ` Could not save: ${fromPdf.missed.join(', ')}.` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => setPdfNoteDismissed(true)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.colors.ink} />
          </Pressable>
        </View>
      ) : justCreated && !noteDismissed ? (
        <View testID="hub-created-note" style={styles.note}>
          <View style={styles.noteText}>
            <Text style={styles.noteTitle}>Draft saved</Text>
            <Text style={styles.noteBody}>
              Finish it now, or come back any time - it&apos;s waiting in My tutorials.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => setNoteDismissed(true)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.colors.ink} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rows}>
        {sections.map((section) => {
          const done = section === 'steps' ? (tutorial.steps?.length ?? 0) > 0 : !incomplete.has(section)
          // Steps are optional (080): an empty list is an invitation, not a gap.
          const optionalEmpty = section === 'steps' && !done
          return (
            <Pressable
              key={section}
              testID={`hub-row-${section}`}
              accessibilityRole="button"
              accessibilityLabel={`${SECTION_LABEL[section]}. ${sectionSummary(section, tutorial)}`}
              onPress={() => router.push(`/tutorials/${id}/${section}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={SECTION_ICON[section]} size={20} color={theme.colors.primaryDeep} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{SECTION_LABEL[section]}</Text>
                <Text style={styles.rowSummary}>{sectionSummary(section, tutorial)}</Text>
              </View>
              {done ? (
                <Ionicons testID={`hub-done-${section}`} name="checkmark-circle" size={22} color={theme.colors.success} />
              ) : optionalEmpty ? (
                <Pill label="Empty" bg={theme.colors.honeySoft} />
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </Pressable>
          )
        })}

        {/* Read-only facts, not actions — so they sit under the checklist
            rather than in the menu. Backing is a second fetch on web and is not
            one here: "ask on the web" is the whole of what mobile can say about
            it, and a request would be a round trip to say so. */}
        <ListSection style={styles.moreHeading}>More</ListSection>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Backed by</Text>
          <Text style={styles.moreValue}>Ask on the web</Text>
        </View>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Collaborators</Text>
          <Text style={styles.moreValue}>
            {tutorial.tutorial_contributors.map((c) => c.profiles.name).join(', ') || 'Just you'}
            {' - edit on the web'}
          </Text>
        </View>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Recommendations</Text>
          <Text style={styles.moreValue}>
            {tutorial.tutorial_recommendations.length} of 3 - edit on the web
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          {/* The reader's view of your own guide, before you ask anyone to
              review it — the same route the menu's entry opens. */}
          <Button
            testID="hub-preview"
            label="Preview"
            variant="secondary"
            onPress={() => router.push({ pathname: '/guides/[id]', params: { id } })}
            style={styles.footerButton}
          />
          <Button
            testID="hub-submit"
            label="Submit"
            accessibilityLabel="Submit for review"
            variant="primary"
            onPress={handleSubmit}
            disabled={missing.length > 0 || !isDraft}
            loading={submitting}
            style={styles.footerButton}
          />
        </View>
        <Text style={styles.footnote}>
          {tutorial.status === 'pending'
            ? 'Submitted - waiting for review'
            : tutorial.status === 'approved'
              ? 'Approved - in Guides'
              : missing.length > 0
                ? `${missing.length} thing${missing.length === 1 ? '' : 's'} still needed`
                : 'Everything is ready'}
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  // The board's header card: stage and save state, the title, the bar.
  headCard: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing(4),
    ...theme.shadow(2),
  },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  headState: {
    flex: 1,
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  title: {
    flex: 1,
    fontFamily: theme.fonts.display,
    fontSize: theme.type.heading,
    lineHeight: 24,
    color: theme.colors.ink,
  },
  bar: {
    height: 8,
    marginTop: theme.spacing(3),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: theme.radii.pill, backgroundColor: theme.colors.success },
  progressText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 12.5,
    color: theme.colors.muted,
    marginTop: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field + 2,
    ...theme.shadow(1),
  },
  rowPressed: { transform: [{ scale: 0.98 }] },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.field - 2,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: 15, color: theme.colors.ink },
  moreHeading: { marginTop: theme.spacing(5) },
  footer: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(2) },
  footerButtons: { flexDirection: 'row', gap: theme.spacing(3) },
  footerButton: { flex: 1, borderRadius: theme.radii.pill, minHeight: 50 },


  kebab: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
  },
  menu: {
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing(3),
    overflow: 'hidden',
    ...theme.shadow(2),
  },
  menuItem: {
    padding: theme.spacing(3),
    borderBottomWidth: theme.border.hairline,
    borderBottomColor: theme.colors.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  menuTextDanger: { color: theme.colors.danger },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.mintSoft,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    ...theme.shadow(1),
  },
  noteText: { flex: 1 },
  noteTitle: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.label,
    color: theme.colors.ink,
  },
  noteBody: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
    lineHeight: 18,
  },


  rows: { gap: theme.spacing(2), paddingBottom: theme.spacing(4) },


  rowText: { flex: 1 },
  rowSummary: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },

  moreRow: { marginBottom: theme.spacing(3) },
  moreLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.ink,
  },
  moreValue: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  footnote: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing(2),
  },
})
