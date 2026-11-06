import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sampleRate = 44100;
const seconds = JSON.parse(fs.readFileSync(path.join(dir, 'episode-timeline.json'), 'utf8')).duration;
const length = Math.round(sampleRate * seconds);
function writeWav(file, render) {
  const data = Buffer.alloc(44 + length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + length * 2, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24); data.writeUInt32LE(sampleRate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const v = Math.max(-.98, Math.min(.98, render(t, i)));
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(dir, file), data);
}

// Quiet original ambient bed: warm harmonic pad with long fades and no borrowed melody.
writeWav('music.wav', (t) => {
  const fade = Math.min(1, t / 2.5, (seconds - t) / 4);
  const notes = [110, 164.81, 220, 261.63];
  let v = 0;
  for (let n = 0; n < notes.length; n++) v += Math.sin(2 * Math.PI * notes[n] * t + n * .53) * (.012 / (n + 1));
  v += Math.sin(2 * Math.PI * 55 * t) * .008;
  return v * Math.max(0, fade);
});

console.log('Created the music stem. Recorded SFX are built separately by mix-sfx.mjs.');
