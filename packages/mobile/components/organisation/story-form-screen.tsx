// packages/mobile/components/organisation/story-form-screen.tsx
/**
 * Publish a story — web's components/story-form.tsx on the phone.
 *
 * Publish stays disabled until consent is ticked; that is the courtesy, and
 * 059/062's check constraint is the guarantee. The word count is readMinutes,
 * the same number a reader is shown on the card.
 *
 * Both buttons return to Events and stories: mobile has no public story page to
 * land on, which is where web sends a published one.
 */
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { STORY_KINDS, STORY_KIND_LABEL, readMinutes, type StoryKind } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'

// An announcement speaks for SPLAT and is admin-only (062): not on a leader's form.
const KINDS = (Object.keys(STORY_KINDS) as StoryKind[]).filter((k) => k !== 'announcement')

export function StoryFormScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const org = caps?.ledOrgs[0]
  const [kind, setKind] = useState<StoryKind>('family')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [byline, setByline] = useState<string | null>(null)
  const [pullQuote, setPullQuote] = useState('')
  const [pullQuoteBy, setPullQuoteBy] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)

  if (!org) {
    return (
      <Screen>
        <SkeletonRow />
      </Screen>
    )
  }

  // Signed as the organisation until the leader types something else.
  const by = byline ?? org.name
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const ready = !!(title.trim() && summary.trim() && body.trim() && by.trim())
  const quoteUnsigned = !!pullQuote.trim() && !pullQuoteBy.trim()
  const canPublish = saving === null && ready && consent && !quoteUnsigned

  async function save(status: 'draft' | 'published') {
    setError(null)
    setSaving(status)
    try {
      await apiClient.post(`/api/organizations/${org!.id}/stories`, {
        kind,
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        byline: by.trim(),
        pull_quote: pullQuote.trim() || null,
        pull_quote_by: pullQuoteBy.trim() || null,
        consent_confirmed: consent,
        status,
      })
      router.back()
    } catch (e) {
      const detail = e instanceof Error ? /: (.+)$/.exec(e.message)?.[1] : null
      setError(detail ?? 'That did not save. Try once more.')
      setSaving(null)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          One thing that happened, told plainly. The best ones are short, name the toy, and let the family speak in their
          own words.
        </Text>

        <Text style={styles.label}>What kind of story?</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {KINDS.map((k) => (
            <Chip key={k} role="radio" label={STORY_KIND_LABEL[k]} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Text style={styles.help}>{STORY_KINDS[kind]}</Text>

        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={160} placeholder="Leo's drum, six weeks on" />
        <TextField
          label="One-sentence summary"
          value={summary}
          onChangeText={setSummary}
          maxLength={300}
          placeholder="What a reader gets if they only read this line."
        />
        <TextField
          label="The story"
          value={body}
          onChangeText={setBody}
          maxLength={20000}
          multiline
          placeholder="Blank line between paragraphs. Around 300–600 words reads well."
          style={styles.body}
        />
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {words} words · about {readMinutes(body)} min read
        </Text>
        <TextField label="Byline (who wrote it)" value={by} onChangeText={setByline} maxLength={120} />

        <View style={styles.well}>
          <Text style={styles.label}>Pull quote — optional</Text>
          <Text style={styles.help}>One line from the story, set large. The best ones are the family's own words.</Text>
          <TextField label="The quote" value={pullQuote} onChangeText={setPullQuote} maxLength={400} />
          <TextField label="Who said it" value={pullQuoteBy} onChangeText={setPullQuoteBy} maxLength={120} placeholder="Hannah, Leo’s mum" />
          {quoteUnsigned ? (
            <Text style={styles.help}>
              A quote needs someone to have said it — unattributed, it reads as SPLAT's voice put in a family's mouth.
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => setConsent(!consent)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Everyone named or pictured has agreed to appear"
          style={[styles.consent, consent && styles.consentOn]}
        >
          <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.primaryDark} />
          <View style={styles.consentText}>
            <Text style={styles.label}>Everyone named or pictured has agreed to appear</Text>
            <Text style={styles.help}>
              For a child, that means a parent or guardian said yes in writing. First names only unless they asked otherwise.
            </Text>
          </View>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Publish to Stories" onPress={() => void save('published')} disabled={!canPublish} loading={saving === 'published'} />
        <Button label="Save as draft" variant="secondary" onPress={() => void save('draft')} disabled={saving !== null} loading={saving === 'draft'} />
        <Text style={styles.help}>
          Published as {org.name}.{!consent && ready ? ' Publishing is held until consent is confirmed — save it as a draft meanwhile.' : ''}
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  help: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  body: { minHeight: 180, textAlignVertical: 'top' },
  count: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, textAlign: 'right', marginTop: -theme.spacing(2) },
  well: { gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.panel, backgroundColor: theme.colors.tone.sunken.bg },
  consent: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.panel,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  consentOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.tone.brand.bg },
  consentText: { flex: 1, gap: theme.spacing(1) },
  error: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.danger },
})
