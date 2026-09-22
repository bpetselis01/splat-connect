import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import type { ReactNode } from 'react'
import { CheckCircle, Clock, WarningCircle, XCircle } from '@phosphor-icons/react/dist/ssr'
import { adminActions } from '@/components/project-actions'
import { PhotoCarousel } from '@/components/photo-carousel'
import { Check, X, Download, FileText } from '@/components/icons'
import { KIND_LABEL, SAFETY_CHECKLIST, type TutorialWithDetails } from '@splat-connect/types'

// `28 August` — the pill's date, in Sydney time like every other date here.
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' }).format(
    new Date(iso)
  )

type Reviewed = TutorialWithDetails & {
  reviewer?: { name: string } | null
  reviewed_for?: { name: string } | null
}

async function approveTutorial(id: string) {
  'use server'
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, { status: 'approved' })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
  revalidatePath('/library')
}

async function rejectTutorial(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = formData.get('note') as string
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
    status: 'rejected',
    rejection_note: note || null,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath(`/admin/review/${id}`)
}

/**
 * Take down published work.
 *
 * Lands in `rejected`, the same state as a normal rejection, so the contributor
 * sees the note where they already look and can edit and resubmit. The LABEL is
 * what carries the difference: this tutorial was live and a parent may have been
 * following it.
 *
 * The note is required and checked here as well as on the form, because `required`
 * is only the browser's opinion. It is the only thing the contributor will ever see
 * explaining why work that was live is not any more.
 */
