/** 097. Part sizes per STL file, backed by a CHECK. */
import { describe, it, expect } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser } from '../../helpers/auth.js'

describe('097 stl part sizes', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('stl_files').select('size_x_mm, size_y_mm, size_z_mm').limit(1)
    expect(error).toBeNull()
  })
  it('refuses a size past 2000 mm in the database too', async () => {
    const { data: t } = await adminClient()
      .from('tutorials')
      .insert({ title: 'Sizes fixture', description: 'x', difficulty: 'easy', status: 'draft' })
      .select('id')
      .single()
    const { error: tooBig } = await adminClient()
      .from('stl_files')
      .insert({ tutorial_id: t!.id, filename: 'big.stl', file_url: `${t!.id}/big.stl`, size_x_mm: 2001 })
    expect(tooBig?.code).toBe('23514')
    await adminClient().from('tutorials').delete().eq('id', t!.id)
  })
})

// Fix: the PATCH writes only the settings it is sent. The phone's Save sizes
// sends the three sizes; before this it nulled the grams, minutes and material.
describe('PATCH an STL file with only a size', () => {
  it('T15 WT28 leaves the other settings as they were', async () => {
    const author = await createTestUser('contributor')
    const admin = adminClient()
    const { data: t } = await admin
      .from('tutorials')
      .insert({ title: 'Partial patch fixture', description: 'x', difficulty: 'easy', status: 'draft' })
      .select('id')
      .single()
    await admin.from('tutorial_contributors').insert({ tutorial_id: t!.id, profile_id: author.id, role: 'primary' })
    const { data: f } = await admin
      .from('stl_files')
      .insert({ tutorial_id: t!.id, filename: 'p.stl', file_url: `${t!.id}/p.stl`, filament_grams: 41, print_minutes: 90, material: 'PLA' })
      .select('id')
      .single()
    try {
      const res = await app.request(`/api/tutorials/${t!.id}/stl-files/${f!.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ size_x_mm: 120 }),
      })
      expect(res.status).toBe(200)
      const { data: row } = await admin
        .from('stl_files')
        .select('size_x_mm, filament_grams, print_minutes, material')
        .eq('id', f!.id)
        .single()
      expect(row).toEqual({ size_x_mm: 120, filament_grams: 41, print_minutes: 90, material: 'PLA' })
    } finally {
      await admin.from('tutorials').delete().eq('id', t!.id)
      await deleteTestUser(author.id)
    }
  })
})
