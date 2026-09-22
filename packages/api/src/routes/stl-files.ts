import { subResourceRoutes } from './sub-resource.js'
import { createUserClient } from '../supabase/client.js'
import { STL_MATERIALS } from '@splat-connect/types'
import type { StlFile } from '@splat-connect/types'

type PrintSettings = Pick<StlFile, 'print_minutes' | 'filament_grams' | 'material'>
type StlFileInput = { filename: string; file_url: string } & Partial<PrintSettings>

// Blank, absent and garbage all land as null; the column checks (068) refuse
// anything out of range, and CHECK_VIOLATION below turns that into a 400.
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null)
const settings = (f: Partial<PrintSettings>): PrintSettings => ({
  print_minutes: int(f.print_minutes),
  filament_grams: int(f.filament_grams),
  material: (STL_MATERIALS as readonly unknown[]).includes(f.material) ? f.material! : null,
})

const CHECK_VIOLATION = '23514'

const router = subResourceRoutes<StlFileInput>({
  path: 'stl-files',
  table: 'stl_files',
  bodyKey: 'stl_files',
  mapRow: (f, tutorialId) => ({
    tutorial_id: tutorialId,
    filename: f.filename,
    file_url: f.file_url,
    ...settings(f),
  }),
})

// Settings on one row. The replace-set POST above deletes and re-inserts every
// row, which print_job_files' `on delete restrict` refuses once a job names
// one — so the editor changes settings here and leaves the ids alone.
router.patch('/:id/stl-files/:fileId', async (c) => {
  const body = await c.req.json<Partial<PrintSettings>>().catch(() => null)
  if (body === null || typeof body !== 'object') return c.json({ error: 'Body must be an object' }, 400)
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('stl_files')
    .update(settings(body))
    .eq('id', c.req.param('fileId'))
    .eq('tutorial_id', c.req.param('id'))
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === CHECK_VIOLATION) return c.json({ error: 'Those settings are out of range' }, 400)
    return c.json({ error: error.message }, 500)
  }
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

export default router
