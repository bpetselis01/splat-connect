// packages/mobile/components/organisation/review-detail-screen.tsx
// One project, and what this leader may do with it. Mobile's half of web's
// app/organizations/[id]/projects/[tutorialId]/page.tsx: which actions appear
// is derived from (backing, tutorial) state via leaderActions — never from
// which route was opened.
//
// The acting organisation comes from the tutorial's own backing rows crossed
// with caps.ledOrgs, so the route needs no org param. A leader of several orgs
// with several backings on one project acts for the first pending/accepted one
// — the same single-answer posture as web, where the URL had already chosen.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { useCallback, useRef, useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'
import { leaderActions } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Skeleton } from '../ui/Skeleton'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../auth-screen'

type Detail = TutorialWithDetails & { tutorial_orgs?: TutorialOrg[] }

/** Same helper, same reasoning, as exchanges/thread-screen.tsx: the API's 4xx
 *  bodies are written for humans; 5xx keeps the fallback. */
function apiMessage(err: unknown, fallback: string): string {
  const match = /failed with status 4\d\d: (.+)$/.exec(err instanceof Error ? err.message : '')
  return match ? match[1] : fallback
}

function CheckRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const body = (
    <View style={styles.checkRow}>
      <Ionicons
        name={onPress ? 'open-outline' : 'checkmark-circle-outline'}
        size={18}
        color={theme.colors.primaryDeep}
      />
      <Text style={styles.checkLabel}>{label}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressScale={0.99}>
      {body}
    </AnimatedPressable>
  )
}

