import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
function wavDuration(file) {
  const b = fs.readFileSync(path.join(here, file));
  const bytesPerSecond = b.readUInt32LE(28);
  for (let offset = 12; offset + 8 <= b.length;) {
    const chunk = b.toString('ascii', offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    if (chunk === 'data') return size / bytesPerSecond;
    offset += 8 + size + (size % 2);
  }
  throw new Error(`WAV data chunk missing: ${file}`);
}

const source = JSON.parse(fs.readFileSync(path.join(here, 'narration-source-lines.json'), 'utf8'));
const narrator = new Map(source.map(line => [line.file, line]));
const plan = [
  ['narrator', 'narration-01.wav', 0.00, 'Дом', 'Антон устал. Каждый день одно и то же. Работа, дом, работа.'],
  ['narrator', 'narration-02.wav', 0.55, 'Баланс', 'На карте оставалось всего пятнадцать тысяч рублей.'],
  ['narrator', 'narration-03.wav', 0.55, 'Взгляд в окно', 'И он даже не представлял, что скоро рискнёт почти всеми своими деньгами.'],
  ['narrator', 'narration-04.wav', 1.15, 'Рабочие', 'Однажды он заметил рабочих, которые каждое утро спешили на смену.'],
  ['narrator', 'narration-05.wav', 0.35, 'Кофе', 'Многие даже не успевали купить горячий кофе.'],
  ['anton', 'anton-01.wav', 0.85, 'Идея', 'А что, если продавать им кофе?..'],
  ['narrator', 'narration-06.wav', 0.85, 'Покупки', 'На следующий день Антон купил старый термос, складной стол, тележку и всё необходимое.'],
  ['narrator', 'narration-07.wav', 0.45, 'Чек', 'На старт он выделил восемь с половиной тысяч рублей.'],
  ['narrator', 'narration-08.wav', 0.35, 'Остаток', 'У него осталось всего шесть с половиной.'],
  ['narrator', 'narration-09.wav', 1.60, 'Проходная', 'В половине шестого утра Антон уже стоял возле заводской проходной.'],
  ['narrator', 'narration-10.wav', 0.50, 'Ожидание', 'Люди проходили мимо.'],
  ['narrator', 'narration-11.wav', 0.60, 'Ожидание', 'Десять человек. Двадцать. Тридцать.'],
  ['narrator', 'narration-12.wav', 0.70, 'Ожидание', 'Никто не останавливался.'],
  ['buyer', 'buyer-01.wav', 1.40, 'Продажа', 'Горячий?'],
  ['anton', 'anton-02.wav', 0.35, 'Продажа', 'Да, только налил.'],
  ['narrator', 'narration-13.wav', 0.80, 'Продажа', 'Наконец первая продажа. Сто рублей.'],
  ['narrator', 'narration-14.wav', 0.55, 'Себестоимость', 'Но примерно тридцать из них — себестоимость самого кофе.'],
  ['narrator', 'narration-15.wav', 1.40, 'Финал', 'Антон смотрел на термос и думал только об одном.'],
  ['narrator', 'narration-16.wav', 0.65, 'Финал', 'Что он будет делать, если остальной кофе так никто и не купит?'],
];

let cursor = 0;
const speech = [];
const voiceLines = { narrator: [], anton: [], buyer: [] };
for (const [speaker, file, gap, scene, text] of plan) {
  cursor += gap;
  const line = narrator.get(file);
  if (!line && speaker === 'narrator') throw new Error(`Missing generated V3 line: ${file}`);
  const duration = line?.duration ?? wavDuration(file);
  const cue = { speaker, file, start: +cursor.toFixed(3), end: +(cursor + duration).toFixed(3), text, scene };
  speech.push(cue);
  voiceLines[speaker].push({ file, start: cue.start, text });
  cursor = cue.end;
}

const cue = name => speech.find(line => line.file === name);
const n1 = cue('narration-01.wav'), n2 = cue('narration-02.wav'), n3 = cue('narration-03.wav');
const n4 = cue('narration-04.wav'), n5 = cue('narration-05.wav'), idea = cue('anton-01.wav');
const buy = cue('narration-06.wav'), n7 = cue('narration-07.wav'), n8 = cue('narration-08.wav');
const gate = cue('narration-09.wav'), pass = cue('narration-10.wav'), count = cue('narration-11.wav');
const buyer = cue('buyer-01.wav'), sale = cue('narration-13.wav'), cost = cue('narration-14.wav');
const lastWait = cue('narration-12.wav');
const final1 = cue('narration-15.wav');
const shotStarts = [
  0,
  +(n1.start + (n1.end - n1.start) * 0.48).toFixed(3),
  +(n1.end - 0.50).toFixed(3),
  +(n1.end + 0.15).toFixed(3),
  +(n2.start + 0.75).toFixed(3),
  n3.start,
  n4.start,
  n5.start,
  idea.start,
  idea.end,
  buy.start,
  gate.start,
  pass.start,
  lastWait.start,
  sale.end,
];
const last = +(cursor + 2.2).toFixed(3);
const shotEnds = [...shotStarts.slice(1), last];
const shots = Object.fromEntries(shotStarts.map((start, i) => [
  `shot${String(i + 1).padStart(2, '0')}`,
  { start, end: shotEnds[i] },
]));

const timeline = {
  duration: last,
  fps: 30,
  shots,
  speech,
  effects: {
    phoneBuzz: +(n1.end + 0.15).toFixed(3),
    roomEnd: shots.shot06.end,
    factoryStart: shots.shot12.start,
    factoryEnd: shots.shot14.end,
    coffeePour: +(cue('anton-02.wav').start - 0.55).toFixed(3),
    saleStart: sale.start,
    saleEnd: sale.end,
    costStart: cost.start,
    costEnd: cost.end,
    receiptStart: n7.start,
    receiptEnd: n8.end,
  },
};

fs.writeFileSync(path.join(here, 'voice-lines.json'), JSON.stringify(voiceLines, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(here, 'episode-timeline.json'), JSON.stringify(timeline, null, 2) + '\n', 'utf8');
console.log(`Audio timeline: ${last}s; ${speech.length} spoken cues (${speech.filter(x => x.speaker === 'narrator').length} narrator, ${speech.filter(x => x.speaker === 'anton').length} Anton, ${speech.filter(x => x.speaker === 'buyer').length} buyer).`);
