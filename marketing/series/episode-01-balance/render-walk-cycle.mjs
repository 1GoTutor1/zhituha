import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.join(process.env.TEMP || process.env.TMPDIR || '', 'zhituha-production-tools', 'node_modules');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(tools, 'playwright'));
const ffmpeg = require(path.join(tools, 'ffmpeg-static'));
const html = path.join(here, 'episode-01-walk-cycle.html');
if (!fs.existsSync(html)) throw new Error('Run build-walk-cycle.mjs first.');
const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!browserPath) throw new Error('Chrome or Edge executable not found.');
const duration = 8, fps = 30, frames = duration * fps;
const output = path.join(here, 'episode-01-walk-cycle.mp4');
const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 2000 }, deviceScaleFactor: 1 });
page.on('pageerror', error => { console.error('Browser error:', error.message); process.exitCode = 1; });
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await page.addStyleTag({ content: '.app{height:1994px!important}.frame{height:1920px!important;width:1080px!important;max-width:none!important}.controls{display:none!important}' });
await page.waitForTimeout(100);
const proc = spawn(ffmpeg, ['-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-r',String(fps),'-t',String(duration),output], { stdio: ['pipe','ignore','pipe'] });
let errors = '';
proc.stderr.on('data', chunk => { errors += chunk.toString(); if (errors.length > 8000) errors = errors.slice(-8000); });
const done = once(proc, 'close');
for (let i=0; i<frames; i++) {
  await page.evaluate(t => window.renderAt(t), i/fps);
  const png = await page.locator('#frame').screenshot({ type: 'png', animations: 'disabled', timeout: 30000 });
  if (!proc.stdin.write(png)) await once(proc.stdin, 'drain');
}
proc.stdin.end();
const [code] = await done;
await page.close(); await browser.close();
if (code !== 0 || process.exitCode) throw new Error(`Walk-cycle export failed: ${errors}`);
console.log(`Exported ${output} (${duration}s, ${fps}fps, 1080x1920, silent).`);
