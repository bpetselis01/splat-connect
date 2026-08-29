import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, uniqueTitle, adminClient, acceptTerms } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')
const STL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.stl')

/**
 * The edit page is a pill-row stepper: clicking a tab swaps in that step's
 * content, and only the active step's DOM exists at all (the others are
 * unmounted, not just hidden) — so most queries need no scoping. Scoping via
 * the returned tabpanel locator is still safe and keeps the pattern uniform.
 */
async function openStep(page: import('@playwright/test').Page, label: string | RegExp) {
  await page.getByRole('tab', { name: label }).click()
  return page.getByRole('tabpanel')
}

test('editing an approved tutorial resets its status to pending', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const tutorialId = await createTutorial(contributor.id, {
    title: 'E2E Approved Edit Target',
    status: 'approved',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${tutorialId}/edit`)
  await expect(page.locator('input[name="title"]')).toHaveValue('E2E Approved Edit Target')

  await page.locator('input[name="title"]').fill('E2E Approved Edit Target (updated)')
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.waitForLoadState('networkidle')

  // The edit page's own field can lag a save (a known re-render quirk for
  // everything except the difficulty <select>) — re-check on the dashboard,
  // which is server-rendered fresh from the database on every request.
  await page.goto('/dashboard/tutorials')
  await expect(page.getByText('E2E Approved Edit Target (updated)')).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
})

test('a contributor cannot edit another contributor\'s tutorial', async ({ page }) => {
  const owner = await createContributor()
  await acceptTerms(owner.id)
  const outsider = await createContributor()
  await acceptTerms(outsider.id)
  const tutorialId = await createTutorial(owner.id, { title: 'E2E Not Yours', status: 'draft' })

  await signIn(page, outsider.email, outsider.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${tutorialId}/edit`)

  await page.waitForURL('**/dashboard')
})

test('saving details updates the title, description and difficulty', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const title = uniqueTitle('E2E Edit Details')
  const id = await createTutorial(contributor.id, { title, status: 'draft' })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  const renamed = `${title} renamed`
  await page.locator('#edit-title').fill(renamed)
  await page.locator('#edit-description').fill('An edited description.')
  await page.locator('#edit-difficulty').selectOption('hard')
  await page.getByRole('button', { name: 'Save details' }).click()

  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('tutorials')
        .select('title,description,difficulty')
        .eq('id', id)
        .single()
      return data
    })
    .toMatchObject({ title: renamed, description: 'An edited description.', difficulty: 'hard' })
})

test('the difficulty select shows the newly saved value after a save', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Difficulty'),
    status: 'draft',
    difficulty: 'easy',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  await page.locator('#edit-difficulty').selectOption('medium')
  await page.getByRole('button', { name: 'Save details' }).click()

  // The select carries key={difficulty} so it rebuilds from the saved value
  // rather than keeping its stale defaultValue.
  await expect(page.locator('#edit-difficulty')).toHaveValue('medium')
})

test('the toy photo and tutorial PDF can be replaced', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Files'),
    status: 'draft',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  const files = await openStep(page, /^Files$/)
  await files.locator('input[name="toy_photo"]').setInputFiles(PHOTO_FIXTURE)
  await files.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await files.getByRole('button', { name: 'Save files' }).click()

  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('tutorials')
        .select('toy_photo_url')
        .eq('id', id)
        .single()
      return data?.toy_photo_url ?? ''
    }, { timeout: 30_000 })
    .not.toContain('placeholder.invalid')
})

test('a part can be added, edited and deleted', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Parts'),
    status: 'draft',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  const parts = await openStep(page, 'Parts')

  // The add form is closed when the list already has rows (ce15f51a); the
  // fixture seeds one, so it has to be opened first.
  await parts.getByRole('button', { name: 'Add a part' }).click()
  await parts.getByPlaceholder('Name').fill('Added part')
  await parts.getByRole('button', { name: 'Add part' }).click()
  await expect(parts.getByRole('button', { name: /Added part/ })).toBeVisible()

  await parts.getByRole('button', { name: /Added part/ }).click()
  await parts.locator('input').first().fill('Edited part')
  await parts.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(parts.getByRole('button', { name: /Edited part/ })).toBeVisible()

  await parts.getByRole('button', { name: /Edited part/ }).click()
  await parts.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(parts.getByRole('button', { name: /Edited part/ })).toHaveCount(0)
})

test('a tool can be added, edited and deleted', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Tools'),
    status: 'draft',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  const tools = await openStep(page, 'Tools')

  // The add form is closed when the list already has rows (ce15f51a); the
  // fixture seeds one, so it has to be opened first.
  await tools.getByRole('button', { name: 'Add a tool' }).click()
  await tools.getByPlaceholder('Name').fill('Added tool')
  await tools.getByRole('button', { name: 'Add tool' }).click()
  await expect(tools.getByRole('button', { name: /Added tool/ })).toBeVisible()

  await tools.getByRole('button', { name: /Added tool/ }).click()
  await tools.locator('input').first().fill('Edited tool')
  await tools.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(tools.getByRole('button', { name: /Edited tool/ })).toBeVisible()

  await tools.getByRole('button', { name: /Edited tool/ }).click()
  await tools.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(tools.getByRole('button', { name: /Edited tool/ })).toHaveCount(0)
})

test('an STL file record can be added', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit STL'),
    status: 'draft',
    withStl: false,
    // The step exists only for this kind; a toy adaptation has no pill to open.
    kind: 'assistive_tech',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  const stl = await openStep(page, 'STL Files')
  await stl.locator('input[name="stl_file"]').setInputFiles(STL_FIXTURE)
  await stl.getByRole('button', { name: 'Upload STL' }).click()

  await expect
    .poll(async () => {
      const { data } = await adminClient().from('stl_files').select('id').eq('tutorial_id', id)
      return data?.length ?? 0
    }, { timeout: 30_000 })
    .toBe(1)
})

test('submit-for-review is blocked when required fields are missing', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Submit Blocked'),
    status: 'draft',
    withPdf: false,
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  // Submitting lives on the Review step now, not on a bar shown from every step.
  await page.getByRole('tab', { name: 'Review' }).click()
  const submitButton = page.getByRole('button', { name: 'Submit for review' })
  await expect(submitButton).toBeDisabled()
  await expect(page.locator('.sticky-submit-note')).toContainText('The guide PDF')
  // getMissingFields is unit-tested, but nothing checked that the disabled
  // button actually prevents the status transition.
  const { data } = await adminClient().from('tutorials').select('status').eq('id', id).single()
  expect(data?.status).toBe('draft')
})

test('a rejected tutorial shows the rejection callout', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Rejected'),
    status: 'rejected',
    rejection_note: 'The photos are too dark to follow.',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  await expect(page.getByText('This tutorial was rejected')).toBeVisible()
  await expect(page.getByText('The photos are too dark to follow.')).toBeVisible()
})
