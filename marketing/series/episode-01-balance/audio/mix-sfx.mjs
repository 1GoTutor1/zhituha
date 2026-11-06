import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ffmpeg = require(path.join(process.env.TEMP || process.env.TMPDIR || '', 'zhituha-production-tools', 'node_modules', 'ffmpeg-static'));
const timeline = JSON.parse(fs.readFileSync(path.join(here, 'episode-timeline.json'), 'utf8'));
const duration = timeline.duration;
const sources = path.join(here, 'sources');

function run(args, label) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); if (stderr.length > 6000) stderr = stderr.slice(-6000); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${label} failed (${code}):\n${stderr}`)));
  });
}

async function makeTrack(input, output, filter) {
  const args = ['-y'];
  if (input) args.push('-i', path.join(sources, input));
  else args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${duration}`);
  args.push('-filter_complex', `${filter};[a]aresample=44100,aformat=sample_fmts=s16:channel_layouts=mono,apad,atrim=duration=${duration}[out]`,
    '-map', '[out]', '-c:a', 'pcm_s16le', path.join(here, output));
  await run(args, `Create ${output}`);
}

// A recorded indoor room tone, low in the mix and gently faded around the night scene.
await makeTrack('roomtone.mp3', 'sfx-roomtone.wav',
  `[0:a]atrim=0:${timeline.effects.roomEnd},afade=t=in:st=0:d=1.8,afade=t=out:st=${timeline.effects.roomEnd-1.8}:d=1.8,volume=0.024[a]`);

// Real distant factory ambience; fades in at the gate and out before the coffee-sale close-up.
await makeTrack('factory.mp3', 'sfx-factory.wav',
  `[0:a]atrim=0:22.2,afade=t=in:st=0:d=2.0,afade=t=out:st=19.8:d=2.4,volume=0.035,adelay=${Math.round(timeline.effects.factoryStart*1000)}|${Math.round(timeline.effects.factoryStart*1000)}[a]`);

// One muted table vibration at the phone moment. No repeated electronic notification.
await makeTrack('phone.mp3', 'sfx-phone.wav',
  `[0:a]atrim=0:1.2,afade=t=in:st=0:d=0.06,afade=t=out:st=0.92:d=0.28,volume=0.14,adelay=${Math.round(timeline.effects.phoneBuzz*1000)}|${Math.round(timeline.effects.phoneBuzz*1000)}[a]`);

// A short natural pour under the first sale scene. Other transactional/UI sounds are omitted.
await makeTrack('coffee.mp3', 'sfx-coffee.wav',
  `[0:a]atrim=0.45:duration=1.65,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.16,afade=t=out:st=1.25:d=0.4,volume=0.11,adelay=${Math.round((timeline.effects.coffeePour+1.317)*1000)}|${Math.round((timeline.effects.coffeePour+1.317)*1000)}[a]`);

const inputs = ['sfx-roomtone.wav', 'sfx-factory.wav', 'sfx-phone.wav', 'sfx-coffee.wav'];
const args = ['-y'];
for (const name of inputs) args.push('-i', path.join(here, name));
const mix = inputs.map((_, i) => `[${i}:a]`).join('') +
  `amix=inputs=${inputs.length}:duration=longest:normalize=0:dropout_transition=0,alimiter=limit=0.75,apad,atrim=duration=${duration}[out]`;
args.push('-filter_complex', mix, '-map', '[out]', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', path.join(here, 'sfx.wav'));
await run(args, 'Mix SFX stem');
console.log(`Created a subdued ${duration.toFixed(3)}s SFX mix and preserved four separate timeline-aligned WAV stems.`);
