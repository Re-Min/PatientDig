// Shared headless-Chrome helpers for the smoke test and debug screenshots.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].filter(Boolean);

export async function launch() {
  const executablePath = CANDIDATES.find(p => existsSync(p));
  if (!executablePath) throw new Error('No Chrome/Edge found; set CHROME_PATH');
  return puppeteer.launch({
    executablePath,
    headless: true,
    // Use the real GPU through ANGLE/D3D11 so WebGL works headless.
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
}
