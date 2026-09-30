import { chromium } from '@playwright/test'
const [url, out, w, h] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h } })
await p.goto(url); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: out, fullPage: true })
await b.close()
