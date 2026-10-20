/**
 * The gate every course page renders inside (site-content-learn-legal-editing).
 *
 * It lives in each page under app/learn/(course)/ — not in a layout — because
 * Next keeps a layout across in-app navigation and never re-runs it, so a
 * reader who arrived on a page the layout let through could click on into a
 * hidden course. A page renders on every navigation; so does this.
 *
 * "Shown as" (Byron, 2026-10-02):
 * - Free: the course.
 * - Free, sign-in needed: a signed-out reader goes to sign in, then back to the
 *   lesson they opened (`path`, passed by the page).
 * - Hidden: "Course hidden" for everyone but an admin. The public read serves
 *   no outline for a hidden course, so an admin's preview reads the saved row
 *   through the admin API and shows it under "Hidden from members".
 *
 * /learn/ask-an-expert is outside app/learn/(course) and never gated. A failed
 * public read is the code's course, shown as Free: Learn never goes down
 * because Site content could not be reached.
 */
import { redirect } from 'next/navigation'
import { mergeLearnCourse, type LearnCourse } from '@splat-connect/types'
import { authUrl } from '@/lib/safe-next-path'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { LearnCourseProvider } from '@/components/learn-course-context'

type Row = { key: string; value: unknown }

const hidden = (
  <section className="py-16 text-center">
    <h1 className="title-hub">Course hidden</h1>
  </section>
)

export async function LearnGate({ path, children }: { path: string; children: React.ReactNode }) {
  const course = await apiClient
    .get<LearnCourse>('/api/public/learn-course')
    .catch(() => mergeLearnCourse(null))
  if (course.shown_as === 'free') return <LearnCourseProvider course={course}>{children}</LearnCourseProvider>

  const caps = await getCapabilities()
  if (course.shown_as === 'sign_in') {
    if (!caps) redirect(authUrl('login', path))
    return <LearnCourseProvider course={course}>{children}</LearnCourseProvider>
  }

  if (!caps?.isAdmin) return hidden
  const rows = await apiClient.get<Row[]>('/api/admin/content').catch(() => null)
  if (!rows) return hidden
  const full = mergeLearnCourse(rows.find((r) => r.key === 'learn-course')?.value ?? null)
  return (
    <>
      <p role="status" className="alert alert-warning mb-6">
        Hidden from members
      </p>
      <LearnCourseProvider course={full}>{children}</LearnCourseProvider>
    </>
  )
}
