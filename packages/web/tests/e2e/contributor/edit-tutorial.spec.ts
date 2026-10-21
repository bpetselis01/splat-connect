import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, createTutorial, createOrgWithLeader, uniqueTitle, adminClient, acceptTerms, fillDetail } from '../helpers'

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

test('WT18 editing an approved tutorial resets its status to pending', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const tutorialId = await createTutorial(contributor.id, {
    title: 'E2E Approved Edit Target',
    status: 'approved',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  // The editor opens on Status (a1535727); the fields are on Details.
  await page.goto(`/tutorials/${tutorialId}/edit?step=details`)
  await expect(page.locator('input[name="title"]')).toHaveValue('E2E Approved Edit Target')

  await fillDetail(page, 'title', 'E2E Approved Edit Target (updated)')
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.waitForLoadState('networkidle')

  // The edit page's own field can lag a save (a known re-render quirk for
  // everything except the difficulty <select>) — re-check on the dashboard,
  // which is server-rendered fresh from the database on every request.
  await page.goto('/dashboard/tutorials')
  await expect(page.getByText('E2E Approved Edit Target (updated)')).toBeVisible()
  await expect(
    page
      .getByTestId('tutorial-row')
      .filter({ hasText: 'E2E Approved Edit Target (updated)' })
      .getByText('Waiting', { exact: true })
  ).toBeVisible()
})

test('WT35 a contributor cannot edit another contributor\'s tutorial', async ({ page }) => {
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

test('WT18 saving details updates the title, description and difficulty', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const title = uniqueTitle('E2E Edit Details')
  const id = await createTutorial(contributor.id, { title, status: 'draft' })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit?step=details`)

  const renamed = `${title} renamed`
  await fillDetail(page, 'title', renamed)
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
  await page.goto(`/tutorials/${id}/edit?step=details`)

  await fillDetail(page, 'difficulty', 'medium')
  await page.getByRole('button', { name: 'Save details' }).click()

  // The select carries key={difficulty} so it rebuilds from the saved value
  // rather than keeping its stale defaultValue.
  await expect(page.locator('#edit-difficulty')).toHaveValue('medium')
})

test('WT23 WT24 a photo is added to a guide, and the tutorial PDF replaced', async ({ page }) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Edit Files'),
    status: 'draft',
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  // A step's tab name carries its status glyph ("Files done"), so anchor the start only.
  const files = await openStep(page, /^Files\b/)
  // The photo first, and settled before the PDF is picked: adding a photo saves
  // through a server action that revalidates this page, and the PDF is still
  // only in the browser's memory until Save files runs.
  await files.locator('#guide-add-photo').setInputFiles(PHOTO_FIXTURE)
  // exact: the default is a case-insensitive substring, which also matches the
  // hint below the tiles ("The first one is the cover") and trips strict mode.
  await expect(page.getByText('Cover', { exact: true })).toBeVisible({ timeout: 30_000 })
  await files.locator('input[name="tutorial_pdf"]').setInputFiles(PDF_FIXTURE)
  await files.getByRole('button', { name: 'Save files' }).click()

  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('tutorials')
        .select('photo_urls')
        .eq('id', id)
        .single()
      return data?.photo_urls ?? []
    }, { timeout: 30_000 })
    // Appended, not replaced: the box is a gallery since 053, so the seeded
    // placeholder stays at [0] and stays the cover. Polling toy_photo_url —
    // generated from photo_urls[1] — would therefore never change no matter
    // how well the save worked, and would report success as failure.
    //
    // This is the assertion that proves the save itself ran: the upload
    // reaches storage on its own, and it is the server action after it that
    // writes the row. That action was the one throwing "patchFiles is not
    // defined", which left exactly this array untouched.
    .toEqual([
      'https://placeholder.invalid/photo.jpg',
      expect.stringContaining('/toy-photos/'),
    ])
})

test('WT25 a part can be added, edited and deleted, and the saved list reloads', async ({ page }) => {
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
  await expect(page.getByRole('status')).toHaveText('Part added')
  await page.reload()
  await expect((await openStep(page, 'Parts')).getByRole('button', { name: /Added part/ })).toBeVisible()

  await parts.getByRole('button', { name: /Added part/ }).click()
  await parts.locator('input').first().fill('Edited part')
  await parts.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(parts.getByRole('button', { name: /Edited part/ })).toBeVisible()

  await parts.getByRole('button', { name: /Edited part/ }).click()
  await parts.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(parts.getByRole('button', { name: /Edited part/ })).toHaveCount(0)
})

test('WT26 a tool can be added, edited and deleted, and the saved list reloads', async ({ page }) => {
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
  await expect(page.getByRole('status')).toHaveText('Tool added')
  await page.reload()
  await expect((await openStep(page, 'Tools')).getByRole('button', { name: /Added tool/ })).toBeVisible()

  await tools.getByRole('button', { name: /Added tool/ }).click()
  await tools.locator('input').first().fill('Edited tool')
  await tools.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(tools.getByRole('button', { name: /Edited tool/ })).toBeVisible()

  await tools.getByRole('button', { name: /Edited tool/ }).click()
  await tools.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(tools.getByRole('button', { name: /Edited tool/ })).toHaveCount(0)
})

test('WT27 an STL file record can be added', async ({ page }) => {
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
    withSteps: false,
  })

  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  await page.goto(`/tutorials/${id}/edit`)

  // The editor opens on Status: the header's submit is disabled and the
  // checklist names what is missing.
  const submitButton = page.getByRole('button', { name: 'Submit for review' }).first()
  await expect(submitButton).toBeDisabled()
  await expect(page.getByRole('tabpanel')).toContainText('Still needs steps or a guide PDF')
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

  await expect(page.getByText('Your reviewer sent this back')).toBeVisible()
  await expect(page.getByText('The photos are too dark to follow.')).toBeVisible()
})

async function editorAs(page: import('@playwright/test').Page, overrides: Parameters<typeof createTutorial>[1] = {}) {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Editor'), ...overrides })
  await signIn(page, contributor.email, contributor.password)
  await page.waitForURL('**/dashboard')
  return { contributor, id }
}
const statusOf = async (id: string) =>
  (await adminClient().from('tutorials').select('status').eq('id', id).single()).data?.status

test('WT18 saving a change to a rejected tutorial sends it back to pending', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'rejected', rejection_note: 'Add a clearer cover photo.' })
  await page.goto(`/tutorials/${id}/edit?step=details`)
  await fillDetail(page, 'description', 'Reworded after the review.')
  await page.getByRole('button', { name: 'Save details' }).click()

  await expect.poll(() => statusOf(id)).toBe('pending')
  await page.goto('/dashboard/tutorials')
  await expect(page.getByTestId('tutorial-row').filter({ hasText: 'E2E Editor' }).getByText('Waiting', { exact: true })).toBeVisible()
})

test('WT19 safety notes save and reload, and send an approved guide back to pending', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'approved' })
  await page.goto(`/tutorials/${id}/edit?step=details`)
  const details = page.getByRole('tabpanel')
  await details.getByRole('button', { name: 'Add a safety note' }).click()
  await details.getByLabel('Safety note 1 title').fill('Screw the battery door shut')
  await details.getByLabel('Safety note 1 detail').fill('The clip alone lets small hands in.')
  await details.getByRole('button', { name: 'Save safety notes' }).click()
  await expect
    .poll(async () => (await adminClient().from('tutorial_safety_notes').select('title').eq('tutorial_id', id)).data)
    .toEqual([{ title: 'Screw the battery door shut' }])

  await page.reload()
  await expect(page.getByLabel('Safety note 1 title')).toHaveValue('Screw the battery door shut')
  await expect(page.getByLabel('Safety note 1 detail')).toHaveValue('The clip alone lets small hands in.')
  expect(await statusOf(id)).toBe('pending')
})

test('WT20 the "who it is for" chips save and reload', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'draft' })
  await page.goto(`/tutorials/${id}/edit?step=details`)
  const chip = page.getByRole('button', { name: 'Adapted toy', exact: true })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await page.getByRole('button', { name: "Save who it's for" }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Adapted toy', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const { data } = await adminClient().from('tutorials').select('device_types').eq('id', id).single()
  expect(data?.device_types).toEqual(['adapted_toy'])
})

test('WT21 WT22 steps and a step photo save and reload, and send an approved guide back to pending', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'approved' })
  await page.goto(`/tutorials/${id}/edit?step=steps`)
  const steps = page.getByRole('tabpanel')
  await steps.getByRole('button', { name: 'Add a step' }).click()
  await steps.getByPlaceholder('What to do in this step').fill('Open the battery cover.')
  await steps.getByLabel('Photo for step 1').setInputFiles(PHOTO_FIXTURE)
  await expect(steps.getByRole('button', { name: 'Save steps' })).toBeEnabled({ timeout: 30_000 })
  await steps.getByRole('button', { name: 'Save steps' }).click()
  await expect(page.getByRole('status')).toContainText(/steps saved/i)

  await page.reload()
  await expect(page.getByPlaceholder('What to do in this step')).toHaveValue('Open the battery cover.')
  const { data } = await adminClient().from('tutorial_steps').select('body, photo_url').eq('tutorial_id', id)
  expect(data).toEqual([{ body: 'Open the battery cover.', photo_url: expect.stringContaining(`${id}/steps/`) }])
  expect(await statusOf(id)).toBe('pending')
})

test('WT28 STL print settings save and reload', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'draft' })
  await page.goto(`/tutorials/${id}/edit?step=stl`)
  const stl = page.getByRole('tabpanel')
  await stl.getByLabel('Width (mm)').fill('45')
  await stl.getByRole('button', { name: 'Save print settings' }).click()
  await expect(page.getByRole('status')).toContainText('Print settings saved')

  await page.reload()
  await expect(page.getByLabel('Width (mm)')).toHaveValue('45')
  const { data } = await adminClient().from('stl_files').select('size_x_mm').eq('tutorial_id', id).single()
  expect(Number(data?.size_x_mm)).toBe(45)
})

test('WT29 a pick is added to Worth a look and survives a reload; removing it empties the list', async ({ page }) => {
  const other = await createContributor()
  const target = await createTutorial(other.id, { title: uniqueTitle('E2E Pick Target'), status: 'approved' })
  const { id } = await editorAs(page, { status: 'draft' })
  await page.goto(`/tutorials/${id}/edit?step=recommended`)
  await page.getByLabel('Add a recommendation').selectOption(target)
  await expect(page.getByRole('status')).toContainText('Recommendation added')

  await page.reload()
  await expect(page.getByRole('tabpanel').locator('li', { hasText: 'E2E Pick Target' })).toBeVisible()
  const { data } = await adminClient().from('tutorial_recommendations').select('recommended_id').eq('tutorial_id', id)
  expect(data).toEqual([{ recommended_id: target }])

  await page.getByRole('tabpanel').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('status')).toContainText('Recommendation removed')
  await page.reload()
  await expect(page.getByRole('tabpanel').locator('li', { hasText: 'E2E Pick Target' })).toHaveCount(0)
})

test('WT31 asking an organisation to back the guide tells its leader, and withdrawing removes the request', async ({ page, browser }) => {
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Backers')
  const orgId = await createOrgWithLeader(leader.id, orgName)
  const { contributor, id } = await editorAs(page, { status: 'draft', title: uniqueTitle('E2E Needs Backing') })
  void contributor

  await page.goto(`/tutorials/${id}/edit?step=team`)
  await page.getByLabel(/Ask another organisation/i).selectOption(orgId)
  await page.getByRole('button', { name: /^Ask$/ }).click()
  await expect(page.getByRole('status')).toContainText(orgName)
  await page.reload()
  await expect(page.getByRole('tabpanel').getByText(orgName).first()).toBeVisible()
  const { data } = await adminClient().from('tutorial_orgs').select('org_id, status').eq('tutorial_id', id)
  expect(data).toEqual([{ org_id: orgId, status: 'pending' }])

  const leaderCtx = await browser.newContext()
  const leaderPage = await leaderCtx.newPage()
  await signIn(leaderPage, leader.email, leader.password)
  await leaderPage.goto('/notifications')
  await expect(leaderPage.getByText(/asked your organisation to back/).first()).toBeVisible()
  await leaderCtx.close()

  await page.getByRole('button', { name: /withdraw/i }).click()
  await expect.poll(async () => (await adminClient().from('tutorial_orgs').select('org_id').eq('tutorial_id', id)).data).toEqual([])
})

test('WT33 the Status checklist jumps to the step that needs work, and Preview opens the reader view', async ({ page }) => {
  const { id } = await editorAs(page, { status: 'draft', withPdf: false, withSteps: false })
  await page.goto(`/tutorials/${id}/edit`)
  await page.locator('li.editor-check', { hasText: 'Steps' }).getByRole('button', { name: 'Fill it in' }).click()
  await expect(page.getByRole('tab', { name: /^Steps/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/step=steps/)

  await page.goto(`/tutorials/${id}/edit`)
  await page.getByRole('link', { name: 'Preview as a reader' }).click()
  await expect(page).toHaveURL(/preview=1/)
  await expect(page.getByText('Previewing as a reader.')).toBeVisible()
  await page.getByRole('link', { name: 'Back to the editor' }).click()
  await expect(page.getByRole('tab', { name: /^Status/ })).toBeVisible()
})

test('WT34 a draft is deleted after typing the confirmation, and My tutorials no longer lists it', async ({ page }) => {
  const title = uniqueTitle('E2E Delete Draft')
  const { id } = await editorAs(page, { status: 'draft', title })
  await page.goto(`/tutorials/${id}/edit`)
  await page.getByRole('button', { name: /Delete draft/ }).click()
  await page.getByLabel(/to confirm/i).fill('confirm_delete_draft')
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page).toHaveURL(/\/dashboard\/tutorials$/)
  await expect(page.getByText(title)).toHaveCount(0)
  const { data } = await adminClient().from('tutorials').select('id').eq('id', id)
  expect(data).toEqual([])
})
