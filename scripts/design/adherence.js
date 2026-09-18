/**
 * Design-system adherence: four mechanical checks across every route.
 *
 * §4 of docs' claude-code-prompt.md states scales rather than describing a look,
 * which makes most of it checkable:
 *
 *   mono    the mono face is for NUMERICS. Mono on prose is Pixel's micro-label,
 *           which is what the nav, the eyebrow, the chips and the table heads
 *           were all still wearing
 *   radius  four steps and nothing else: 14 field · 18 inset · 24 card · 999
 *           pill (plus 6 on a bare text button's focus ring, and RecordCard's
 *           own 22 from §5)
 *   height  four control heights: 36 quiet · 44 secondary · 48 standard · 52
 *           primary. Nothing interactive below 44 except the quiet register
 *   emoji   an emoji renders in the reader's system font and carries none of
 *           the palette, so it can never match the design
 *
 * This is deliberately NOT the parity fingerprint in scripts/parity. That
 * compares live against a rendered prototype and is only as right as the
 * prototype's hand-set values; this compares live against values the system
 * states outright, so a clean run here means something the fingerprint cannot
 * tell you. Run both.
 *
 *   ./scripts/parity/stack.sh up
 *   cd packages/web && node ../../scripts/design/adherence.js
 *
 * Exits non-zero when anything fails, so it can gate a commit.
 */
const {chromium}=require(require.resolve('@playwright/test',{paths:[process.cwd()]}))
const {provision,signIn,cleanup}=require('/Users/byronpetselis/Documents/splat-connect/scripts/parity/auth')
const {seed}=require('/Users/byronpetselis/Documents/splat-connect/scripts/parity/seed')
const {adminClient}=require('/Users/byronpetselis/Documents/splat-connect/scripts/parity/auth')
const ROUTES={
  guest:['/','/library','/toy-library','/learn','/learn/toy-adaptation-101','/printing','/printing/basics',
         '/get-involved','/impact','/about','/about/team','/organizations','/contact','/login','/signup',
         '/design-system','/get-involved/events','/get-involved/recycling','/learn/tools-and-materials','/printing/parts'],
  parent:['/dashboard','/dashboard/toys','/dashboard/exchanges','/dashboard/saved','/dashboard/profile',
          '/dashboard/print-requests','/dashboard/challenges','/dashboard/events','/dashboard/printers','/upload'],
  admin:['/admin','/admin/review','/admin/contributors','/admin/print-jobs','/admin/organizations','/admin/ideas','/admin/inbox','/admin/reports'],
  leader:['/dashboard/organisation','/dashboard/organisation/toys','/dashboard/organisation/requests','/dashboard/organisation/profile'],
}
const RADII=new Set([0,6,14,18,24,999]); const HEIGHTS=new Set([36,44,48,52])
const audit=()=>{
  const out={mono:[],radius:[],height:[],emoji:[]}
  const px=v=>Math.round(parseFloat(v)||0)
  for(const el of document.querySelectorAll('main *, header *')){
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2)continue
    const s=getComputedStyle(el)
    const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('')
    if(/JetBrains/.test(s.fontFamily)&&own&&!/^[\s$€£%.,:()+\-\/\d]*$/.test(own)&&s.fontVariantNumeric!=='tabular-nums')
      out.mono.push(own.slice(0,28))
    const br=px(s.borderTopLeftRadius); if(br&&!RADII.has(br)&&br!==22) out.radius.push(br+'px '+(el.className||'').toString().slice(0,30))
    if(el.tagName==='BUTTON'||(el.tagName==='A'&&/btn/.test((el.className||'').toString()))){
      const h=px(s.minHeight); if(h&&!HEIGHTS.has(h)) out.height.push(h+'px '+(el.innerText||'').trim().slice(0,18))
    }
    if(/[\u{1F300}-\u{1FAFF}]/u.test(own)) out.emoji.push(own.slice(0,16))
  }
  for(const k in out) out[k]=[...new Set(out[k])].slice(0,4)
  return out
}
;(async()=>{
  // `guest` is not a provisioned role — it is the signed-out reader, and half
  // the site is only ever seen that way.
  const roles=Object.keys(ROUTES).filter(r=>r!=='guest')
  const users=await provision(roles)
  try{ await seed(adminClient(),users) }catch(e){}
  const b=await chromium.launch()
  const agg={mono:new Set(),radius:new Set(),height:new Set(),emoji:new Set()}
  for(const role of Object.keys(ROUTES)){
    const ctx=await b.newContext({viewport:{width:1440,height:960}})
    if(role!=='guest'){
      const ok=await signIn(ctx,'http://localhost:3110',users[role])
      if(!ok.ok){console.log('! signin failed',role,ok.reason);continue}
    }
    const p=await ctx.newPage(); p.on('pageerror',()=>{})
    for(const rt of ROUTES[role]){
      try{ const res=await p.goto('http://localhost:3110'+rt,{waitUntil:'domcontentloaded',timeout:25000})
        if(!res||res.status()>=400)continue
        await p.waitForTimeout(500)
        const r=await p.evaluate(audit)
        for(const k in agg) r[k].forEach(v=>agg[k].add(rt+' :: '+v))
      }catch(e){}
    }
    await ctx.close()
  }
  let failed = 0
  for(const k in agg){
    console.log('=== '+k+' ('+agg[k].size+')')
    ;[...agg[k]].slice(0,20).forEach(v=>console.log('   '+v))
    failed += agg[k].size
  }
  await b.close(); await cleanup(users)
  if (failed) {
    console.error(`\n${failed} adherence failure(s).`)
    process.exitCode = 1
  } else {
    console.log('\nClean.')
  }
})()
