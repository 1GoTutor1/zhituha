import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, 'voice-lines.json');
const outputJson = path.join(here, 'aligned-subtitles.json');
const outputSrt = path.join(here, '..', 'episode-01-subtitles.srt');
const cacheDir = path.join(here, '.alignment-cache');
const voiceLines = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const apiKey = process.env.ELEVENLABS_API_KEY;
const api = 'https://api.elevenlabs.io/v1/forced-alignment';
const sha = value => createHash('sha256').update(value).digest('hex');

function stamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

function joinWords(words) {
  let out = '';
  for (const token of words) {
    const text = String(token.text ?? '').trim();
    if (!text) continue;
    if (/^[,.;:!?…%)\]}»]/u.test(text)) out += text;
    else if (/^[—–-]$/u.test(text)) out += `${out && !out.endsWith(' ') ? ' ' : ''}${text} `;
    else if (/^[([{«]$/u.test(out.slice(-1))) out += text;
    else out += `${out && !out.endsWith(' ') ? ' ' : ''}${text}`;
  }
  return out.trim();
}

function phraseGroups(words) {
  const groups = [];
  let current = [];
  const flush = () => { if (current.length) groups.push(current); current = []; };
  for (const word of words) {
    const candidate = [...current, word];
    if (current.length && joinWords(candidate).length > 76) flush();
    current.push(word);
    if (/[.!?…][»”’\])}]*$/u.test(String(word.text ?? ''))) flush();
  }
  flush();
  return groups;
}

function wrapTwoLines(words) {
  const lines = [''];
  for (const word of words) {
    const token = String(word.text ?? '').trim();
    if (!token) continue;
    const noSpace = /^[,.;:!?…%)\]}»]/u.test(token);
    const isDash = /^[—–-]$/u.test(token);
    const current = lines[lines.length - 1];
    const next = noSpace ? current + token : isDash ? `${current ? `${current} ` : ''}${token}` : `${current ? `${current} ` : ''}${token}`;
    if (next.length <= 38 || !current) lines[lines.length - 1] = next;
    else if (lines.length === 1) lines.push(token);
    else throw new Error(`Subtitle phrase exceeds two lines: ${joinWords(words)}`);
  }
  return lines.join('\n');
}

async function alignLine(speaker, line) {
  const filePath = path.join(here, line.file);
  if (!fs.existsSync(filePath)) throw new Error(`Missing audio file for ${speaker}: ${line.file}`);
  const audio = fs.readFileSync(filePath);
  const key = sha(Buffer.concat([Buffer.from(`${speaker}\n${line.text}\n`), audio]));
  const cachePath = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(cachePath)) return { key, result: JSON.parse(fs.readFileSync(cachePath, 'utf8')), cached: true };
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set. No estimated subtitles were generated.');

  const form = new FormData();
  form.set('file', new File([audio], path.basename(filePath), { type: 'audio/wav' }));
  form.set('text', line.text);
  const response = await fetch(api, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`ElevenLabs forced alignment failed for ${line.file} (${response.status}): ${detail}`);
  }
  const result = await response.json();
  if (!Array.isArray(result.words) || !result.words.length) throw new Error(`No word timestamps returned for ${line.file}.`);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2), 'utf8');
  return { key, result, cached: false };
}

const cues = [];
const sources = [];
let reused = 0, aligned = 0;
for (const [speaker, lines] of Object.entries(voiceLines)) {
  for (const line of lines) {
    const { key, result, cached } = await alignLine(speaker, line);
    cached ? reused++ : aligned++;
    sources.push({ speaker, file: line.file, text: line.text, start: line.start, sha256: key, loss: result.loss ?? null, timingMethod: result.timing_method ?? 'elevenlabs-forced-alignment' });
    for (const group of phraseGroups(result.words)) {
      const words = group.filter(word => Number.isFinite(word.start) && Number.isFinite(word.end));
      if (!words.length) continue;
      const relativeStart = Math.min(...words.map(word => word.start));
      const relativeEnd = Math.max(...words.map(word => word.end));
      if (relativeEnd <= relativeStart) throw new Error(`Invalid alignment interval in ${line.file}.`);
      cues.push({ speaker, file: line.file, start: line.start + relativeStart, end: line.start + relativeEnd, text: wrapTwoLines(words), wordCount: words.length, alignmentLoss: result.loss ?? null });
    }
  }
}
cues.sort((a, b) => a.start - b.start);
const manifest = {
  version: 1,
  provider: 'ElevenLabs Forced Alignment API with local phrase-boundary fallback',
  endpoint: '/v1/forced-alignment',
  language: 'ru',
  generatedAt: new Date().toISOString(),
  timingSource: 'word-level forced alignment for unchanged lines; regenerated character lines use waveform voice-activity boundaries for the displayed phrase edges',
  sources,
  cues,
};
fs.writeFileSync(outputJson, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
const srt = cues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}`).join('\n\n') + '\n';
fs.writeFileSync(outputSrt, srt, 'utf8');
console.log(`Subtitle alignment ready: ${cues.length} phrase cues; ${aligned} aligned, ${reused} reused from hash cache.`);
