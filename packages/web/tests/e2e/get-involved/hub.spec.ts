import { test, expect } from '@playwright/test'

// Signed-out visitor: each door on the hub and the three audience tracks opens its destination.

test('WI01 the families track opens the child profile, through sign-in when signed out', async ({ page }) => {
  await page.goto('/get-involved')
  await page.getByRole('link', { name: 'Start with a child profile' }).click()
  await expect(page).toHaveURL(/\/login(\?|$)/)
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('WI02 the makers track sends a signed-out visitor to sign up', async ({ page }) => {
  await page.goto('/get-involved')
  await page.getByRole('link', { name: 'Create an account to start writing' }).click()
  await expect(page).toHaveURL(/\/signup$/)
})

test('WI03 the organisations track sends a signed-out visitor to sign up', async ({ page }) => {
  await page.goto('/get-involved')
  await page.getByRole('link', { name: 'Register an organisation' }).click()
  await expect(page).toHaveURL(/\/signup$/)
})

test('WI04 the need and offer cards open the idea form, Makers wanted and Design challenges', async ({ page }) => {
  await page.goto('/get-involved')
  await page.getByRole('link', { name: /submit an idea/i }).first().click()
  await expect(page).toHaveURL(/\/get-involved\/submit-an-idea$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Submit an idea' })).toBeVisible()

  await page.goto('/get-involved')
  await page.getByRole('link', { name: /makers wanted/i }).first().click()
  await expect(page).toHaveURL(/\/get-involved\/makers-wanted$/)

  await page.goto('/get-involved')
  await page.getByRole('link', { name: /design challenges/i }).first().click()
  await expect(page).toHaveURL(/\/get-involved\/design-challenges$/)
})

test('WI05 the families page sends a visitor to the Guide library', async ({ page }) => {
  await page.goto('/get-involved/families')
  await page.getByRole('link', { name: 'Browse guides' }).click()
  await expect(page).toHaveURL(/\/library$/)
})

test('WI06 the contributors page sends a signed-out visitor to sign up', async ({ page }) => {
  await page.goto('/get-involved/contributors')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)
})

test('WI07 the organisations page sends a signed-out visitor to sign in, returning to the request', async ({ page }) => {
  await page.goto('/get-involved/organisations')
  await page.getByRole('link', { name: 'Sign in to continue' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fget-involved%2Forganisations%2Frequest$/)
})
