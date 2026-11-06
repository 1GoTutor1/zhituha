import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const tools = 'C:/Users/Пользователь/AppData/Local/Temp/zhituha-production-tools/node_modules';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(tools, 'playwright'));
const ffmpeg = require(path.join(tools, 'ffmpeg-static'));
if (!fs.existsSync(path.join(here, 'factory-gate-animation.html'))) throw new Error('Run build-gate-preview.mjs first.');
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));
if (!browserPath) throw new Error('Chrome or Edge not found for export.');

const output = path.join(here, 'factory-gate-15s.mp4');
const fps = 30, frames = 450;
const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 2000 }, deviceScaleFactor: 1 });
page.on('pageerror', error => { console.error('Browser error:', error.message); });
await page.goto(pathToFileURL(path.join(here, 'factory-gate-animation.html')).href, { waitUntil: 'load' });
await page.addStyleTag({ content: '.app{width:1080px!important;min-height:1920px!important}.viewer{min-height:1920px!important;height:1920px!important;flex:none!important}.frame{width:1080px!important;height:1920px!important;max-width:none!important;min-height:0!important}' });
await page.waitForTimeout(100);
const videoProc = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
  '-frames:v', String(frames), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-r', String(fps), '-t', '15', output,
], { stdio: ['pipe', 'ignore', 'pipe'] });
let stderr = '';
videoProc.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 10000) stderr = stderr.slice(-10000); });
const finished = once(videoProc, 'close');
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.renderAt(t), i / fps);
  const png = await page.locator('#frame').screenshot({ type: 'png', timeout: 30000, animations: 'disabled' });
  if (!videoProc.stdin.write(png)) await once(videoProc.stdin, 'drain');
  if ((i + 1) % 60 === 0) console.log(`Rendered ${i + 1}/${frames} frames (${((i + 1) / fps).toFixed(1)}s)`);
}
videoProc.stdin.end();
const [code] = await finished;
await browser.close();
if (code !== 0) throw new Error(`FFmpeg export failed: ${stderr}`);
console.log(`Exported ${output} — 15.00 seconds, ${fps} FPS, 1080×1920, silent.`);
