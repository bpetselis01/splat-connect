import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, deleteUser, uniqueTitle } from '../helpers'

test('the parts catalogue finds a guide’s STL by the guide’s title', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Catalogue')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })
  try {
    await page.goto(`/printing/parts?q=${encodeURIComponent(title)}`)
    await expect(page.getByText('e2e-mount.stl')).toBeVisible()
    await expect(page.getByRole('link', { name: title })).toHaveAttribute('href', `/tutorials/${tutorialId}`)
  } finally {
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(contributor.id)
  }
})
