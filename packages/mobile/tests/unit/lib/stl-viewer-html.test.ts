declare const __dirname: string
// No @types/node in this package, so the child_process import goes through require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require('node:child_process') as { execFileSync: (cmd: string, args: string[], opts: object) => unknown }
const path = require('node:path') as { resolve: (...p: string[]) => string }
import { STL_VIEWER_HTML } from '../../../lib/stl-viewer-html'

it('is the page the build script produces today', () => {
  expect(() => execFileSync('node', [path.resolve(__dirname, '../../../scripts/build-stl-viewer.mjs'), '--check'], { cwd: path.resolve(__dirname, '../../..'), stdio: 'pipe' })).not.toThrow()
})

it('carries three, the STL loader and orbit controls, and the load hook', () => {
  expect(STL_VIEWER_HTML).toContain('THREE.STLLoader')
  expect(STL_VIEWER_HTML).toContain('THREE.OrbitControls')
  expect(STL_VIEWER_HTML).toContain('window.__load')
  expect(STL_VIEWER_HTML.length).toBeLessThan(1_200_000)
})
