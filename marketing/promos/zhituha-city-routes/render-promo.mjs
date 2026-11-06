import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const tools=path.join(process.env.TEMP,'zhituha-production-tools','node_modules');
const {chromium}=require(path.join(tools,'playwright'));
const ffmpeg=require(path.join(tools,'ffmpeg-static'));
const fps=30,duration=30,frameCount=fps*duration;
const html=path.join(here,'promo.html');
const silent=path.join(here,'zhituha-city-routes-silent.mp4');
const output=path.join(here,'zhituha-city-routes.mp4');
const srtOutput=path.join(here,'zhituha-city-routes.srt');
const voiceDir=path.join(here,'voice');
const originals=[1,2,3,4,5].map(i=>path.join(voiceDir,`line-${String(i).padStart(2,'0')}.mp3`));
const cuts=[
  {index:2,start:0,end:3.825,name:'line-03-short.mp3',text:'Поехал сам — потратил двадцать энергии.'},
  {index:3,start:0,end:4.337,name:'line-04-short.mp3',text:'Нужно быстрее? Закажи такси.'},
  {index:4,start:4.912,end:7.825,name:'line-05-outro.mp3',text:'Житуха — заходи в Telegram.'},
];
const stamp=seconds=>{const ms=Math.max(0,Math.round(seconds*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60,r=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(r).padStart(3,'0')}`};
for(const cut of cuts){
  const destination=path.join(voiceDir,cut.name),source=originals[cut.index];
  if(!fs.existsSync(source)||fs.statSync(source).size===0)throw new Error(`Missing source voice: ${source}`);
  const res=spawnSync(ffmpeg,['-y','-i',source,'-af',`atrim=start=${cut.start}:end=${cut.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0,cut.end-cut.start-.18)}:d=0.16`,'-c:a','libmp3lame','-b:a','128k',destination],{encoding:'utf8'});
  if(res.status!==0)throw new Error(`Could not trim voice: ${res.stderr}`);
  const end=cut.end-cut.start;
  fs.writeFileSync(path.join(voiceDir,cut.name.replace('.mp3','.srt')),`1\n${stamp(.08)} --> ${stamp(end-.08)}\n${cut.text}\n`,'utf8');
}
const voicePaths=[originals[0],originals[1],path.join(voiceDir,'line-03-short.mp3'),path.join(voiceDir,'line-04-short.mp3'),path.join(voiceDir,'line-05-outro.mp3')];
const srtPaths=[1,2].map(i=>path.join(voiceDir,`line-${String(i).padStart(2,'0')}.srt`)).concat(['line-03-short.srt','line-04-short.srt','line-05-outro.srt'].map(n=>path.join(voiceDir,n)));
const voiceStarts=[.2,5.5,10.9,14.95,23.3];
const sceneStarts=[0,5.35,10.8,14.85,23.15];
function parseSrt(file){const raw=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim();return raw.split(/\r?\n\s*\r?\n/u).map(block=>{const lines=block.split(/\r?\n/u),m=lines[1]?.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/u);if(!m)return null;const sec=(h,mi,s,ms)=>+h*3600+ +mi*60+ +s+ +ms/1000;return{start:sec(...m.slice(1,5)),end:sec(...m.slice(5,9)),text:lines.slice(2).join(' ').trim()}}).filter(Boolean)}
function wrapCaption(text){if(text.length<=43)return text;let p=text.lastIndexOf(' ',43);if(p<18)p=text.indexOf(' ',43);return p>0&&p<text.length-1?`${text.slice(0,p)}\n${text.slice(p+1)}`:text}
const captions=srtPaths.flatMap((file,i)=>parseSrt(file).map(c=>({start:voiceStarts[i]+c.start,end:voiceStarts[i]+c.end,text:wrapCaption(c.text)})));
for(let i=0;i<captions.length-1;i++)if(captions[i].end>captions[i+1].start)captions[i].end=captions[i+1].start;
const timeline={duration,starts:sceneStarts,captions};
fs.writeFileSync(srtOutput,`${captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`).join('\n\n')}\n`,'utf8');
const browserPath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if(!browserPath)throw new Error('Chrome or Edge was not found');
if(!fs.existsSync(silent)||fs.statSync(silent).mtimeMs<fs.statSync(html).mtimeMs){
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
await page.goto(pathToFileURL(html).href,{waitUntil:'load'});await page.evaluate(t=>window.setTimeline(t),timeline);
const encoder=spawn(ffmpeg,['-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-frames:v',String(frameCount),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','ignore','pipe']});
let encodeError='';encoder.stderr.on('data',c=>encodeError=(encodeError+c).slice(-8000));const encoderDone=once(encoder,'close');
for(let i=0;i<frameCount;i++){await page.evaluate(t=>window.renderAt(t),i/fps);const png=await page.locator('.frame').screenshot({type:'png'});if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');if(i%150===149)console.log(`Rendered ${i+1}/${frameCount}`)}
encoder.stdin.end();const[code]=await encoderDone;await browser.close();if(code!==0)throw new Error(encodeError||`silent encode failed (${code})`);
}else console.log('Reusing current silent video; scene HTML has not changed.');
const music=path.join(here,'assets','music-bed.wav');
const delay=voicePaths.map((_,i)=>`[${i+1}:a]adelay=${Math.round(voiceStarts[i]*1000)}|${Math.round(voiceStarts[i]*1000)},volume=1[v${i}]`);
const voiceMix=`${voicePaths.map((_,i)=>`[v${i}]`).join('')}amix=inputs=${voicePaths.length}:duration=longest:normalize=0,acompressor=threshold=0.12:ratio=1.5:attack=12:release=240[voice]`;
const musicIndex=voicePaths.length+1;
const filter=[...delay,voiceMix,`[voice]asplit=2[vo][ducksrc]`,`[${musicIndex}:a]apad,atrim=duration=${duration},volume=0.15,afade=t=in:st=0:d=1,afade=t=out:st=27:d=3[bed]`,`[bed][ducksrc]sidechaincompress=threshold=0.025:ratio=4:attack=100:release=550[duck]`,`[duck][vo]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.78:attack=15:release=200,loudnorm=I=-16:TP=-2.5:LRA=10[a]`].join(';');
const mux=spawn(ffmpeg,['-y','-i',silent,...voicePaths.flatMap(p=>['-i',p]),'-i',music,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-t',String(duration),'-r',String(fps),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{stdio:['ignore','ignore','pipe']});let muxError='';mux.stderr.on('data',c=>muxError=(muxError+c).slice(-9000));const[muxCode]=await once(mux,'close');if(muxCode!==0)throw new Error(muxError||`audio mux failed (${muxCode})`);
console.log(`Exported ${output}: ${duration}s, ${fps}fps, 1080x1920`);
