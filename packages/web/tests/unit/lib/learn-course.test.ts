import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { UNITS, LESSONS, lessonBySlug, unitOf, nextAfter, COURSE_HOURS } from '@/lib/learn-course'
import content from '@/lib/learn-content.json'

const appLearn = join(dirname(fileURLToPath(import.meta.url)), '../../../app/learn')
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../../public')

/**
 * The course model is the one list four things read: the home, every lesson's
 * outline, the progress ring and the "next up" button. A lesson in the model
 * with no page, or a page with no place in the model, is a broken link one of
 * those four will render — and nothing else would catch it, because a static
 * href that 404s type-checks fine.
 */
describe('the Learn course', () => {
  it('is six units and sixteen lessons', () => {
    expect(UNITS).toHaveLength(6)
    expect(LESSONS).toHaveLength(16)
    expect(COURSE_HOURS).toBeGreaterThan(0)
  })

  it('gives every lesson a page', () => {
    for (const lesson of LESSONS) {
      expect(existsSync(join(appLearn, lesson.slug, 'page.tsx')), lesson.slug).toBe(true)
    }
  })

  // Chain: the reverse of the check above. A page under /learn that the model
  //        does not know about renders the shell with no unit, no position and
  //        no next lesson — which looks like a bug rather than an omission.
  it('places every lesson page in the model', () => {
    const pages = readdirSync(appLearn, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
    const known = new Set(LESSONS.map((l) => l.slug))
    // /learn/ask-an-expert is reference material beside the course rather than
    // a lesson in it, and the course home links it as such.
    const outside = new Set(['ask-an-expert'])
    for (const page of pages) {
      expect(known.has(page) || outside.has(page), page).toBe(true)
    }
  })

  it('has a unique slug per lesson', () => {
    const slugs = LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('walks the whole course in order and stops at the end', () => {
    let at = LESSONS[0]
    const seen = [at.slug]
    while (true) {
      const next = nextAfter(at.slug)
      if (!next) break
      at = next
      seen.push(at.slug)
    }
    expect(seen).toEqual(LESSONS.map((l) => l.slug))
  })

  it('resolves a lesson and its unit by slug', () => {
    expect(lessonBySlug('wire-a-connector')?.kind).toBe('build')
    expect(unitOf('wire-a-connector')?.n).toBe(3)
    expect(lessonBySlug('not-a-lesson')).toBeUndefined()
    expect(unitOf('not-a-lesson')).toBeUndefined()
  })
})

/**
 * The extracted lesson content. Every field below was written at a bench with a
 * camera, and the failure mode being guarded is a photo path that does not
 * resolve — which renders as a broken image, on a page whose whole point is
 * showing somebody what a joint should look like.
 */
describe('the lesson content', () => {
  it('has a build lesson for every build slug, and a quiz for every quiz slug', () => {
    for (const lesson of LESSONS) {
      if (lesson.kind === 'build') {
        expect(content.builds, lesson.slug).toHaveProperty(lesson.slug)
      }
      if (lesson.kind === 'quiz') {
        expect(content.quizzes, lesson.slug).toHaveProperty(lesson.slug)
      }
    }
  })

  it('points every photo at a file that exists', () => {
    const paths = new Set<string>()
    const walk = (v: unknown) => {
      if (typeof v === 'string') {
        if (v.startsWith('/learn/img/')) paths.add(v)
        return
      }
      if (Array.isArray(v)) return v.forEach(walk)
      if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(content.builds)
    expect(paths.size).toBeGreaterThan(20)
    for (const p of paths) {
      expect(existsSync(join(publicDir, p)), p).toBe(true)
    }
  })

  it('gives every step an alt for every photo', () => {
    // Widened deliberately: TypeScript infers a union of seventeen step shapes
    // from the JSON, because every optional field is absent on most of them.
    // The runtime check below is the point.
    type Step = { title: string; imgs?: Array<{ src: string; alt: string }> }
    for (const [slug, lesson] of Object.entries(content.builds)) {
      for (const step of lesson.steps as unknown as Step[]) {
        for (const img of step.imgs ?? []) {
          // A photo of a soldered joint with no alt text is the one image on
          // the site a screen-reader user most needs described.
          expect(img.alt.trim().length, `${slug} — ${step.title}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('marks exactly one right answer per question, in range', () => {
    for (const [slug, questions] of Object.entries(content.quizzes)) {
      for (const q of questions) {
        expect(q.opts.length, `${slug}: ${q.q}`).toBeGreaterThanOrEqual(2)
        expect(q.a, `${slug}: ${q.q}`).toBeGreaterThanOrEqual(0)
        expect(q.a, `${slug}: ${q.q}`).toBeLessThan(q.opts.length)
        // The explanation is the whole reason the quiz exists.
        expect(q.why.trim().length, `${slug}: ${q.q}`).toBeGreaterThan(0)
      }
    }
  })
})
