import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tools = path.join(process.env.TEMP, 'zhituha-production-tools', 'node_modules');
const { chromium } = require(path.join(tools, 'playwright'));
const ffmpeg = require(path.join(tools, 'ffmpeg-static'));
const duration = 27;
const fps = 30;
const frameCount = duration * fps;
const html = path.join(here, 'promo.html');
const output = path.join(here, 'player-business-origin-silent.mp4');

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
if (!browserPath) throw new Error('Chrome/Edge executable not found');

const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;caret-color:transparent!important}' });

const encoder = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
  '-frames:v', String(frameCount), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
], { stdio: ['pipe', 'ignore', 'pipe'] });
let encoderError = '';
encoder.stderr.on('data', chunk => { encoderError = (encoderError + chunk).slice(-10000); });
const encoderDone = once(encoder, 'close');
for (let frame = 0; frame < frameCount; frame += 1) {
  await page.evaluate(time => window.renderAt(time), frame / fps);
  const png = await page.locator('.frame').screenshot({ type: 'png' });
  if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
  if (frame % 150 === 149) console.log(`Rendered ${frame + 1}/${frameCount} frames`);
}
encoder.stdin.end();
const [code] = await encoderDone;
await browser.close();
if (code !== 0) throw new Error(encoderError || `ffmpeg exited with ${code}`);
console.log(`Exported silent preview ${output}: ${duration}s, ${fps}fps, 1080x1920`);
