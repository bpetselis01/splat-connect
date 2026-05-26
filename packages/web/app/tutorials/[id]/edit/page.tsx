import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { FileDropZone } from '@/components/file-drop-zone'
import { BuyLinksInput } from '@/components/buy-links-input'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, BuyLink, Profile } from '@splat-connect/types'

export default async function EditTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let profile: Profile
  try {
    profile = await apiClient.get<Profile>('/api/contributors/me')
  } catch {
    redirect('/login')
  }

  let tutorial: TutorialWithDetails
  try {
    tutorial = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
  } catch {
    redirect('/dashboard')
  }

  const isContributor = tutorial!.tutorial_contributors.some(
    (tc) => tc.profile_id === profile!.id
  )
  if (!isContributor) redirect('/dashboard')

  const parts = tutorial!.parts as Part[]
  const tools = tutorial!.tools as Tool[]
  const stlFiles = tutorial!.stl_files as StlFile[]

  async function saveDetails(formData: FormData) {
    'use server'
    const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
    const patch: Record<string, string | null> = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      difficulty: formData.get('difficulty') as Difficulty,
    }
    if (current.status === 'approved' || current.status === 'rejected') {
      patch.status = 'pending'
    }
    await apiClient.patch(`/api/tutorials/${id}`, patch)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveFiles(formData: FormData) {
    'use server'
    const updates: Record<string, string> = {}

    const photo = formData.get('toy_photo') as File | null
    if (photo && photo.size > 0) {
      const fd = new FormData()
      fd.append('file', photo)
      fd.append('tutorialId', id)
      const { url } = await apiClient.postFormData<{ url: string }>('/api/upload/photo', fd)
      updates.toy_photo_url = url
    }

    const pdf = formData.get('tutorial_pdf') as File | null
    if (pdf && pdf.size > 0) {
      const fd = new FormData()
      fd.append('file', pdf)
      fd.append('tutorialId', id)
      const { url } = await apiClient.postFormData<{ url: string }>('/api/upload/pdf', fd)
      updates.tutorial_pdf_url = url
    }

    if (Object.keys(updates).length > 0) {
      const current = await apiClient.get<Tutorial>(`/api/tutorials/${id}`)
      if (current.status === 'approved' || current.status === 'rejected') {
        updates.status = 'pending'
      }
      await apiClient.patch(`/api/tutorials/${id}`, updates)
    }

    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addPart(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    if (!name.trim()) return
    const rawLinks = formData.get('buy_links') as string
    const buy_links: BuyLink[] = rawLinks ? JSON.parse(rawLinks) : []
    const current = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
    await apiClient.post(`/api/tutorials/${id}/parts`, {
      parts: [
        ...current.parts,
        {
          name: name.trim(),
          quantity: Number(formData.get('quantity') ?? 1),
          is_optional: formData.get('is_optional') === 'on',
          buy_links,
        },
      ],
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addTool(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    if (!name.trim()) return
    const rawLinks = formData.get('buy_links') as string
    const buy_links: BuyLink[] = rawLinks ? JSON.parse(rawLinks) : []
    const current = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
    await apiClient.post(`/api/tutorials/${id}/tools`, {
      tools: [
        ...current.tools,
        {
          name: name.trim(),
          is_optional: formData.get('is_optional') === 'on',
          buy_links,
        },
      ],
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addStlFile(formData: FormData) {
    'use server'
    const file = formData.get('stl_file') as File | null
    if (!file || file.size === 0) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tutorialId', id)
    const { url, filename } = await apiClient.postFormData<{ url: string; filename: string }>(
      '/api/upload/stl',
      fd
    )
    const current = await apiClient.get<TutorialWithDetails>(`/api/tutorials/${id}`)
    await apiClient.post(`/api/tutorials/${id}/stl-files`, {
      stl_files: [...current.stl_files, { filename, file_url: url }],
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm'
  const saveBtnCls =
    'self-end bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#16304f]'
  const panelCls = 'bg-white border rounded-xl mb-3'
  const summaryCls = 'px-5 py-4 font-semibold cursor-pointer select-none list-none'

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold truncate">{tutorial!.title}</h1>
      </div>

      {/* Details */}
      <details className={panelCls} open>
        <summary className={summaryCls}>Details</summary>
        <form action={saveDetails} className="px-5 pb-5 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input name="title" defaultValue={tutorial!.title} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              defaultValue={tutorial!.description ?? ''}
              rows={4}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            <select name="difficulty" defaultValue={tutorial!.difficulty} className={inputCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button type="submit" className={saveBtnCls}>
            Save details
          </button>
        </form>
      </details>

      {/* Files */}
      <details className={panelCls}>
        <summary className={summaryCls}>Files</summary>
        <form action={saveFiles} className="px-5 pb-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Replace toy photo</label>
            <FileDropZone
              name="toy_photo"
              accept="image/*"
              label="Toy Photo"
              currentFileLabel={tutorial!.toy_photo_url ? 'Current photo on file — upload to replace' : undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Replace tutorial PDF</label>
            <FileDropZone
              name="tutorial_pdf"
              accept=".pdf"
              label="Tutorial PDF"
              currentFileLabel={tutorial!.tutorial_pdf_url ? 'Current PDF on file — upload to replace' : undefined}
            />
          </div>
          <button type="submit" className={saveBtnCls}>
            Save files
          </button>
        </form>
      </details>

      {/* Parts */}
      <details className={panelCls}>
        <summary className={summaryCls}>Parts ({parts.length})</summary>
        <div className="px-5 pb-5">
          {parts.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {parts.map((p) => (
                <li
                  key={p.id}
                  className="text-sm border rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {p.name} × {p.quantity}
                    </span>
                    {p.is_optional && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  {p.buy_links.length > 0 && (
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {p.buy_links.map((bl, i) => (
                        <a
                          key={i}
                          href={bl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Buy ${p.name} from ${bl.label}`}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          {bl.label || 'Buy'}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={addPart} className="flex flex-col gap-2">
            <p className="text-sm font-medium">Add part</p>
            <input name="name" placeholder="Name" required className={inputCls} />
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              placeholder="Quantity"
              className={inputCls}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" name="is_optional" className="rounded" />
              Optional (not required)
            </label>
            <div>
              <p className="text-xs text-gray-500 mb-1">Buy links</p>
              <BuyLinksInput />
            </div>
            <button type="submit" className={saveBtnCls}>
              Add part
            </button>
          </form>
        </div>
      </details>

      {/* Tools */}
      <details className={panelCls}>
        <summary className={summaryCls}>Tools ({tools.length})</summary>
        <div className="px-5 pb-5">
          {tools.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {tools.map((t) => (
                <li
                  key={t.id}
                  className="text-sm border rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.name}</span>
                    {t.is_optional && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  {t.buy_links.length > 0 && (
                    <div className="flex gap-3 mt-1 flex-wrap">
                      {t.buy_links.map((bl, i) => (
                        <a
                          key={i}
                          href={bl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Buy ${t.name} from ${bl.label}`}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          {bl.label || 'Buy'}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={addTool} className="flex flex-col gap-2">
            <p className="text-sm font-medium">Add tool</p>
            <input name="name" placeholder="Name" required className={inputCls} />
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" name="is_optional" className="rounded" />
              Optional (not required)
            </label>
            <div>
              <p className="text-xs text-gray-500 mb-1">Buy links</p>
              <BuyLinksInput />
            </div>
            <button type="submit" className={saveBtnCls}>
              Add tool
            </button>
          </form>
        </div>
      </details>

      {/* STL Files */}
      <details className={panelCls}>
        <summary className={summaryCls}>STL Files ({stlFiles.length})</summary>
        <div className="px-5 pb-5">
          {stlFiles.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {stlFiles.map((f) => (
                <li key={f.id} className="text-sm border rounded-lg px-3 py-2">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {f.filename}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <form action={addStlFile} className="flex flex-col gap-2">
            <p className="text-sm font-medium">Add STL file</p>
            <FileDropZone name="stl_file" accept=".stl" label="STL File" />
            <button type="submit" className={saveBtnCls}>
              Upload STL
            </button>
          </form>
        </div>
      </details>
    </div>
  )
}
