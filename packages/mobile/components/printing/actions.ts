// packages/mobile/components/printing/actions.ts
/**
 * The writes a print job takes that more than one screen makes: the printer's
 * two moves (the job page and the Jobs tab both offer them) and the family's
 * withdraw.
 */
import * as ImagePicker from 'expo-image-picker'
import type { ToyTransaction } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'

export const startPrint = (id: string) =>
  apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/print-started`, {})

/**
 * Ready needs a photo — 058 will not store one without the other, so a family
 * never travels for a part on somebody's word alone. Null when the printer
 * backs out of the picker.
 */
export async function markReady(id: string): Promise<ToyTransaction | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]!
  const updated = await uploadFile(`/api/toy-transactions/${id}/print-ready`, id, {
    uri: asset.uri,
    name: asset.fileName ?? 'ready.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
  })
  return updated as unknown as ToyTransaction
}

/**
 * Withdraw the whole request, not the one job on screen: the API withdraws the
 * rest of the group when the family withdraws any job in it (074).
 */
export async function withdrawRequest(tx: Pick<ToyTransaction, 'id' | 'print_group_id'>): Promise<void> {
  await apiClient.post(`/api/toy-transactions/${tx.id}/withdraw`, {})
}

/**
 * The owner's photo of the SPLAT test print (098), for an admin to pass or
 * fail. Null when they back out of the picker.
 */
export async function submitTestPrint(printerId: string): Promise<unknown> {
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]!
  return uploadFile(
    `/api/printers/${printerId}/test-prints`,
    printerId,
    { uri: asset.uri, name: asset.fileName ?? 'test-print.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
    null
  )
}
