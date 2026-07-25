import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the home page renders the hero, a featured card and the three steps', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Home Featured')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Every child deserves to play.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Browse$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Buy the parts$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Adapt & play$/ })).toBeVisible()
})

test('the hero call to action reaches the library', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: /Browse the library/ }).click()

  await expect(page).toHaveURL(/\/library$/)
  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
})

test('the recent-tutorials section links through to the library', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Home Recent'), status: 'approved' })

  await page.goto('/')

  await page.getByRole('link', { name: /View all/ }).click()

  await expect(page).toHaveURL(/\/library$/)
})
