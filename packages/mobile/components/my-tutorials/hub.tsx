// packages/mobile/components/my-tutorials/hub.tsx
//
// The guide editor's front door, and its progress display.
//
// This replaces a six-pill horizontal rail. The rail said where you were and
// never how much was left, and the Review step it led to joined the gaps into
// prose — so the one screen that knew what was wrong could not take you to
// where it was fixed. Here every gap getMissingFields reports is a row you can
// tap, and Submit sits under the count that gates it.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { useDraft } from '../../lib/use-tutorial-draft'
import {
  getMissingFields,
  sectionsFor,
  sectionSummary,
  SECTION_LABEL,
} from '../../lib/tutorial-sections'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

export function TutorialHub({ id, justCreated }: { id: string; justCreated?: boolean }) {
  const router = useRouter()
  const { tutorial, loading, loadError, saveNow } = useDraft()
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteDismissed, setNoteDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.title}>
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

      {menuOpen ? (
        <View style={styles.menu}>
          <Pressable
            testID="hub-menu-my-tutorials"
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false)
              router.replace('/tutorials')
            }}
            style={[styles.menuItem, !isDraft && styles.menuItemLast]}
          >
            <Text style={styles.menuText}>My tutorials</Text>
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

      {justCreated && !noteDismissed ? (
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
            <Ionicons name="close" size={18} color={theme.colors.mintDeep} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.statusRow}>
        <Badge status={tutorial.status} />
        <Text style={styles.progressText}>
          {ready} of {sections.length} ready
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rows}>
        {sections.map((section) => {
          const done = !incomplete.has(section)
          return (
            <Pressable
              key={section}
              testID={`hub-row-${section}`}
              accessibilityRole="button"
              accessibilityLabel={`${SECTION_LABEL[section]}. ${sectionSummary(section, tutorial)}`}
              onPress={() => router.push(`/tutorials/${id}/${section}`)}
              style={[styles.row, done && styles.rowDone]}
            >
              <View style={[styles.mark, done ? styles.markDone : styles.markTodo]}>
                <Ionicons
                  name={done ? 'checkmark' : 'alert'}
                  size={14}
                  color={done ? theme.colors.ink : theme.colors.apricotDeep}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{SECTION_LABEL[section]}</Text>
                <Text style={styles.rowSummary}>{sectionSummary(section, tutorial)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </Pressable>
          )
        })}

        {/* Read-only facts, not actions — so they sit under the checklist
            rather than in the menu. Backing is a second fetch on web and is not
            one here: "ask on the web" is the whole of what mobile can say about
            it, and a request would be a round trip to say so. */}
        <Text style={styles.moreHeading}>More</Text>
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
        <Button
          testID="hub-submit"
          label="Submit for review"
          variant="accent"
          onPress={handleSubmit}
          disabled={missing.length > 0 || !isDraft}
          loading={submitting}
        />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  title: {
    flex: 1,
    fontFamily: theme.fonts.black,
    fontSize: theme.type.title,
    color: theme.colors.ink,
    letterSpacing: -0.4,
  },
  kebab: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
  },
  menu: {
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing(3),
    overflow: 'hidden',
    ...theme.shadow(4),
  },
  menuItem: {
    padding: theme.spacing(3),
    borderBottomWidth: theme.border.thin,
    borderBottomColor: theme.colors.ink,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  menuTextDanger: { color: theme.colors.danger },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    backgroundColor: theme.colors.mintSoft,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    ...theme.shadow(3),
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
    color: theme.colors.mintDeep,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  progressText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  rows: { gap: theme.spacing(2), paddingBottom: theme.spacing(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    padding: theme.spacing(3),
    ...theme.shadow(3),
  },
  rowDone: { backgroundColor: theme.colors.mintSoft },
  mark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
  },
  markDone: { backgroundColor: theme.colors.mint },
  markTodo: { backgroundColor: theme.colors.apricotSoft },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  rowSummary: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
  moreHeading: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: theme.spacing(5),
    marginBottom: theme.spacing(2),
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
  footer: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(2) },
  footnote: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing(2),
  },
})
