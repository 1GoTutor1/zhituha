import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.TEMP,'zhituha-production-tools','node_modules','playwright'));
const ffmpeg=require(path.join(process.env.TEMP,'zhituha-production-tools','node_modules','ffmpeg-static'));
const duration=15,fps=30,frames=duration*fps;
const html=path.join(here,'promo.html');
const silent=path.join(here,'zhituha-family-rush-silent.mp4');
const output=path.join(here,'zhituha-family-rush.mp4');
const voice=path.resolve(here,'../zhituha-30s/voiceover.wav');
const music=path.resolve(here,'../zhituha-30s/music-bed.wav');
const sfx=path.resolve(here,'../zhituha-30s/ui-sfx.wav');
const narration=path.join(here,'narration-approved-voice-excerpt.wav');
const exe=fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
  ?'C:/Program Files/Google/Chrome/Application/chrome.exe'
  :'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function run(args){
  const p=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe']});
  let err='';p.stderr.on('data',chunk=>err=(err+chunk).slice(-9000));
  const [code]=await once(p,'close');
  if(code!==0)throw new Error(err||`ffmpeg exited ${code}`);
}

if(!fs.existsSync(silent)||fs.statSync(html).mtimeMs>fs.statSync(silent).mtimeMs){
  const browser=await chromium.launch({headless:true,executablePath:exe,args:['--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  await page.goto(pathToFileURL(html).href,{waitUntil:'load'});
  await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});
  const renderer=spawn(ffmpeg,['-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','ignore','pipe']});
  let renderErr='';renderer.stderr.on('data',chunk=>renderErr=(renderErr+chunk).slice(-9000));
  const renderDone=once(renderer,'close');
  for(let i=0;i<frames;i++){
    await page.evaluate(t=>window.renderAt(t),i/fps);
    const png=await page.locator('.frame').screenshot({type:'png'});
    if(!renderer.stdin.write(png))await once(renderer.stdin,'drain');
    if(i%90===89)console.log(`Rendered ${i+1}/${frames} frames`);
  }
  renderer.stdin.end();
  const [renderCode]=await renderDone;
  await browser.close();
  if(renderCode!==0)throw new Error(renderErr||`video render exited ${renderCode}`);
}

// Reuse the actual approved narrator performance from yesterday's promo;
// the same excerpt is used here so no new voice is synthesized or substituted.
await run(['-y','-i',voice,'-ss','14.42','-t','13.28','-c:a','pcm_s16le',narration]);

const filter='[1:a]atrim=duration=15,apad=pad_dur=15,atrim=duration=15,volume=1.03,asplit=2[v][ducksrc];'+
  '[2:a]atrim=duration=15,afade=t=in:st=0:d=0.7,afade=t=out:st=13.7:d=1.3,volume=0.16[m];'+
  '[3:a]atrim=start=14.42:duration=13.28,asetpts=PTS-STARTPTS,apad=pad_dur=15,atrim=duration=15,volume=0.32[s];'+
  '[m][ducksrc]sidechaincompress=threshold=0.025:ratio=5:attack=100:release=650[duck];'+
  '[v][duck][s]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]';
await run(['-y','-i',silent,'-i',narration,'-i',music,'-i',sfx,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-t',String(duration),'-r',String(fps),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',output]);

const srt=[
  '1\n00:00:00,070 --> 00:00:03,490\nА когда приезжает торговец\nчёрного рынка,',
  '2\n00:00:03,970 --> 00:00:06,090\nсобирай семью. Рассаду выращивай',
  '3\n00:00:06,490 --> 00:00:10,000\nмежду визитами. Успешное семейное\nсобытие принесёт пятнадцать очков.',
  '4\n00:00:10,420 --> 00:00:10,990\nЖитуха.',
  '5\n00:00:11,250 --> 00:00:13,080\nТвоя история — в твоих руках.'
].join('\n\n')+'\n';
fs.writeFileSync(path.join(here,'zhituha-family-rush.srt'),'\ufeff'+srt,'utf8');
fs.writeFileSync(path.join(here,'SOURCE_NOTES.md'),[
  '# Житуха — новый короткий ролик',
  '',
  'Финальная дорожка использует тот же ранее утверждённый голос рассказчика: взят фрагмент 14.42–27.70 с прошлой озвучки. Новый TTS-вариант не создавался.',
  '',
  'Факты в кадре: рынок работает с 07:00 до 11:00 и с 15:00 до 19:00 по Москве; выращивание занимает 4 часа; урожай обычно 10, иногда 8 или 12 единиц; успешное семейное событие даёт 15 очков семье.',
  '',
  'Экспорт: 1080×1920, 30 FPS, 15 секунд. Субтитры встроены в видео и дополнительно приложены в SRT.',
  ''
].join('\n'),'utf8');
console.log(`Exported ${output} (${duration}s, ${fps}fps, 1080x1920)`);
