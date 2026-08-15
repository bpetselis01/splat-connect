import { subResourceRoutes } from './sub-resource.js'

type StlFileInput = { filename: string; file_url: string }

export default subResourceRoutes<StlFileInput>({
  path: 'stl-files',
  table: 'stl_files',
  bodyKey: 'stl_files',
  mapRow: (f, tutorialId) => ({
    tutorial_id: tutorialId,
    filename: f.filename,
    file_url: f.file_url,
  }),
})
