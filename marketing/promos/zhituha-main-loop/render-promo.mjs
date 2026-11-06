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
const duration = 26;
const fps = 30;
const frameCount = duration * fps;
const html = path.join(here, 'promo.html');
const silent = path.join(here, 'zhituha-main-loop-silent.mp4');
const output = path.join(here, 'zhituha-main-loop.mp4');
const captions = [
  [0.10, 3.04, 'С чего начинается большая жизнь?'],
  [3.09, 5.773, 'С твоего первого решения.'],
  [5.773, 10.38, 'Выбирай профессию, выполняй заказы\nи копи на своё дело.'],
  [10.38, 16.324, 'Открой бизнес: пополняй товар, устанавливай цены,\nследи за кассой и продажами.'],
  [16.324, 20.956, 'Покупай машины, открывай новые возможности\nи расти дальше.'],
  [20.956, 22.635, 'Житуха.'],
  [22.635, 24.682, 'Заходи в игру.'],
];

async function run(args) {
  const process = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let error = '';
  process.stderr.on('data', chunk => { error = (error + chunk).slice(-8000); });
  const [code] = await once(process, 'close');
  if (code !== 0) throw new Error(error || `ffmpeg exited with ${code}`);
}

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await page.addStyleTag({ content: '*{transition:none!important;animation:none!important;caret-color:transparent!important}' });

const renderProcess = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
  '-frames:v', String(frameCount), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent,
], { stdio: ['pipe', 'ignore', 'pipe'] });
let renderError = '';
renderProcess.stderr.on('data', chunk => { renderError = (renderError + chunk).slice(-8000); });
const renderDone = once(renderProcess, 'close');
for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / fps;
  await page.evaluate(value => window.renderAt(value), time);
  const png = await page.locator('.frame').screenshot({ type: 'png' });
  if (!renderProcess.stdin.write(png)) await once(renderProcess.stdin, 'drain');
  if (frame % 150 === 149) console.log(`Rendered ${frame + 1}/${frameCount} frames`);
}
renderProcess.stdin.end();
const [renderCode] = await renderDone;
await browser.close();
if (renderCode !== 0) throw new Error(renderError || `video render exited with ${renderCode}`);

const filter =
  `[1:a]apad=pad_dur=${duration},atrim=duration=${duration},volume=1.04,asplit=2[voice][ducksrc];` +
  `[2:a]atrim=duration=${duration},volume=0.19,afade=t=in:st=0:d=0.8,afade=t=out:st=24.5:d=1.5[bed];` +
  '[bed][ducksrc]sidechaincompress=threshold=0.025:ratio=4:attack=90:release=600[duck];' +
  '[3:a]atrim=duration=2.2,asetpts=PTS-STARTPTS,volume=0.18,adelay=11900|11900[coffee];' +
  '[voice][duck][coffee]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]';
await run([
  '-y', '-i', silent,
  '-i', path.join(here, 'voiceover.mp3'),
  '-stream_loop', '-1', '-i', path.join(here, 'assets', 'music-bed.wav'),
  '-i', path.join(here, 'assets', 'coffee-pour.mp3'),
  '-filter_complex', filter, '-map', '0:v:0', '-map', '[a]', '-t', String(duration),
  '-r', String(fps), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
]);

const stamp = seconds => {
  const total = Math.round(seconds * 1000);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
};
const srt = captions.map(([start, end, text], index) => `${index + 1}\n${stamp(start)} --> ${stamp(end)}\n${text}`).join('\n\n') + '\n';
fs.writeFileSync(path.join(here, 'zhituha-main-loop.srt'), `\uFEFF${srt}`, 'utf8');
console.log(`Exported ${output}: ${duration}s, ${fps}fps, 1080x1920`);
