import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { stlName } from '../../lib/guide-files'

// The Files tab (spec 2026-10-07 §7–8): one card of files with View / 3D pills,
// the web footer for downloads, the model route. three.js itself is proven on
// device (Maestro); here the shell, the signing and the copy.

async function guideWithParts() {
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Files Guide') })
  const { data, error } = await adminClient().from('stl_files').insert([
    { tutorial_id: id, filename: 'lts_base.stl', file_url: `${id}/lts_base.stl`, print_minutes: 55, filament_grams: 14, material: 'PLA' },
    { tutorial_id: id, filename: 'lts_cap.stl', file_url: `${id}/lts_cap.stl`, print_minutes: 20, filament_grams: 4, material: 'PLA' },
  ]).select('id')
  if (error || !data) throw new Error(error?.message)
  // The model route signs the file's path, and signing fails for a missing object.
  const stl = 'solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n'
  for (const name of ['lts_base.stl', 'lts_cap.stl']) {
    const up = await adminClient().storage.from('stl-files').upload(`${id}/${name}`, new Blob([stl]), { contentType: 'model/stl', upsert: true })
    if (up.error) throw new Error(up.error.message)
  }
  return { id, files: data.map((r) => r.id) }
}

test('lists the PDF and parts with a single pill each, and links downloads to the web', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithParts()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Guide files')).toBeVisible()
  await expect(page.getByTestId('file-row-pdf')).toContainText('Full guide')
  await expect(page.getByTestId(`file-row-${g.files[0]}`)).toContainText(stlName('lts_base.stl'))
  await expect(page.getByTestId(`file-row-${g.files[0]}`)).toContainText('55 min · 14 g')
  await expect(page.getByRole('button', { name: /^3D view of/ })).toHaveCount(2)
  await expect(page.getByText(/Download PDF|Open in browser/)).toHaveCount(0)
  await expect(page.getByTestId('files-web-link')).toContainText('Download the files on the web')
  await page.evaluate(() => { const w = window as unknown as { opened: string[] }; w.opened = []; window.open = (u?: string | URL) => (w.opened.push(String(u)), null) })
  await page.getByTestId('files-web-link').click()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened[0]).toMatch(new RegExp(`/tutorials/${g.id}$`))
})

test('G30 a 3D pill opens the viewer for that part with its facts, and ✕ returns to Files', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithParts()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await page.getByRole('button', { name: `3D view of ${stlName('lts_cap.stl')}` }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${g.id}/model\\?file=${g.files[1]}`))
  await expect(page.getByRole('heading', { name: `${stlName('lts_cap.stl')} · lts_cap.stl` })).toBeVisible()
  await expect(page.getByText('20 min print')).toBeVisible()
  await expect(page.getByText('2 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask someone to print' })).toBeVisible()
  await expect(page.getByText(/Open in browser|Share|Save/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Close 3D view' }).click()
  await expect(page.getByRole('tab', { name: 'Files', selected: true })).toBeVisible()
})

test('a guide with nothing to download says so', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E No Files'), withPdf: false })
  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('This guide has no files to download.')).toBeVisible()
  await expect(page.getByTestId('print-card')).toHaveCount(0)
})
