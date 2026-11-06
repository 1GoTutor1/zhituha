import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const voiceDir = path.join(here, 'voice');
const lines = [
  'Три района. Один город — и твой следующий шаг.',
  'Здесь бизнес привязан к месту: кофейню ищут в своём районе.',
  'Поехал сам — потратил двадцать энергии. На своей машине — всего пять.',
  'Нужно быстрее? Закажи такси. Эконом, комфорт или бизнес — от пятисот до девятисот рублей.',
  'Выбирай район, открывай своё дело и строй жизнь по-своему. Житуха — заходи в Telegram.',
];
fs.mkdirSync(voiceDir, { recursive: true });
for (let i = 0; i < lines.length; i++) {
  const n = String(i + 1).padStart(2, '0');
  const args = ['-3.12', '-m', 'edge_tts', '--voice', 'ru-RU-DmitryNeural', '--text', lines[i], '--write-media', path.join(voiceDir, `line-${n}.mp3`), '--write-subtitles', path.join(voiceDir, `line-${n}.srt`)];
  let result;
  for (let attempt = 1; attempt <= 4; attempt++) {
    result = spawnSync('py', args, { encoding: 'utf8' });
    if (result.status === 0) break;
    console.warn(`Voice line ${n}, attempt ${attempt}/4 returned no audio.`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (result.status !== 0) throw new Error(`Edge TTS failed for line ${n}: ${(result.stderr || result.stdout || '').slice(-1200)}`);
  console.log(`Generated line ${n}: ${lines[i]}`);
}
fs.writeFileSync(path.join(here, 'narration.txt'), `${lines.join('\n')}\n`, 'utf8');
