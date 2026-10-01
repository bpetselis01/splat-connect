/** 097. Part sizes per STL file, backed by a CHECK. */
import { describe, it, expect } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

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
