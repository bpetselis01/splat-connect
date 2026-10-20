import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createOrg, deleteOrg, deleteUser, uniqueEmail, uniqueTitle } from '../helpers'

test('WS03 /impact/events lands on the events page', async ({ page }) => {
  await page.goto('/impact/events')
  await expect(page).toHaveURL(/\/get-involved\/events$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('WS04 /impact/news lands on the stories page', async ({ page }) => {
  await page.goto('/impact/news')
  await expect(page).toHaveURL(/\/about\/stories$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Stories' })).toBeVisible()
})

test('WS07 a registered organisation appears under delivery partners and links to its public profile', async ({ page }) => {
  const name = uniqueTitle('E2E Partner')
  const orgId = await createOrg(name)
  try {
    await page.goto('/about/partners')
    await expect(page.getByRole('heading', { level: 1, name: 'Partners and supporters' })).toBeVisible()
    const link = page.getByRole('link', { name: new RegExp(name) })
    await expect(link).toHaveAttribute('href', `/organizations/${orgId}/public`)
  } finally {
    await deleteOrg(orgId)
  }
})

test('WS08 a way to help leads to its page', async ({ page }) => {
  await page.goto('/about/support')
  await page.getByRole('link', { name: /Give your skills/ }).click()
  await expect(page).toHaveURL(/\/get-involved\/contributors$/)
})

test('WS09 a kind filter narrows the story list to that kind and marks itself pressed', async ({ page }) => {
  const author = await createContributor()
  const orgId = await createOrg(uniqueTitle('E2E Story Org'))
  const title = uniqueTitle('E2E Maker story')
  try {
    const { error } = await adminClient().from('org_stories').insert({
      org_id: orgId, kind: 'maker', title, summary: 'A maker night.', body: 'We built switches.', byline: 'E2E',
      consent_confirmed: true, status: 'published', published_at: new Date().toISOString(), created_by: author.id,
    })
    if (error) throw new Error(error.message)

    await page.goto('/about/stories')
    const heading = page.getByRole('heading', { name: title })
    await expect(heading).toBeVisible()
    await page.getByRole('link', { name: /^Family stories/ }).click()
    await expect(page).toHaveURL(/\/about\/stories\?kind=family$/)
    await expect(page.getByRole('link', { name: /^Family stories/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(heading).toHaveCount(0)

    await page.getByRole('link', { name: /^Maker stories/ }).click()
    await expect(page).toHaveURL(/\/about\/stories\?kind=maker$/)
    await expect(heading).toBeVisible()
    await heading.click()
    await expect(page).toHaveURL(/\/about\/stories\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  } finally {
    await adminClient().from('org_stories').delete().eq('org_id', orgId)
    await deleteOrg(orgId)
    await deleteUser(author.id)
  }
})

test.describe('contact form', () => {
  test('WS12 an empty form is blocked by the browser: nothing is sent and the name is flagged', async ({ page }) => {
    const sent: string[] = []
    page.on('request', (r) => r.url().includes('/api/public/contact') && sent.push(r.url()))
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send message' }).click()
    const name = page.getByLabel('Your name')
    expect(await name.evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe('Please fill out this field.')
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toHaveCount(0)
    expect(sent).toEqual([])
  })

  test('WS11 a real message is stored as sent and the page says so', async ({ page }) => {
    const email = uniqueEmail('contact')
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    try {
      await page.getByRole('radio', { name: /My organisation/ }).click()
      await page.getByLabel('Your name').fill('E2E Sender')
      await page.getByLabel('Email', { exact: true }).fill(email)
      await page.getByLabel('Message').fill('We would like to run a build day.')
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/public/contact') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Send message' }).click(),
      ])
      expect(res.status()).toBe(201)
      await expect(page.getByRole('heading', { name: 'Sent. Thank you.' })).toBeVisible()
      const { data } = await adminClient().from('contact_messages').select('topic, name, body').eq('email', email)
      expect(data).toEqual([{ topic: 'organisation', name: 'E2E Sender', body: 'We would like to run a build day.' }])
    } finally {
      await adminClient().from('contact_messages').delete().eq('email', email)
    }
  })
})
