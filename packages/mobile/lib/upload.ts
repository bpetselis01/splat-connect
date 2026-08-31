// packages/mobile/lib/upload.ts
// Multipart uploads for the tutorial photo/PDF/STL routes. Kept apart from
// api-client.ts because every other call in this app sends JSON; a form part
// needs the RN {uri,name,type} file shape and no Content-Type of its own —
// fetch fills in the multipart boundary, and setting one here would drop it.
import { getToken } from './api-client'

export type UploadPath = '/api/upload/photo' | '/api/upload/pdf' | '/api/upload/stl'

export interface UploadResult {
  url: string
  filename?: string
}

export async function uploadFile(
  path: UploadPath,
  tutorialId: string,
  file: { uri: string; name: string; mimeType?: string }
): Promise<UploadResult> {
  const token = await getToken()

  const formData = new FormData()
  // RN's FormData accepts this {uri,name,type} object in place of a Blob —
  // there is no DOM File on device. The cast is for TypeScript's DOM lib
  // typing of FormData.append, not for the runtime, which is RN's own.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as unknown as Blob)
  formData.append('tutorialId', tutorialId)

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) detail = `: ${j.error}`
    } catch {}
    throw new Error(`Upload to ${path} failed with status ${res.status}${detail}`)
  }

  return (await res.json()) as UploadResult
}
