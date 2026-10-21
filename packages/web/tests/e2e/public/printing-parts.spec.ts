import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

test('WR06 the parts catalogue finds a guide’s STL by the guide’s title and links to the guide', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Catalogue')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })
  try {
    await page.goto('/printing/parts')
    await page.getByRole('searchbox', { name: 'Search parts' }).fill(title)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/printing\/parts\?q=/)
    await expect(page.getByText('e2e-mount.stl')).toBeVisible()
    await expect(page.getByRole('link', { name: title })).toHaveAttribute('href', `/tutorials/${tutorialId}`)

    await page.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(new RegExp(`/tutorials/${tutorialId}$`))
  } finally {
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(contributor.id)
  }
})

test('WR07 a member saves a printable part, and it is still saved after a reload', async ({ page }) => {
  const member = await createContributor()
  await acceptTerms(member.id)
  const title = uniqueTitle('E2E Savable part')
  const tutorialId = await createTutorial(member.id, { title, status: 'approved' })
  try {
    await signIn(page, member.email, member.password)
    await page.goto(`/printing/parts?q=${encodeURIComponent(title)}`)
    const heart = () => page.getByRole('button', { name: /^Save/ })
    await heart().click()
    await expect(heart()).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(heart()).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(member.id)
  }
})
