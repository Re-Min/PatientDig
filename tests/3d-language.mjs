import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  timeout: 30000,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--user-data-dir=D:/datday/prototype/tests/out/edge-3d-language'],
  defaultViewport: { width: 1440, height: 900 },
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL('3d.html').href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__dig?.ready, { timeout: 120000 });
  assert.equal(await page.$eval('#dig-tutorial', el => el.hidden), true);
  await page.click('#dig');
  assert.equal(await page.$eval('#dig-tutorial', el => el.hidden), false);
  for (let i = 0; i < 4; i++) {
    await page.waitForFunction(() => !document.getElementById('tutorial-next').disabled);
    assert.equal(await page.$eval('#tutorial-page', el => el.textContent), `${String(i + 1).padStart(2, '0')} / 04`);
    await page.click(i % 2 ? '.tutorial-copy' : '#tutorial-image');
  }
  assert.equal(await page.$eval('#dig-tutorial', el => el.hidden), true);
  assert.equal(await page.$eval('#language-toggle', el => el.textContent), 'English');
  assert.equal(await page.$eval('.brief h2', el => el.textContent), '尾椎露头，需要确认');
  assert.equal(await page.$eval('#language-toggle', el => getComputedStyle(el).cursor), 'pointer');
  await page.click('#language-toggle');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.$eval('#language-toggle', el => el.textContent), '中文');
  assert.equal(await page.$eval('.brief h2', el => el.textContent), 'Tail vertebra exposure, needs confirmation');
  assert.equal(await page.$eval('[data-tool="shovel"] span', el => el.textContent), 'Trowel');
  assert.equal(await page.$eval('#dig', el => el.textContent), 'Trowel once');
  assert.equal(await page.$eval('#layer', el => el.textContent), 'Loose slope deposits');
  assert.equal(await page.$eval('#fossil', el => el.textContent), 'Not found');
  assert.equal(await page.$eval('#language-toggle', el => el.getAttribute('aria-label')), 'Switch language · 中文');
  await page.click('#language-toggle');
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  assert.equal(await page.$eval('#language-toggle', el => el.textContent), 'English');
  assert.deepEqual(errors, []);
  console.log('PASS: 3d scene loads and bottom-right language toggle switches HUD/tool copy');
} finally {
  await browser.close();
}