export function ReviewDetailScreen({ tutorialId }: { tutorialId: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [tutorial, setTutorial] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Same generation posture as the threads: a refetch in flight when an action
  // lands must not put the old action pair back on screen.
  const generation = useRef(0)

  const load = useCallback(async () => {
    const at = generation.current
    try {
      const fresh = await apiClient.get<Detail>(`/api/tutorials/${tutorialId}`)
      if (generation.current === at) setTutorial(fresh)
    } catch (err) {
      console.error('[ReviewDetailScreen] tutorial fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [tutorialId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const ledOrgIds = new Set((caps?.ledOrgs ?? []).map((o) => o.id))
  // The backing this leader answers for: the first of their orgs' rows that is
  // still actionable, falling back to any of theirs so the Backed state shows.
  const myRows = (tutorial?.tutorial_orgs ?? []).filter((r) => ledOrgIds.has(r.org_id))
  const backing =
    myRows.find((r) => r.status === 'pending') ?? myRows.find((r) => r.status === 'accepted') ?? myRows[0] ?? null

  const actions = tutorial ? leaderActions(backing?.status ?? null, tutorial.status) : []

  async function run(action: () => Promise<unknown>) {
    generation.current += 1
    setBusy(true)
    setError(null)
    try {
      await action()
      setNote('')
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  function requestChanges() {
    const body = note.trim()
    if (!body) {
      // The API 400s without it anyway; failing here keeps the sentence local
      // to the field it is about.
      setError('Say what needs to change — the note goes to the contributor.')
      return
    }
    void run(() =>
      apiClient.post(`/api/tutorials/${tutorialId}/review`, {
        status: 'rejected',
        org_id: backing!.org_id,
        rejection_note: body,
      })
    )
  }

  async function openPdf() {
    // 049 made tutorial-pdfs private: the column is a path, signed in-process
    // with the app's own session — the guides preview mechanism, reused.
    const path = tutorial?.tutorial_pdf_url
    if (!path) return
    const { data, error: signError } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)
    router.push({
      pathname: '/guides/[id]/preview',
      params: { id: tutorialId, pdfUrl: signError || !data ? '' : data.signedUrl },
    })
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="70%" height={24} />
        <Skeleton width="100%" height={120} />
      </View>
    )
  }
  if (!tutorial) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this project." hint="Check your connection and try again." />
      </Screen>
    )
  }

  const author = tutorial.tutorial_contributors?.find((tc) => tc.role === 'primary')?.profiles?.name
  const partCount = tutorial.parts?.length ?? 0
  const toolCount = tutorial.tools?.length ?? 0

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {tutorial.toy_photo_url ? <Image source={{ uri: tutorial.toy_photo_url }} style={styles.photo} /> : null}

        <Text style={styles.title}>{tutorial.title}</Text>
        <View style={styles.badgeRow}>
          <Badge status={tutorial.status} />
          <Badge status={tutorial.difficulty} />
          <Badge status={tutorial.kind} />
        </View>
        {author ? <Text style={styles.byline}>{`By ${author}`}</Text> : null}
        <Text style={styles.description}>{tutorial.description}</Text>

        <View style={styles.checks}>
          <Text style={styles.groupTitle}>Check</Text>
          <Card style={styles.checkCard}>
            {tutorial.tutorial_pdf_url ? (
              <CheckRow label="Open the tutorial PDF" onPress={() => void openPdf()} />
            ) : (
              <CheckRow label="No PDF attached yet" />
            )}
            <CheckRow label={`${partCount} part${partCount === 1 ? '' : 's'} · ${toolCount} tool${toolCount === 1 ? '' : 's'}`} />
            {tutorial.kind === 'assistive_tech' ? (
              <CheckRow
                label={
                  (tutorial.stl_files?.length ?? 0) > 0
                    ? `${tutorial.stl_files!.length} STL file${tutorial.stl_files!.length === 1 ? '' : 's'}`
                    : 'No STL yet — assistive tech needs one'
                }
              />
            ) : null}
          </Card>
        </View>

        <ErrorRow message={error} />

        {actions.includes('back') ? (
          <View style={styles.actions}>
            <Text style={styles.actionHint}>
              Backing puts {`${caps?.ledOrgs.find((o) => o.id === backing?.org_id)?.name ?? 'your organisation'}`}&apos;s
              name behind this guide, and its review in your queue when it is submitted.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                label="Back this guide"
                variant="accent"
                disabled={busy}
                style={styles.rowButton}
                onPress={() => void run(() => apiClient.post(`/api/tutorials/${tutorialId}/orgs/${backing!.org_id}/accept`, {}))}
              />
              <Button
                label="Decline"
                variant="secondary"
                disabled={busy}
                style={styles.rowButton}
                onPress={() => void run(() => apiClient.post(`/api/tutorials/${tutorialId}/orgs/${backing!.org_id}/decline`, {}))}
              />
            </View>
          </View>
        ) : actions.includes('approve') ? (
          <View style={styles.actions}>
            <TextField
              label="Note to the contributor"
              accessibilityLabel="Note to the contributor"
              hint="Required to request changes; ignored on approve."
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.noteInput}
            />
            <View style={styles.buttonRow}>
              <Button
                label="Approve"
                variant="accent"
                disabled={busy}
                style={styles.rowButton}
                onPress={() =>
                  void run(() =>
                    apiClient.post(`/api/tutorials/${tutorialId}/review`, {
                      status: 'approved',
                      org_id: backing!.org_id,
                    })
                  )
                }
              />
              <Button
                label="Request changes"
                variant="secondary"
                disabled={busy}
                style={styles.rowButton}
                onPress={requestChanges}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  content: { paddingBottom: theme.spacing(8) },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceSunken,
    marginBottom: theme.spacing(3),
  },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.text, lineHeight: 30 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  byline: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    marginTop: theme.spacing(2),
  },
  description: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 21,
    marginTop: theme.spacing(3),
  },
  checks: { marginTop: theme.spacing(5) },
  groupTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  checkCard: { padding: theme.spacing(2), gap: theme.spacing(1) },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
  },
  checkLabel: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text },
  actions: { marginTop: theme.spacing(5) },
  actionHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginBottom: theme.spacing(3),
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  rowButton: { flex: 1 },
})
