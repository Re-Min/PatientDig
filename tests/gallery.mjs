// node tests/gallery.mjs -> tests/out/gallery.png + model bbox sizes
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch } from './browser.mjs';

execSync('npx esbuild src/3d/gallery.js --bundle --format=iife --loader:.glb=binary --outfile=tests/out/gallery.js', { stdio: 'inherit' });
mkdirSync('tests/out', { recursive: true });
writeFileSync('tests/out/gallery.html', '<body style="margin:0"><script src="gallery.js"></script></body>');
const browser = await launch();
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[error]', e.message));
await page.goto(pathToFileURL('tests/out/gallery.html').href);
await page.waitForFunction('window.__ready', { timeout: 120000 });
console.log(JSON.stringify(await page.evaluate('window.__info'), null, 1));
await page.screenshot({ path: 'tests/out/gallery.png' });
await browser.close();
