import { test, expect } from '@playwright/test'
import { adminClient } from '../helpers'
import { signInAdmin } from './support'

type Row = { key: string; value: unknown; updated_at: string }
const KEYS = ['home-hero', 'home-numbers', 'home-scenes', 'learn-course']
let original: Row[] = []

// These rows drive the live home page and Learn hub, so each test saves over the
// shared rows and the originals go back afterwards.
test.beforeEach(async () => {
  const { data } = await adminClient().from('site_content').select('key, value, updated_at').in('key', KEYS)
  original = (data ?? []) as Row[]
})

test.afterEach(async () => {
  const db = adminClient()
  await db.from('site_content').delete().in('key', KEYS)
  if (original.length) await db.from('site_content').insert(original)
})

test('WM35 saving the Home page tab writes the three home sections and the new headline shows on the home page', async ({ page }) => {
  const token = `Zq${Date.now().toString(36)}`
  await signInAdmin(page)

  await page.goto('/admin/content')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Headline').fill(`Toys for every child ${token}`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  const { data } = await adminClient().from('site_content').select('key, value').in('key', ['home-hero', 'home-numbers', 'home-scenes'])
  expect((data ?? []).map((r) => r.key).sort()).toEqual(['home-hero', 'home-numbers', 'home-scenes'])
  expect((data ?? []).find((r) => r.key === 'home-hero')?.value).toMatchObject({ headline: `Toys for every child ${token}` })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(token)
})

test('WM36 saving the Learn course tab stores the new title, and a stale editor is refused with a reload offer', async ({ page }) => {
  const title = `Course ${Date.now().toString(36)}`
  await signInAdmin(page)

  await page.goto('/admin/content')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: 'Learn course' }).click()
  await page.getByLabel('Course title').fill(title)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await expect
    .poll(async () => (await adminClient().from('site_content').select('value').eq('key', 'learn-course').maybeSingle()).data?.value)
    .toMatchObject({ title })

  // Another admin saves while this editor still holds the version it loaded.
  await page.goto('/admin/content')
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: 'Learn course' }).click()
  await page.getByLabel('Course title').fill(`${title} mine`)
  await adminClient().from('site_content').update({ value: { title: `${title} theirs` }, updated_at: new Date(Date.now() + 1000).toISOString() }).eq('key', 'learn-course')
  await page.getByRole('button', { name: 'Save changes' }).click()

  const alert = page.getByRole('tabpanel', { name: 'Learn course' }).getByRole('alert')
  await expect(alert).toContainText('Someone else saved this course since you opened it. Reload to see their changes.')
  await expect(alert.getByRole('button', { name: 'Reload' })).toBeVisible()
  const { data } = await adminClient().from('site_content').select('value').eq('key', 'learn-course').single()
  expect(data?.value).toEqual({ title: `${title} theirs` })
})
