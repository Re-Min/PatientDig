// node tests/smoke.mjs -> loads 3d.html headless, plays the full excavation via window.__dig, saves screenshots.
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { launch } from './browser.mjs';

mkdirSync('tests/out', { recursive: true });
const errors = [];
const browser = await launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
page.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.evaluateOnNewDocument(() => { window.__TEST__ = true; localStorage.removeItem('datday.catalog'); });
await page.goto(pathToFileURL('3d.html').href);
await page.waitForFunction('window.__dig && window.__dig.ready', { timeout: 120000 });
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { await page.screenshot({ path: `tests/out/${name}.png` }); console.log('shot', name); };
const fossils = () => page.evaluate(() => window.__dig.fossils());
let failed = false;
const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) failed = true; };

await wait(800);
await shot('01-start');
console.log(await fossils());

// animated strikes: tool rig + character run their clips and contact fires mid-animation
await page.evaluate(() => window.__dig.strike('trowel', 0.4, 0.9));
await wait(450);
await shot('02-trowel-mid');
await wait(900);
const afterStrike = await page.evaluate(() => window.__dig.hud());
check(afterStrike.depth !== '0.00 m', `animated trowel strike lowered soil (${afterStrike.depth})`);

// Sweep a disc around each fossil: trowel to the bone, brush the bone face, pick the edge matrix.
const sweep = (tool, cx, cz, r, passes, stride) => page.evaluate((tool, cx, cz, r, passes, stride) => {
  for (let p = 0; p < passes; p++)
    for (let x = cx - r; x <= cx + r; x += stride)
      for (let z = cz - r; z <= cz + r; z += stride)
        if (Math.hypot(x - cx, z - cz) <= r) window.__dig.apply(tool, x, z);
}, tool, cx, cz, r, passes, stride);

const list = await fossils();
// The first specimen is now the small single vertebra; the larger tail series is second.
const R = [0.42, 0.75, 0.6, 0.32];
for (const [i, f] of list.entries()) await sweep('trowel', f.center[0], f.center[2], R[i], 8, 0.12);
await wait(300);
await shot('03-trowel-done');
let st = await fossils();
console.log(st);
check(st.every(f => f.state !== 'buried'), 'trowel uncovers every fossil (glimpsed)');
check(st.every(f => f.state !== 'freed'), 'trowel alone does not free bones');

// a held brush stroke through the real input loop
await page.evaluate(c => window.__dig.hold('brush', c[0], c[2], true), list[0].center);
await wait(600);
await shot('04-brushing');
await page.evaluate(c => window.__dig.hold('brush', c[0], c[2], false), list[0].center);

for (const [i, f] of list.entries()) await sweep('brush', f.center[0], f.center[2], R[i], 14, 0.05);
st = await fossils();
console.log(st);
check(st.every(f => f.state === 'exposed'), 'brush exposes bone faces');

for (const [i, f] of list.entries()) await sweep('pick', f.center[0], f.center[2], R[i] + 0.1, 6, 0.04);
await wait(300);
st = await fossils();
console.log(st);
check(st.every(f => f.state === 'freed'), 'bamboo pick frees bone edges');
await shot('05-freed');

for (let i = 0; i < 4; i++) await page.evaluate(i => window.__dig.record(i), i);
await wait(1500 + 2600);
console.log(await page.evaluate(() => window.__dig.hud()));
await shot('06-catalog');
const saved = await page.evaluate(() => localStorage.getItem('datday.catalog'));
check(saved && saved.includes('heping'), `catalog saved to localStorage (${saved})`);
await page.evaluate(() => document.getElementById('reveal-stay').click());
await page.evaluate(() => { const d = window.__dig; d.camera.position.set(1.8, 2.6, 4.2); d.controls.update(); });
await wait(1200);
await shot('07-reconstruction');

check(errors.length === 0, `no page errors (${errors.length})`);
await browser.close();
process.exit(failed ? 1 : 0);
