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
const html=path.join(here,'promo.html'),silent=path.join(here,'growth-story-silent.mp4');
const voice=path.join(here,'voiceover-elevenlabs.mp3'),alignment=path.join(here,'alignment.json');
const music=path.join(here,'music-bed-brighter.wav'),sfx=path.resolve(here,'../zhituha-30s/ui-sfx.wav');
const hasVoice=fs.existsSync(voice)&&fs.existsSync(alignment);
const final=hasVoice?path.join(here,'zhituha-growth-story.mp4'):path.join(here,'zhituha-growth-story-preview.mp4');
const profileText=hasVoice?JSON.parse(fs.readFileSync(alignment,'utf8')).text:'';

function stamp(seconds){const ms=Math.max(0,Math.round(seconds*1000)),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60,r=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(r).padStart(3,'0')}`}
function joinWords(words){let out='';for(const w of words){const t=String(w.text??'').trim();if(!t)continue;if(/^[,.;:!?…%)\]}»]/u.test(t))out+=t;else if(/^[—–-]$/u.test(t))out+=`${out&&!out.endsWith(' ')?' ':''}${t} `;else out+=`${out&&!out.endsWith(' ')?' ':''}${t}`}return out.trim()}
function wrapTwoLines(text){const words=text.split(/\s+/u),lines=[''];for(const word of words){let i=lines.length-1,candidate=lines[i]?`${lines[i]} ${word}`:word;if(candidate.length<=38||!lines[i])lines[i]=candidate;else if(lines.length===1)lines.push(word);else if((lines[1]+' '+word).length<=38)lines[1]+=' '+word;else throw new Error(`Subtitle line is too long: ${text}`)}return lines.join('\n')}
function makeTimeline(data){
  const words=(data.words||[]).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end));
  if(!words.length)throw new Error('The voice file has no aligned word timings.');
  const sentences=[];let current=[];
  for(const word of words){current.push(word);if(/[.!?…][»”’\])}]*$/u.test(String(word.text??''))){sentences.push(current);current=[]}}
  if(current.length)sentences.push(current);
  if(sentences.length<6)throw new Error(`Expected the complete promo narration; found ${sentences.length} sentence groups.`);
  const captions=[];let group=[];
  const flush=()=>{if(!group.length)return;const start=Math.min(...group.map(w=>w.start)),end=Math.max(...group.map(w=>w.end)),text=joinWords(group);captions.push({a:start,b:end,text:wrapTwoLines(text)});group=[]};
  for(const sentence of sentences){const candidate=[...group,...sentence];if(group.length&&joinWords(candidate).length>76)flush();group.push(...sentence);if(/[.!?…][»”’\])}]*$/u.test(String(sentence.at(-1)?.text??'')))flush()}
  flush();
  const endOf=n=>Math.max(...sentences.slice(0,n).flat().map(w=>w.end));
  const lastEnd=Math.max(...words.map(w=>w.end));
  const duration=lastEnd+1.7,b1=endOf(2)+.12,b2=endOf(3)+.12,b3=endOf(4)+.12,b4=endOf(5)+.12;
  return {duration,captions,scenes:[
    {id:'job',a:0,b:b1,pan:-12},{id:'business',a:b1-.12,b:b2,pan:11},{id:'market',a:b2-.12,b:b3,pan:-12},{id:'family',a:b3-.12,b:b4,pan:10},{id:'outro',a:b4-.12,b:duration,pan:0}
  ]};
}
async function run(args){const p=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',x=>err=(err+x).slice(-8000));const [code]=await once(p,'close');if(code!==0)throw new Error(err||`ffmpeg exited ${code}`)}

let timeline={duration:23.5,scenes:[{id:'job',a:0,b:7.1,pan:-12},{id:'business',a:7.1,b:11.3,pan:11},{id:'market',a:11.3,b:15.4,pan:-12},{id:'family',a:15.4,b:18.4,pan:10},{id:'outro',a:18.25,b:23.5,pan:0}],captions:[]};
let cues=[];
if(hasVoice){const data=JSON.parse(fs.readFileSync(alignment,'utf8'));timeline=makeTimeline(data);cues=timeline.captions;fs.writeFileSync(path.join(here,'zhituha-growth-story.srt'),cues.map((c,i)=>`${i+1}\n${stamp(c.a)} --> ${stamp(c.b)}\n${c.text}`).join('\n\n')+'\n','utf8');}
fs.writeFileSync(path.join(here,'timeline.json'),JSON.stringify(timeline,null,2)+'\n','utf8');

if(!fs.existsSync(silent)||fs.statSync(html).mtimeMs>fs.statSync(silent).mtimeMs||(hasVoice&&fs.statSync(alignment).mtimeMs>fs.statSync(silent).mtimeMs)){
  const duration=timeline.duration,fps=30,frames=Math.ceil(duration*fps),exe=fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({headless:true,executablePath:exe,args:['--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  await page.goto(pathToFileURL(html).href,{waitUntil:'load'});await page.addStyleTag({content:'*{transition:none!important;animation:none!important}'});await page.evaluate(value=>window.setTimeline(value),timeline);
  const proc=spawn(ffmpeg,['-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','ignore','pipe']});let error='';proc.stderr.on('data',x=>error=(error+x).slice(-8000));const done=once(proc,'close');
  for(let i=0;i<frames;i++){await page.evaluate(t=>window.renderAt(t),i/fps);const png=await page.locator('.frame').screenshot({type:'png'});if(!proc.stdin.write(png))await once(proc.stdin,'drain');if(i%150===149)console.log(`Rendered ${i+1}/${frames}`)}
  proc.stdin.end();const [code]=await done;await browser.close();if(code!==0)throw new Error(error||`video render exited ${code}`);
}

const duration=timeline.duration;
if(hasVoice){
  const filter='[1:a]atrim=duration='+duration+',volume=1.0,acompressor=threshold=0.12:ratio=2:attack=18:release=300,asplit=2[v][ducksrc];'+
    '[2:a]atrim=duration='+duration+',afade=t=in:st=0:d=0.6,afade=t=out:st='+(duration-1.1)+':d=1.1,acompressor=threshold=0.12:ratio=1.7:attack=80:release=420,volume=0.42[m];'+
    '[3:a]atrim=duration='+duration+',lowpass=f=5600,volume=0.13[s];[m][ducksrc]sidechaincompress=threshold=0.025:ratio=5:attack=100:release=650[duck];'+
    '[v][duck][s]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.82:attack=12:release=180,loudnorm=I=-16:TP=-2.5:LRA=11[a]';
  await run(['-y','-i',silent,'-i',voice,'-i',music,'-i',sfx,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-t',String(duration),'-r','30','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',final]);
}else{
  const filter='[1:a]atrim=duration='+duration+',afade=t=in:st=0:d=0.7,afade=t=out:st='+(duration-1.2)+':d=1.2,acompressor=threshold=0.12:ratio=1.7:attack=80:release=420,volume=0.42[m];[2:a]atrim=duration='+duration+',lowpass=f=5600,volume=0.13[s];[m][s]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.82:attack=12:release=180,loudnorm=I=-16:TP=-2.5:LRA=11[a]';
  await run(['-y','-i',silent,'-i',music,'-i',sfx,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-t',String(duration),'-r','30','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',final]);
}
console.log(`${hasVoice?'Final':'Visual preview'} exported: ${final} (${duration.toFixed(2)}s, 1080x1920, 30fps).${hasVoice?'':' Add voiceover-elevenlabs.mp3 and alignment.json, then rerun.'}`);
