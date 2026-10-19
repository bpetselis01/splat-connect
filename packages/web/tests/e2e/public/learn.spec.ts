import { test, expect, type Page } from '@playwright/test'
import { LEARN_COURSE, learnLessons } from '@splat-connect/types'
import { adminClient, createContributor, deleteUser, signIn } from '../helpers'

const LESSONS = learnLessons(LEARN_COURSE)
const TOTAL = LESSONS.length

/** An empty store makes the shell wait for a first write; "{}" lets it read from the first paint. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('splat_learn')) localStorage.setItem('splat_learn', '{}')
  })
})

const progress = (page: Page) => page.getByRole('progressbar', { name: 'Course progress' })
const lessonRegion = (page: Page) => page.getByRole('region', { name: 'Lesson' })

async function answerEveryQuestion(page: Page) {
  const groups = lessonRegion(page).getByRole('group')
  for (let i = 0, n = await groups.count(); i < n; i++) {
    await groups.nth(i).getByRole('button').first().click()
  }
}

test('WE03 WE04 completing a lesson is still counted after a reload, and Continue names the next one', async ({ page }) => {
  await page.goto('/learn')
  await expect(page.getByText(`0 of ${TOTAL} lessons`)).toBeVisible()
  await page.getByRole('link', { name: 'Start the course' }).click()
  await expect(page).toHaveURL(/\/learn\/toy-adaptation-101$/)
  await expect(progress(page)).toHaveAttribute('aria-valuenow', '0')
  await lessonRegion(page).getByRole('link', { name: `Done — next: ${LESSONS[1].title}` }).click()
  await expect(page).toHaveURL(new RegExp(`/learn/${LESSONS[1].slug}$`))
  await expect(progress(page)).toHaveAttribute('aria-valuenow', '1')

  await page.goto('/learn')
  await expect(page.getByText(`1 of ${TOTAL} lessons`)).toBeVisible()
  await page.reload()
  await expect(page.getByText(`1 of ${TOTAL} lessons`)).toBeVisible()
  const cont = page.getByRole('link', { name: `Continue: ${LESSONS[1].title}` })
  await expect(cont).toHaveAttribute('href', `/learn/${LESSONS[1].slug}`)
})

test('WE04 WE05 WE06 WE07 WE08 WE09 WE10 WE11 WE12 WE13 WE14 WE15 WE16 WE17 WE18 WE19 walking the course marks every lesson done in order', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto(`/learn/${LESSONS[0].slug}`)
  for (const [i, lesson] of LESSONS.entries()) {
    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.slug}$`))
    await expect(lessonRegion(page).getByRole('heading', { level: 1, name: lesson.title })).toBeVisible()
    await expect(progress(page)).toHaveAttribute('aria-valuenow', String(i))
    if (lesson.kind === 'quiz') {
      await expect(page.getByText('Answer every question to continue.')).toBeVisible()
      await answerEveryQuestion(page)
      await expect(page.getByText('Answer every question to continue.')).toHaveCount(0)
      await expect(progress(page)).toHaveAttribute('aria-valuenow', String(i + 1))
    }
    await lessonRegion(page)
      .getByRole('link', { name: /^(Done — next|Next): |^Finish the course$|^Back to the course$/ })
      .click()
  }
  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.getByText(`${TOTAL} of ${TOTAL} lessons`)).toBeVisible()
  await page.reload()
  await expect(page.getByText(`${TOTAL} of ${TOTAL} lessons`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Review the course' })).toBeVisible()
})

test('WE16 WE17 WE18 WE19 each checkpoint keeps its answers and score after a reload, and Clear my answers resets it', async ({ page }) => {
  test.setTimeout(120_000)
  for (const lesson of LESSONS.filter((l) => l.kind === 'quiz')) {
    await test.step(lesson.slug, async () => {
      await page.goto(`/learn/${lesson.slug}`)
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '0')
      await answerEveryQuestion(page)
      const summary = page.getByText(/^(Checkpoint done|Course complete)$/)
      await expect(summary).toBeVisible()
      await expect(
        lessonRegion(page).getByRole('heading', {
          level: 3,
          name: /\d+ of \d+ right\.|^All \d+ right\.$|^You know this\. Go build\.$|^You finished the course\.$/,
        })
      ).toBeVisible()

      await page.reload()
      await expect(summary).toBeVisible()
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '1')
      await expect(lessonRegion(page).getByRole('group').first().getByRole('button').first()).toBeDisabled()

      await page.getByRole('button', { name: 'Clear my answers and try again' }).click()
      await expect(summary).toHaveCount(0)
      await expect(page.getByText('Answer every question to continue.')).toBeVisible()
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '0')
    })
  }
})

test.describe('course set to Sign in', () => {
  test.describe.configure({ mode: 'serial' })
  type Row = { value: unknown; updated_at?: string } | null
  let before: Row = null
  const course = () => adminClient().from('site_content')

  test.beforeAll(async () => {
    const { data } = await course().select('value, updated_at').eq('key', 'learn-course').maybeSingle()
    before = data
    const { error } = await course().upsert({ key: 'learn-course', value: { shown_as: 'sign_in' } })
    if (error) throw new Error(error.message)
  })
  test.afterAll(async () => {
    if (before) await course().upsert({ key: 'learn-course', value: before.value, updated_at: before.updated_at })
    else await course().delete().eq('key', 'learn-course')
  })

  test('WE02 a signed-out reader on a lesson is sent to log in, and the lesson path is lost', async ({ page }) => {
    await page.goto('/learn/switch-types')
    await expect(page).toHaveURL(/\/login\?next=\/learn$/)
    await expect(page.locator('#email')).toBeVisible()
  })

  test('WE02 a signed-in member reads the same lesson', async ({ page }) => {
    const member = await createContributor()
    try {
      await signIn(page, member.email, member.password)
      await page.goto('/learn/switch-types')
      await expect(lessonRegion(page).getByRole('heading', { level: 1, name: 'Switch types explained' })).toBeVisible()
    } finally {
      await deleteUser(member.id)
    }
  })
})
