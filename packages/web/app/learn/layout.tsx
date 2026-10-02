/**
 * Every /learn page: the course outline an admin saved (site_content
 * 'learn-course'), merged over the code's, and its "Shown as".
 *
 * - Free: as it always was.
 * - Free, sign-in needed: a signed-out reader of any /learn page goes to sign
 *   in, then back to the course home.
 * - Hidden: "Course hidden" in place of every course page, for everyone but an
 *   admin, who still sees the course (to preview and edit it) under a "Hidden
 *   from members" line. /learn/ask-an-expert is not part of the course and is
 *   never hidden (Byron, 2026-10-02).
 *
 * A failed read is the code's course, shown as Free — Learn never goes down
 * because Site content could not be reached.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { mergeLearnCourse, type LearnCourse } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { LearnCourseProvider } from '@/components/learn-course-context'

/** Exported for tests. Pages under /learn that are not the course. */
export function isOutsideCourse(pathname: string): boolean {
  return pathname === '/learn/ask-an-expert' || pathname.startsWith('/learn/ask-an-expert/')
}

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const course = await apiClient
    .get<LearnCourse>('/api/public/learn-course')
    .catch(() => mergeLearnCourse(null))
  const provided = <LearnCourseProvider course={course}>{children}</LearnCourseProvider>
  if (course.shown_as === 'free') return provided

  // Cached: the root layout has already made this call for the request.
  const caps = await getCapabilities()
  if (course.shown_as === 'sign_in') {
    if (!caps) redirect('/login?next=/learn')
    return provided
  }

  // Hidden.
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (isOutsideCourse(pathname)) return provided
  if (caps?.isAdmin) {
    return (
      <>
        <p role="status" className="alert alert-warning mb-6">
          Hidden from members
        </p>
        {provided}
      </>
    )
  }
  return (
    <section className="py-16 text-center">
      <h1 className="title-hub">Course hidden</h1>
    </section>
  )
}
