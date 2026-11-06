import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const req=createRequire(import.meta.url),{chromium}=req(path.join(process.env.TEMP,'zhituha-production-tools','node_modules','playwright'));
const ffmpeg=req(path.join(process.env.TEMP,'zhituha-production-tools','node_modules','ffmpeg-static'));
const duration=28.5,fps=30,frames=Math.round(duration*fps),html=path.join(here,'promo.html'),silent=path.join(here,'zhituha-promo-silent.mp4'),output=path.join(here,'zhituha-promo-30s.mp4');
const exe=fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:exe,args:['--allow-file-access-from-files']});const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});await page.goto(pathToFileURL(html).href,{waitUntil:'load'});await page.addStyleTag({content:'*{transition:none!important}'});
const p=spawn(ffmpeg,['-y','-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0','-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:['pipe','ignore','pipe']});let err='';p.stderr.on('data',x=>err=(err+x).slice(-5000));const done=once(p,'close');
for(let i=0;i<frames;i++){await page.evaluate(t=>window.renderAt(t),i/fps);const png=await page.locator('.frame').screenshot({type:'png'});if(!p.stdin.write(png))await once(p.stdin,'drain');if(i%150===149)console.log(`Frames ${i+1}/${frames}`)}p.stdin.end();const [code]=await done;await browser.close();if(code!==0)throw new Error(err);
// Match the game's own soft UI tap/reward oscillator tones and keep them below speech.
const sr=44100,N=Math.ceil(sr*duration),samples=new Float32Array(N);
function note(t,f,d,v){const start=Math.floor(t*sr),len=Math.floor(d*sr);for(let j=0;j<len&&start+j<N;j++){const x=j/sr;const env=Math.exp(-x*40)*Math.min(1,x/.012);samples[start+j]+=Math.sin(2*Math.PI*f*x)*v*env;}}
for(const t of [3.14,9.54,16.14])note(t,520,.045,.12);
for(const [f,dt] of [[660,0],[880,.075],[1175,.15]])note(26.25+dt,f,.18,.10);
const wav=Buffer.alloc(44+N*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(N*2,40);for(let i=0;i<N;i++)wav.writeInt16LE(Math.max(-32768,Math.min(32767,samples[i]*32767)),44+i*2);fs.writeFileSync(path.join(here,'ui-sfx.wav'),wav);
const voice=path.join(here,'voiceover.wav'),music=path.join(here,'music-bed.wav'),sfx=path.join(here,'ui-sfx.wav');
const args=['-y','-i',silent,'-i',voice,'-i',music,'-i',sfx,'-filter_complex',`[1:a]apad,atrim=duration=${duration},volume=1.1[v0];[v0]asplit=2[voice][ducksrc];[2:a]atrim=duration=${duration},volume=0.17[bed];[bed][ducksrc]sidechaincompress=threshold=0.025:ratio=5:attack=110:release=700[duck];[3:a]volume=0.52[fx];[voice][duck][fx]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]`,'-map','0:v:0','-map','[a]','-t',String(duration),'-r',String(fps),'-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',output];
const mux=spawn(ffmpeg,args,{stdio:['ignore','ignore','pipe']});let muxErr='';mux.stderr.on('data',x=>muxErr=(muxErr+x).slice(-7000));const [muxCode]=await once(mux,'close');if(muxCode!==0)throw new Error(muxErr);
console.log(`Exported ${output} (${duration}s, ${fps}fps, 1080x1920)`);