async function unpublishTutorial(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const note = ((formData.get('note') as string) ?? '').trim()
  if (!note) return
  await apiClient.patch(`/api/admin/tutorials/${id}/status`, {
    status: 'rejected',
    rejection_note: note,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/review')
  revalidatePath('/admin/spot-check')
  revalidatePath('/library')
  revalidatePath(`/tutorials/${id}`)
  redirect('/admin/spot-check')
}

export default async function ReviewTutorialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let tutorial: Reviewed
  try {
    tutorial = await apiClient.get<Reviewed>(`/api/tutorials/${id}`)
  } catch {
    notFound()
  }

  // No status refusal. This page used to 404 anything not pending, which meant an
  // admin who found a bad approval in spot-check had nowhere to act — the reactive
  // control decision 14 promised, unreachable.
  const actions = adminActions(tutorial!.status)

  const t = tutorial!
  const contributor = t.tutorial_contributors?.[0]?.profiles
  const authors = (t.tutorial_contributors ?? []).map((c) => c.profiles?.name).filter(Boolean)
  const backing = (t.tutorial_orgs ?? [])
    .filter((b) => b.status === 'accepted')
    .map((b) => b.organizations?.name)
    .filter(Boolean)
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  const meta = [
    authors.join(', '),
    t.difficulty && cap(t.difficulty),
    t.kind && KIND_LABEL[t.kind],
    t.build_minutes ? `${t.build_minutes} minutes` : null,
    ...backing,
  ].filter(Boolean)

  // The status pill over the title. Pending is the common case and says how
  // long; the other two say who decided, because an admin here may be about to
  // overrule them.
  const pill =
    t.status === 'pending'
      ? {
          tint: 'var(--tamber)',
          icon: <Clock size={16} weight="fill" aria-hidden="true" />,
          text: t.created_at ? `Pending since ${dayMonth(t.created_at)}` : 'Pending',
        }
      : t.status === 'approved'
        ? {
            tint: 'var(--tok)',
            icon: <CheckCircle size={16} weight="fill" aria-hidden="true" />,
            text: `Approved${t.reviewer?.name ? ` by ${t.reviewer.name}` : ''}${t.reviewed_for?.name ? ` for ${t.reviewed_for.name}` : ''}`,
          }
        : {
            tint: 'var(--tbad)',
            icon: <XCircle size={16} weight="fill" aria-hidden="true" />,
            text: 'Sent back',
          }

  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
  const sections: Array<{ h: string; state: string; ok: boolean; body: ReactNode }> = [
    {
      h: 'Summary',
      state: t.description ? 'Complete' : 'Missing',
      ok: !!t.description,
      body: t.description || 'No summary written.',
    },
    {
      h: 'Parts',
      state: n(t.parts.length, 'part'),
      ok: t.parts.length > 0,
      body: t.parts.length
        ? t.parts.map((p) => `${p.name} × ${p.quantity}${p.is_optional ? ' (optional)' : ''}`).join('. ') + '.'
        : 'No parts listed.',
    },
    {
      h: 'Tools',
      state: n(t.tools.length, 'tool'),
      ok: true,
      body: t.tools.length
        ? t.tools.map((x) => `${x.name}${x.is_optional ? ' (optional)' : ''}`).join('. ') + '.'
        : 'None beyond hands.',
    },
    {
      h: 'Files',
      state: t.tutorial_pdf_url ? 'Guide attached' : 'No guide PDF',
      ok: !!t.tutorial_pdf_url,
      body: (
        <span className="flex flex-col gap-2">
          {t.tutorial_pdf_url ? (
            <a
              href={`/files/tutorial-pdfs/${t.tutorial_pdf_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-brand-dark hover:underline"
            >
              <FileText /> The guide (PDF)
            </a>
          ) : (
            'The step-by-step guide has not been uploaded.'
          )}
          {t.kind === 'assistive_tech' &&
            t.stl_files.map((f) => (
              <a
                key={f.id}
                href={`/files/stl-files/${f.file_url}`}
                className="inline-flex items-center gap-2 font-semibold text-brand-dark hover:underline"
              >
                <Download /> {f.filename}
              </a>
            ))}
        </span>
      ),
    },
  ]

  return (
    <div className="grid max-w-[1200px] grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[13px] font-extrabold text-ink"
          style={{ background: pill.tint }}
        >
          {pill.icon}
          {pill.text}
        </span>
        <h1 className="title-hub mt-3">{t.title}</h1>
        {meta.length > 0 && <p className="mt-2 font-semibold text-muted">{meta.join(' · ')}</p>}
        {/* The one thing an admin needs that a parent does not: who to write to. */}
        {contributor?.email && (
          <p className="mt-1 text-sm text-muted">
            Write to{' '}
            <a href={`mailto:${contributor.email}`} className="font-semibold text-brand-dark">
              {contributor.email}
            </a>
          </p>
        )}

        <div className="my-6 overflow-hidden rounded-card border-[length:var(--bw)] border-line shadow-[var(--shadow-e2)]">
          <PhotoCarousel urls={t.photo_urls ?? []} alt={t.title} className="aspect-video" />
        </div>

        <div className="flex flex-col gap-5">
          {sections.map((r) => (
            <section
              key={r.h}
              className="rounded-card border-[length:var(--bw)] border-line bg-surface px-6 py-[22px] shadow-[var(--shadow-e1)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3.5">
                <h2 className="m-0 font-display text-xl font-extrabold text-ink">{r.h}</h2>
                <span
                  className="admin-tag px-2.5 py-[3px] text-[11px]"
                  style={{ background: r.ok ? 'var(--tok)' : 'var(--tamber)' }}
                >
                  {r.state}
                </span>
              </div>
              <div className="leading-[1.6] text-ink">{r.body}</div>
            </section>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="admin-panel">
          <p className="admin-kicker">Decision</p>
          <div className="flex flex-col gap-3">
            {actions.includes('approve') && (
              <form action={approveTutorial.bind(null, t.id)}>
                <button type="submit" className="btn btn-primary btn-ok btn-block">
                  <Check /> Approve and publish
                </button>
              </form>
            )}

            {actions.includes('reject') && (
              <form action={rejectTutorial} className="mt-1 flex flex-col gap-3">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor="rejection-note" className="block">
                  <span className="mb-[7px] block text-sm font-extrabold text-ink">
                    Reason for sending it back
                  </span>
                  <textarea
                    id="rejection-note"
                    name="note"
                    rows={4}
                    placeholder="Step 4 does not say which wire goes to the tip."
                    className="field bg-canvas"
                  />
                  <span className="mt-[7px] block text-[13px] text-muted">
                    Specific enough to act on. &ldquo;Not clear enough&rdquo; is not a reason. The
                    contributor sees this on their My Tutorials page.
                  </span>
                </label>
                <button type="submit" className="btn btn-danger btn-block">
                  <X /> Send back to the author
                </button>
              </form>
            )}

            {actions.includes('unpublish') && (
              <form action={unpublishTutorial} id="unpublish" className="flex flex-col gap-2">
                <input type="hidden" name="id" value={t.id} />
                <h2 className="m-0 font-display text-lg font-extrabold text-ink">
                  Unpublish this tutorial
                </h2>
                <p className="text-sm leading-relaxed text-muted">
                  It is live in the library now and a parent may be following it. Unpublishing
                  removes it and shows this note to the contributor, who can edit and resubmit.
                </p>
                <label htmlFor="unpublish-note" className="mt-1 text-sm font-extrabold text-ink">
                  Why are you taking it down?
                </label>
                <textarea id="unpublish-note" name="note" rows={4} required className="field bg-canvas" />
                <button type="submit" className="btn btn-danger btn-block mt-1">
                  Unpublish
                </button>
              </form>
            )}

            {actions.length === 0 && (
              <p className="alert">
                {t.status === 'rejected'
                  ? `Rejected${t.rejection_note ? `: ${t.rejection_note}` : '.'} The contributor can edit and resubmit.`
                  : 'Nothing to do here.'}
              </p>
            )}
          </div>
        </div>

        {/* The reviewer's half of the contributor's safety declaration: the
            same list, checked against the actual guide before approving. */}
        <div className="rounded-[18px] border-[length:var(--bw)] border-line bg-surface px-[22px] py-5 shadow-[var(--shadow-e1)]">
          <h3 className="m-0 mb-1 font-display text-[17px] font-extrabold text-ink">Checklist</h3>
          <p className="mb-3 text-[13px] leading-normal text-muted">
            {t.safety_declared_at
              ? `Declared by the contributor on ${new Date(t.safety_declared_at).toLocaleDateString('en-AU')}. Check it holds:`
              : 'This tutorial predates the safety declaration — check every point yourself:'}
          </p>
          <ul className="flex list-none flex-col gap-2.5">
            {SAFETY_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                {t.safety_declared_at ? (
                  <CheckCircle size={18} weight="fill" aria-hidden="true" className="mt-0.5 flex-none text-success" />
                ) : (
                  <WarningCircle size={18} weight="fill" aria-hidden="true" className="mt-0.5 flex-none text-warning" />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--tviolet)] px-5 py-[18px]">
          <p className="text-[13px] leading-[1.55] text-ink">
            A competence check, not a certification. You are confirming the guide is complete,
            followable and free of obvious hazards.
          </p>
        </div>
      </aside>
    </div>
  )
}
