import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const toolsDir = path.join(process.env.TEMP, 'zhituha-production-tools', 'node_modules');
const { chromium } = require(path.join(toolsDir, 'playwright'));
const ffmpeg = require(path.join(toolsDir, 'ffmpeg-static'));
const fps = 30;
const segmentPaths = [1, 2, 3, 4].map(i => path.join(here, 'voice', `line-${String(i).padStart(2, '0')}.mp3`));
const srtPaths = [1, 2, 3, 4].map(i => path.join(here, 'voice', `line-${String(i).padStart(2, '0')}.srt`));
const musicPath = path.join(here, 'assets', 'music-bed-brighter.wav');
const pourPath = path.join(here, 'assets', 'coffee-pour.mp3');
const htmlPath = path.join(here, 'promo.html');
const silentPath = path.join(here, 'zhituha-launch-silent.mp4');
const finalPath = path.join(here, 'zhituha-launch.mp4');
const srtOutPath = path.join(here, 'zhituha-launch.srt');
const timelinePath = path.join(here, 'timeline.json');

function durationOf(file) {
  const result = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const match = (result.stderr || '').match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Can't read duration: ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
function parseSrt(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
  return raw.split(/\r?\n\s*\r?\n/u).map(block => {
    const lines = block.split(/\r?\n/u);
    const match = lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/u);
    if (!match) return null;
    const sec = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
    return { start: sec(...match.slice(1, 5)), end: sec(...match.slice(5, 9)), text: lines.slice(2).join(' ').trim() };
  }).filter(Boolean);
}
function wrapCaption(text) {
  if (text.length <= 40) return text;
  let split = text.lastIndexOf(' ', 40);
  if (split < 18) split = text.indexOf(' ', 40);
  return split > 0 && split < text.length - 1 ? `${text.slice(0, split)}\n${text.slice(split + 1)}` : text;
}
function stamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}
async function run(args) {
  const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-10000); });
  const [code] = await once(proc, 'close');
  if (code !== 0) throw new Error(stderr || `ffmpeg exited ${code}`);
}

for (const file of [...segmentPaths, ...srtPaths, musicPath, pourPath, htmlPath]) {
  if (!fs.existsSync(file)) throw new Error(`Required promo source is missing: ${file}`);
}
const gap = 0.22;
const voiceDurations = segmentPaths.map(durationOf);
const voiceStarts = [];
let cursor = 0;
for (const duration of voiceDurations) {
  voiceStarts.push(cursor);
  cursor += duration + gap;
}
const finalLineCues = parseSrt(srtPaths.at(-1));
const ctaCue = [...finalLineCues].reverse().find(cue => /Telegram/u.test(cue.text)) || finalLineCues.at(-1);
const ctaStart = voiceStarts.at(-1) + ctaCue.start;
const duration = voiceStarts.at(-1) + voiceDurations.at(-1) + 2.1;
const sceneStarts = [voiceStarts[0], voiceStarts[1], voiceStarts[2], voiceStarts[3], ctaStart];
const captions = srtPaths.flatMap((file, i) => parseSrt(file).map(cue => ({
  start: voiceStarts[i] + cue.start,
  end: Math.min(duration, voiceStarts[i] + cue.end),
  text: wrapCaption(cue.text),
})));
const timeline = { fps, duration, starts: sceneStarts, voiceStarts, voiceDurations, ctaStart, captions };
fs.writeFileSync(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
fs.writeFileSync(srtOutPath, `${captions.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}`).join('\n\n')}\n`, 'utf8');

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(fs.existsSync);
if (!browserPath) throw new Error('Chrome or Edge was not found');
if (!fs.existsSync(silentPath) || fs.statSync(silentPath).size === 0 || fs.statSync(silentPath).mtimeMs < fs.statSync(htmlPath).mtimeMs) {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.evaluate(value => window.setTimeline(value), timeline);
  const frames = Math.ceil(duration * fps);
  const encoder = spawn(ffmpeg, [
    '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-frames:v', String(frames), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silentPath,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encodeError = '';
  encoder.stderr.on('data', chunk => { encodeError = (encodeError + chunk).slice(-10000); });
  const encoderDone = once(encoder, 'close');
  for (let frame = 0; frame < frames; frame += 1) {
    await page.evaluate(time => window.renderAt(time), frame / fps);
    const png = await page.locator('.frame').screenshot({ type: 'png' });
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (frame % 150 === 149) console.log(`Rendered ${frame + 1}/${frames} frames`);
  }
  encoder.stdin.end();
  const [videoCode] = await encoderDone;
  await browser.close();
  if (videoCode !== 0) throw new Error(encodeError || `silent video encode failed: ${videoCode}`);
}

const voiceInputs = segmentPaths.flatMap((_, i) => ['-i', segmentPaths[i]]);
const voiceFilters = segmentPaths.map((_, i) => `[${i + 1}:a]adelay=${Math.round(voiceStarts[i] * 1000)}|${Math.round(voiceStarts[i] * 1000)},volume=1.0[v${i}]`);
const voiceMix = `${segmentPaths.map((_, i) => `[v${i}]`).join('')}amix=inputs=${segmentPaths.length}:duration=longest:normalize=0,acompressor=threshold=0.12:ratio=1.6:attack=12:release=220[voice]`;
const musicIndex = segmentPaths.length + 1, pourIndex = musicIndex + 1;
const musicStart = Math.max(0, duration - 2.2);
const mixFilter = [
  ...voiceFilters,
  voiceMix,
  `[${musicIndex}:a]atrim=duration=${duration},volume=0.18,afade=t=in:st=0:d=0.5,afade=t=out:st=${musicStart}:d=2.2[music]`,
  `[${pourIndex}:a]atrim=duration=2.2,adelay=${Math.round((voiceStarts[2] + 2.8) * 1000)}|${Math.round((voiceStarts[2] + 2.8) * 1000)},lowpass=f=5200,volume=0.07[sfx]`,
  `[voice]asplit=2[vo][duck]`,
  `[music][duck]sidechaincompress=threshold=0.03:ratio=4:attack=90:release=420[ducked]`,
  `[ducked][vo][sfx]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.78:attack=15:release=200,loudnorm=I=-16:TP=-2.5:LRA=11[audio]`,
].join(';');
await run([
  '-y', '-i', silentPath, ...voiceInputs, '-i', musicPath, '-i', pourPath,
  '-filter_complex', mixFilter, '-map', '0:v:0', '-map', '[audio]', '-t', String(duration),
  '-r', String(fps), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalPath,
]);
console.log(`Exported ${finalPath}: ${duration.toFixed(2)}s, ${fps}fps, 1080x1920`);
console.log(`Voice lines: ${voiceDurations.map(n => n.toFixed(2)).join('s, ')}s`);
console.log(`CTA screen starts at ${ctaStart.toFixed(2)}s`);
