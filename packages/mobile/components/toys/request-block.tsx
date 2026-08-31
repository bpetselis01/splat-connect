// packages/mobile/components/toys/request-block.tsx
import { useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Toy, ToyTransaction, ToyWithOwner } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { ErrorRow } from '../auth-screen'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Meter } from '../ui/Meter'

function ExchangeRow({ toy, selected, onPress }: { toy: Toy; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={toy.name}
      pressScale={0.98}
      style={styles.row}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={theme.colors.primary}
      />
      {toy.cover_photo_url ? (
        <Image source={{ uri: toy.cover_photo_url }} style={styles.rowPhoto} />
      ) : (
        <View style={styles.rowPhotoPlaceholder} />
      )}
      <Text style={styles.rowName} numberOfLines={1}>
        {toy.name}
      </Text>
      <Meter value={toy.condition} width={36} />
    </AnimatedPressable>
  )
}

/**
 * Mirrors web's components/toy-transaction-request.tsx verbatim in copy and
 * offer_type gating. The owner-hidden branch lives one level up in
 * ToyDetailScreen — this never renders for the toy's own owner, and mobile
 * has no signed-out branch since every tab route already requires a session.
 */
export function RequestBlock({
  toy,
  myToys,
  myToysLoaded,
  myToysError,
  onStarted,
}: {
  toy: ToyWithOwner
  myToys: Toy[]
  /** False until the caller's own toys have loaded (or failed) — see below. */
  myToysLoaded: boolean
  /** Set when the caller's own toys failed to load. Distinct from `error`
   *  below, which is a failed POST — this is a failed GET one level up, in
   *  ToyDetailScreen, that RequestBlock only reads. */
  myToysError: string | null
  onStarted: (txId: string) => void
}) {
  const [mode, setMode] = useState<'idle' | 'choosing-exchange'>('idle')
  const [offeredToyId, setOfferedToyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!toy.offer_type) {
    return <Text style={styles.muted}>Not currently offered for donation or exchange.</Text>
  }

  const canDonate = toy.offer_type === 'donation' || toy.offer_type === 'both'
  const canExchange = toy.offer_type === 'exchange' || toy.offer_type === 'both'

  async function start(type: 'donation' | 'exchange', offered_toy_id?: string) {
    setBusy(true)
    setError(null)
    try {
      const tx = await apiClient.post<ToyTransaction>('/api/toy-transactions', {
        toy_id: toy.id,
        type,
        ...(offered_toy_id ? { offered_toy_id } : {}),
      })
      onStarted(tx.id)
    } catch {
      setError('Could not start this request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={styles.card}>
      <ErrorRow message={error} />
      {/* Says what pressing either button actually does — same reasoning as
          web's comment above this line: neither button completes anything,
          it only opens a conversation with the owner. */}
      <Text style={styles.explainer}>
        {canDonate && canExchange
          ? 'Ask to collect this toy, or offer one of yours in exchange. Either way it starts a conversation with the owner.'
          : canDonate
            ? 'Ask to collect this toy. This starts a conversation with the owner.'
            : 'Offer one of your toys in exchange. This starts a conversation with the owner.'}
      </Text>
      {canDonate && (
        <Button label="Arrange pickup" variant="accent" disabled={busy} onPress={() => start('donation')} />
      )}
      {canExchange && mode === 'idle' && (
        <Button
          label="Arrange exchange"
          variant="secondary"
          // Held disabled until the caller's own toys have actually loaded —
          // otherwise a GET still in flight (or one that failed) reads as "you
          // have no toys", which is the wrong reason to be told to add one.
          disabled={busy || !myToysLoaded}
          onPress={() => {
            if (myToysError) {
              setError(myToysError)
              return
            }
            if (myToys.length === 0) {
              setError('Add a toy to My Toys before you can offer an exchange.')
              return
            }
            setMode('choosing-exchange')
          }}
        />
      )}
      {mode === 'choosing-exchange' && (
        <View style={styles.chooser}>
          <Text style={styles.chooserLabel}>Offer one of your toys</Text>
          <View accessibilityRole="radiogroup" style={styles.radioGroup}>
            {myToys.map((t) => (
              <ExchangeRow key={t.id} toy={t} selected={offeredToyId === t.id} onPress={() => setOfferedToyId(t.id)} />
            ))}
          </View>
          <Button
            label={busy ? 'Starting…' : 'Start exchange'}
            disabled={busy || !offeredToyId}
            onPress={() => start('exchange', offeredToyId)}
          />
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  muted: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  card: { gap: theme.spacing(3) },
  explainer: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  chooser: { gap: theme.spacing(2) },
  radioGroup: { gap: theme.spacing(2) },
  chooserLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
  },
  rowPhoto: { width: 32, height: 32, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceSunken },
  rowPhotoPlaceholder: { width: 32, height: 32, borderRadius: theme.radii.sm, backgroundColor: theme.colors.accentLight },
  rowName: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
})
