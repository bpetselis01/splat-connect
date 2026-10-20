import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signIn, uniqueTitle } from '../helpers'

test('WT01 the detail page renders a tutorial in full', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/tutorials/${tutorialId}`)

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.')).toBeVisible()
  await expect(page.getByText(contributor.name)).toBeVisible()

  // Signed out: the file links are the gate (049). The download itself is
  // covered in tutorial-downloads.spec.ts. The rail's PDF button says what it
  // costs to a signed-out reader since 1909fb6a.
  const detour = `/signup?next=%2Ftutorials%2F${tutorialId}&reason=download`
  await expect(page.getByRole('link', { name: 'Sign in to download' })).toHaveAttribute('href', detour)

  // Parts & tools is the first tab; the files sit behind the second.
  await expect(page.getByRole('cell', { name: 'E2E part', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: "Tools you'll need" })).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()

  await page.getByRole('tab', { name: 'Files & print settings' }).click()
  await expect(page.getByRole('link', { name: 'Download e2e-mount.stl' })).toHaveAttribute('href', detour)
})

test('WT01 an unknown tutorial id renders a 404', async ({ page }) => {
  const response = await page.goto('/tutorials/00000000-0000-0000-0000-000000000000')
  expect(response?.status()).toBe(404)
})

test('a tutorial with no photo shows the placeholder', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail No Photo')
  const id = await createTutorial(contributor.id, {
    title,
    status: 'approved',
    toyPhotoUrl: null,
  })

  await page.goto(`/tutorials/${id}`)

  // The 🧸 became a decorative duotone glyph in 30251713, so the box is found
  // by test id; the photo it stands in for must be absent.
  await expect(page.getByTestId('photo-placeholder')).toBeVisible()
  await expect(page.getByRole('img', { name: title })).toHaveCount(0)
})

test('WT03 optional parts and tools are badged and buy links open in a new tab', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Detail Optional'),
    status: 'approved',
    withOptionalExtras: true,
  })

  await page.goto(`/tutorials/${id}`)

  await expect(page.getByText('E2E optional part')).toBeVisible()
  await expect(page.getByText('E2E optional tool')).toBeVisible()
  await expect(page.getByText('Optional', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Buy E2E part from Jaycar' })).toHaveAttribute(
    'target',
    '_blank'
  )
})

test('a tutorial with no STL files omits the 3D-print section', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Detail No STL'),
    status: 'approved',
    withStl: false,
  })

  await page.goto(`/tutorials/${id}`)

  await expect(page.getByRole('tab', { name: 'Files & print settings' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Sign in to download' })).toBeVisible()
})

test('the parts tab totals the prices once every part has one', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Prices'), status: 'approved' })
  const admin = adminClient()
  await admin.from('parts').update({ price_cents: 1250 }).eq('tutorial_id', id)
  await admin.from('tutorials').update({ prices_checked_on: '2026-08-02' }).eq('id', id)

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByRole('cell', { name: 'Total' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '$12.50' }).last()).toBeVisible()
  await expect(page.getByText('Prices last checked 2 Aug 2026')).toBeVisible()
})

test('the rail names the starting toy, what it works with and the no-build note', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Works With'), status: 'approved' })
  await adminClient().from('tutorials').update({
    toy_name: 'Plush barking dog',
    toy_brand: 'ZURU',
    works_with: 'Any 3.5mm switch',
    no_build_note: 'Two adapted copies are in the library right now.',
  }).eq('id', id)

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByText('The toy you start with')).toBeVisible()
  await expect(page.getByText('Plush barking dog')).toBeVisible()
  await expect(page.getByText('by ZURU')).toBeVisible()
  await expect(page.getByText('Works with', { exact: true })).toBeVisible()
  await expect(page.getByText('Any 3.5mm switch')).toBeVisible()
  await expect(page.getByText('Two adapted copies are in the library right now.')).toBeVisible()
})

test('WT02 the breadcrumb leads back to the library, and a section tab swaps its panel', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Detail Tabs')
  const id = await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto(`/tutorials/${id}`)
  const parts = page.getByRole('tab', { name: 'Parts & tools' })
  const files = page.getByRole('tab', { name: 'Files & print settings' })
  await expect(parts).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('cell', { name: 'E2E part', exact: true })).toBeVisible()

  await files.click()
  await expect(files).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('link', { name: 'Download e2e-mount.stl' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E part', exact: true })).toBeHidden()

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Guides' }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test('WT06 the rail leads to the build-help form and the toy library, and the Files tab to a print request', async ({ page }) => {
  const author = await createContributor()
  const reader = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Detail Links'), status: 'approved' })

  await signIn(page, reader.email, reader.password)
  await page.goto(`/tutorials/${id}`)
  await page.getByRole('link', { name: 'Get help with this build' }).click()
  await expect(page).toHaveURL(new RegExp(`/get-involved/requests/new\\?guide=${id}$`))

  await page.goto(`/tutorials/${id}`)
  await page.getByRole('link', { name: 'Toy library →' }).click()
  await expect(page).toHaveURL(/\/toy-library$/)

  await page.goto(`/tutorials/${id}`)
  await page.getByRole('tab', { name: 'Files & print settings' }).click()
  await page.getByRole('link', { name: 'Request a print →' }).click()
  await expect(page).toHaveURL(new RegExp(`/printing/requests\\?guide=${id}$`))
})
