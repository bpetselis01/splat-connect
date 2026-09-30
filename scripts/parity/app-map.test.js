/**
 * Run: node scripts/parity/app-map.test.js
 * Every app-screen-map route must be a file in packages/mobile/app, found
 * the way expo-router finds it: (groups) are invisible in the URL, [x] is a
 * parameter, index.tsx is the folder. A board route with no app file fails
 * here, before any browser runs.
 */
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const APP = path.resolve(__dirname, '../../packages/mobile/app')
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-screen-map.json'), 'utf8'))
const web = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'screen-map.json'), 'utf8')).map((s) => s.id))

// Every app route file, as the URL expo-router serves it.
const routes = new Set()
;(function walk(dir, url) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), /^\(.+\)$/.test(e.name) ? url : `${url}/${e.name}`)
    else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_') && !e.name.startsWith('+')) {
      const name = e.name.replace(/\.tsx$/, '')
      routes.add(name === 'index' ? url || '/' : `${url}/${name}`)
    }
  }
})(APP, '')

// A concrete segment matches a [param] segment in the app's file tree.
const served = (route) => {
  const want = route.split('?')[0].split('/')
  return [...routes].some((r) => {
    const have = r.split('/')
    return have.length === want.length && have.every((seg, i) => seg === want[i] || (/^\[.+\]$/.test(seg) && /^\[.+\]$/.test(want[i])) || (/^\[.+\]$/.test(seg) && !/^\[/.test(want[i])))
  })
}
const missing = map.filter((s) => !s.skip && !served(s.route)).map((s) => `${s.id} -> ${s.route}`)
assert.deepStrictEqual(missing, [], 'board screens mapped to routes the app does not have')
assert.strictEqual(map.length, 61, 'the board has 61 screens; every one needs a row')
assert.deepStrictEqual(map.filter((s) => s.idFrom && !web.has(s.idFrom)).map((s) => s.id), [], 'idFrom names no web screen')
assert.deepStrictEqual(map.filter((s) => s.skip !== undefined && !s.skip).map((s) => s.id), [], 'skip needs a reason')
console.log(`app map: ${map.length} screens, ${routes.size} app routes, all resolve`)
