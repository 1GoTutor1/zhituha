import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ffmpeg = require(path.join(process.env.TEMP, 'zhituha-production-tools', 'node_modules', 'ffmpeg-static'));
const lines = [
  'В этом городе всё начинается с тебя.',
  'Первая работа. Первые деньги — твои.',
  'Открой свою кофейню. Собери команду.',
  'Пополняй запас. Продавай. Расти.',
  'Житуха. Заходи в игру.',
];
const starts = [0, 5.4, 10.8, 16.2, 21.6];
const segments = lines.map((_, i) => path.join(here, 'voice-segments', `scene-${String(i + 1).padStart(2, '0')}.mp3`));

function run(args) {
  const result = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 4 });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited ${result.status}`);
  return result.stderr;
}

function duration(file) {
  const result = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const match = result.stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Could not read audio duration: ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const audioDurations = segments.map(duration);
if (audioDurations.some((seconds, i) => seconds > (i < 4 ? 5.4 : 5.4))) {
  throw new Error('A narration line overlaps the next scene; shorten it before mixing.');
}

const voice = path.join(here, 'voiceover.mp3');
const inputs = segments.flatMap(file => ['-i', file]);
const filters = segments.map((_, i) => `[${i}:a]adelay=${Math.round(starts[i] * 1000)}|${Math.round(starts[i] * 1000)}[a${i}]`);
filters.push(`[${segments.map((_, i) => `[a${i}]`).join('')} ]`);
filters[filters.length - 1] = `${segments.map((_, i) => `[a${i}]`).join('')}amix=inputs=${segments.length}:duration=longest:normalize=0,apad,atrim=duration=27,loudnorm=I=-16:TP=-1.5:LRA=9[out]`;
run(['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', voice]);

const video = path.join(here, 'player-business-origin-silent.mp4');
const finalVideo = path.join(here, 'player-business-origin.mp4');
run(['-y', '-i', video, '-i', voice, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', '27', '-movflags', '+faststart', finalVideo]);

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}
const srt = lines.map((line, i) => `${i + 1}\n${srtTime(starts[i])} --> ${srtTime(starts[i] + audioDurations[i] - 0.08)}\n${line}\n`).join('\n');
fs.writeFileSync(path.join(here, 'player-business-origin.srt'), srt, 'utf8');
console.log(`Assembled ${finalVideo}; 27s narration mix, -16 LUFS target, and phrase-level SRT.`);
audioDurations.forEach((seconds, i) => console.log(`Scene ${i + 1}: starts at ${starts[i].toFixed(1)}s, narration ${seconds.toFixed(2)}s`));
