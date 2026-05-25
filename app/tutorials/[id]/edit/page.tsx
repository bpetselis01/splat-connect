import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import type { Tutorial, Part, Tool, StlFile, Difficulty } from '@/lib/types'

export default async function EditTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: ownership } = await supabase
    .from('tutorial_contributors')
    .select('tutorial_id')
    .eq('tutorial_id', id)
    .eq('profile_id', user.id)
    .single()

  if (!ownership) redirect('/dashboard')

  const { data: tutorialData } = await supabase
    .from('tutorials')
    .select('*')
    .eq('id', id)
    .single()

  if (!tutorialData) redirect('/dashboard')
  const tutorial = tutorialData as Tutorial

  const [{ data: partsData }, { data: toolsData }, { data: stlData }] =
    await Promise.all([
      supabase.from('parts').select('*').eq('tutorial_id', id),
      supabase.from('tools').select('*').eq('tutorial_id', id),
      supabase.from('stl_files').select('*').eq('tutorial_id', id),
    ])

  const parts = (partsData ?? []) as Part[]
  const tools = (toolsData ?? []) as Tool[]
  const stlFiles = (stlData ?? []) as StlFile[]

  async function saveDetails(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: current } = await supabase
      .from('tutorials')
      .select('status')
      .eq('id', id)
      .single()

    const payload: Record<string, string> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      difficulty: formData.get('difficulty') as Difficulty,
    }
    if (current?.status === 'approved' || current?.status === 'rejected') {
      payload.status = 'pending'
    }

    await supabase.from('tutorials').update(payload).eq('id', id)
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function saveFiles(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const updates: Record<string, string> = {}

    const photo = formData.get('toy_photo') as File | null
    if (photo && photo.size > 0) {
      const ext = photo.name.split('.').pop()
      const path = `${id}/photo.${ext}`
      await supabase.storage.from('toy-photos').upload(path, photo, { upsert: true })
      const { data } = supabase.storage.from('toy-photos').getPublicUrl(path)
      updates.toy_photo_url = data.publicUrl
    }

    const pdf = formData.get('tutorial_pdf') as File | null
    if (pdf && pdf.size > 0) {
      const path = `${id}/tutorial.pdf`
      await supabase.storage.from('tutorial-pdfs').upload(path, pdf, { upsert: true })
      const { data } = supabase.storage.from('tutorial-pdfs').getPublicUrl(path)
      updates.tutorial_pdf_url = data.publicUrl
    }

    if (Object.keys(updates).length > 0) {
      const { data: current } = await supabase
        .from('tutorials')
        .select('status')
        .eq('id', id)
        .single()
      if (current?.status === 'approved' || current?.status === 'rejected') {
        updates.status = 'pending'
      }
      await supabase.from('tutorials').update(updates).eq('id', id)
    }

    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addPart(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    if (!name.trim()) return
    const supabase = await createClient()
    await supabase.from('parts').insert({
      tutorial_id: id,
      name: name.trim(),
      quantity: Number(formData.get('quantity') ?? 1),
      buy_link: (formData.get('buy_link') as string) || null,
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addTool(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    if (!name.trim()) return
    const supabase = await createClient()
    await supabase.from('tools').insert({
      tutorial_id: id,
      name: name.trim(),
      buy_link: (formData.get('buy_link') as string) || null,
    })
    revalidatePath(`/tutorials/${id}/edit`)
  }

  async function addStlFile(formData: FormData) {
    'use server'
    const file = formData.get('stl_file') as File | null
    if (!file || file.size === 0) return
    const supabase = await createClient()
    const path = `${id}/stl/${file.name}`
    await supabase.storage.from('stl-files').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('stl-files').getPublicUrl(path)
    await supabase.from('stl_files').insert({
      tutorial_id: id,
      filename: file.name,
      file_url: data.publicUrl,
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
        <h1 className="text-xl font-bold truncate">{tutorial.title}</h1>
      </div>

      {/* Details */}
      <details className={panelCls} open>
        <summary className={summaryCls}>Details</summary>
        <form action={saveDetails} className="px-5 pb-5 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input name="title" defaultValue={tutorial.title} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              defaultValue={tutorial.description ?? ''}
              rows={4}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            <select name="difficulty" defaultValue={tutorial.difficulty} className={inputCls}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
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
        <form action={saveFiles} encType="multipart/form-data" className="px-5 pb-5 flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Replace toy photo</label>
            {tutorial.toy_photo_url && (
              <p className="text-xs text-gray-400 mb-1">
                Current:{' '}
                <a
                  href={tutorial.toy_photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  view
                </a>
              </p>
            )}
            <input name="toy_photo" type="file" accept="image/*" className="text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Replace tutorial PDF</label>
            {tutorial.tutorial_pdf_url && (
              <p className="text-xs text-gray-400 mb-1">
                Current:{' '}
                <a
                  href={tutorial.tutorial_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  view
                </a>
              </p>
            )}
            <input name="tutorial_pdf" type="file" accept=".pdf" className="text-sm" />
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
                  className="text-sm border rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <span>
                    {p.name} × {p.quantity}
                  </span>
                  {p.buy_link && (
                    <a
                      href={p.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buy ${p.name}`}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Buy
                    </a>
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
            <input name="buy_link" placeholder="Buy link (optional)" className={inputCls} />
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
                  className="text-sm border rounded-lg px-3 py-2 flex items-center justify-between"
                >
                  <span>{t.name}</span>
                  {t.buy_link && (
                    <a
                      href={t.buy_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buy ${t.name}`}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      Buy
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form action={addTool} className="flex flex-col gap-2">
            <p className="text-sm font-medium">Add tool</p>
            <input name="name" placeholder="Name" required className={inputCls} />
            <input name="buy_link" placeholder="Buy link (optional)" className={inputCls} />
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
          <form action={addStlFile} encType="multipart/form-data" className="flex flex-col gap-2">
            <p className="text-sm font-medium">Add STL file</p>
            <input name="stl_file" type="file" accept=".stl" className="text-sm" />
            <button type="submit" className={saveBtnCls}>
              Upload STL
            </button>
          </form>
        </div>
      </details>
    </div>
  )
}
