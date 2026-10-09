// packages/mobile/components/profile/child-done.tsx
// The wizard's last screen (MB is_wizard, wDone): the party bear, "Your child's
// profile is ready", what the answers found, and See the matches. Counts come
// from the two public lists through matchesForChild, so the number promised is
// the list Guides shows. A failed read drops the sentence, never the screen.
import { logFailure } from '../../lib/log'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { matchesForChild, type ChildTags, type Toy, type Tutorial } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Mascot } from '../ui/TabHero'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

export function ChildDone({ child }: { child: ChildTags }) {
  const router = useRouter()
  const [found, setFound] = useState<{ guides: number; toys: number } | null>(null)

  useEffect(() => {
    let ignore = false
    Promise.all([apiClient.get<Tutorial[]>('/api/public/tutorials'), apiClient.get<Toy[]>('/api/public/toys')])
      .then(([guides, toys]) => {
        const m = matchesForChild(child, guides, toys)
        if (!ignore) setFound({ guides: m.guideIds.length, toys: m.toyIds.length })
      })
      .catch((err) => logFailure('[ChildDone] match fetch failed:', err))
    return () => {
      ignore = true
    }
    // The answers are final by now; one read on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.done}>
      <Mascot pose="party" size={132} />
      <Text accessibilityRole="header" style={styles.heading}>
        Your child's profile is ready
      </Text>
      {found ? (
        <Text style={styles.line}>
          We found <Text style={styles.strong}>{plural(found.guides, 'guide')}</Text> and{' '}
          <Text style={styles.strong}>{plural(found.toys, 'toy')}</Text> that suit your child.
        </Text>
      ) : null}
      <Button
        label="See the matches"
        onPress={() => router.replace('/guides')}
        style={styles.cta}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', paddingVertical: theme.spacing(6) },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.display, color: theme.colors.text, marginTop: theme.spacing(4), textAlign: 'center' },
  line: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    lineHeight: 22,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: theme.spacing(2.5),
  },
  strong: { fontFamily: theme.fonts.black, color: theme.colors.ink },
  cta: { marginTop: theme.spacing(5) },
})
