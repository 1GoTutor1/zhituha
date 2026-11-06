import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(here, 'audio');
const timeline = JSON.parse(fs.readFileSync(path.join(audioDir, 'episode-timeline.json'), 'utf8'));
const duration = timeline.duration;
const fps = 30;
const frames = Math.round(duration * fps);
const silentProof = process.env.EPISODE_PROOF_SILENT === '1';
const tempTools = path.join(process.env.TEMP || process.env.TMPDIR || '', 'zhituha-production-tools', 'node_modules');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(tempTools, 'playwright'));
const ffmpeg = require(path.join(tempTools, 'ffmpeg-static'));
if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('ffmpeg-static executable not found in the temporary production tools.');

function run(args, label) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${label} failed (${code}):\n${stderr}`)));
  });
}

function runNode(script, label) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script], { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${label} failed (${code}):\n${stderr}`)));
  });
}

// The silent character proof contains no voice and no captions, so it does not need the alignment API.
if (!silentProof) await runNode(path.join(audioDir, 'align-subtitles.mjs'), 'ElevenLabs subtitle alignment');
await runNode(path.join(here, 'build-episode.mjs'), 'Production HTML build');

const voiceManifest = JSON.parse(fs.readFileSync(path.join(audioDir, 'voice-lines.json'), 'utf8'));
function delayFilter(start) { return `adelay=${Math.round(start * 1000)}`; }
async function mixVoiceGroup(speaker, output) {
  const lines = voiceManifest[speaker];
  const args = ['-y'];
  for (const line of lines) args.push('-i', path.join(audioDir, line.file));
  let filter;
  if (lines.length === 1) {
    filter = `[0:a]${delayFilter(lines[0].start)},apad,atrim=duration=${duration}[a]`;
  } else {
    const parts = lines.map((line, i) => `[${i}:a]${delayFilter(line.start)}[v${i}]`).join(';');
    const inputs = lines.map((_, i) => `[v${i}]`).join('');
    filter = `${parts};${inputs}amix=inputs=${lines.length}:duration=longest:normalize=0,apad,atrim=duration=${duration}[a]`;
  }
  args.push('-filter_complex', filter, '-map', '[a]', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', path.join(audioDir, output));
  await run(args, `Voice stem ${speaker}`);
}

await mixVoiceGroup('narrator', 'narrator.wav');
await mixVoiceGroup('anton', 'anton.wav');
await mixVoiceGroup('buyer', 'buyer.wav');

function wavDuration(file) {
  const b = fs.readFileSync(path.join(audioDir, file));
  const bytesPerSecond = b.readUInt32LE(28);
  let offset = 12;
  while (offset + 8 <= b.length) {
    const chunk = b.toString('ascii', offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    if (chunk === 'data') return size / bytesPerSecond;
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV data chunk not found in ${file}`);
}
function stamp(seconds) {
  const ms = Math.round(seconds * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(r).padStart(3,'0')}`;
}
const silentVideo = path.join(here, silentProof ? 'episode-01-animation-only.mp4' : 'episode-01-aligned-silent.mp4');
{
  const browserPathCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  const executablePath = browserPathCandidates.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('Chrome/Edge executable was not found for rendering.');
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1994 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('Browser page error:', e.message); process.exitCode = 1; });
  await page.goto(pathToFileURL(path.join(here,'episode-01-production.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  // The web player has short UI fades. Disable them during deterministic capture.
  await page.addStyleTag({ content: '.shot, .subtitle { transition: none !important; }' });
  console.log('Browser ready; frame bounds:', await page.locator('.frame').boundingBox());
  const videoProc = spawn(ffmpeg, [
    '-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0',
    '-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',
    '-movflags','+faststart',silentVideo
  ], { stdio: ['pipe','ignore','pipe'] });
  let encodeErrors='';
  videoProc.stderr.on('data', d => { encodeErrors += d.toString(); if (encodeErrors.length > 12000) encodeErrors=encodeErrors.slice(-12000); });
  const done = once(videoProc,'close');
  for (let i=0; i<frames; i++) {
    const t=i/fps;
    await page.evaluate(t=>window.renderAt(t),t);
    if (i===0) console.log('Timeline initialized; capturing first frame.');
    const png=await page.locator('.frame').screenshot({ type:'png', timeout:30000, animations:'disabled' });
    if (i===0) console.log(`First frame captured (${png.length} bytes).`);
    if (!videoProc.stdin.write(png)) await once(videoProc.stdin,'drain');
    if ((i+1)%30===0) console.log(`Rendered ${i+1}/${frames} frames (${((i+1)/fps).toFixed(1)}s)`);
  }
  videoProc.stdin.end();
  const [exitCode]=await done;
  await page.close(); await browser.close();
  if (exitCode!==0) throw new Error(`Video encoding failed (${exitCode}):\n${encodeErrors}`);
}

if (silentProof) {
  console.log(`Animation-only episode exported: ${silentVideo} (${duration}s, ${fps}fps, 1080x1920; no audio or subtitles).`);
  process.exit(0);
}

const finalVideo=path.join(here,'episode-01-final.mp4');
await run([
  '-y','-i',silentVideo,
  '-i',path.join(audioDir,'narrator.wav'),'-i',path.join(audioDir,'anton.wav'),'-i',path.join(audioDir,'buyer.wav'),
  '-i',path.join(audioDir,'sfx.wav'),'-i',path.join(audioDir,'music.wav'),
  '-filter_complex',`[1:a]volume=1.0[n];[2:a]volume=1.0[a];[3:a]volume=1.0[b];[4:a]volume=1.0[f];[5:a]volume=0.4[m];[n][a][b]amix=inputs=3:duration=longest:normalize=0:dropout_transition=0[voiceBase];[voiceBase]asplit=2[voiceKey][voiceMix];[m][voiceKey]sidechaincompress=threshold=0.035:ratio=5:attack=80:release=650:makeup=1[duckedMusic];[voiceMix][f][duckedMusic]amix=inputs=3:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.92,apad,atrim=duration=${duration}[out]`,
  '-map','0:v:0','-map','[out]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),
  '-metadata','title=Житуха — пилотная серия 1','-metadata','comment=SVG 2D animation; Russian synthetic voice draft','-movflags','+faststart',finalVideo
], 'Final H.264/AAC mux');
console.log(`Export complete: ${finalVideo} (${duration}s, ${fps}fps, 1080x1920).`);
