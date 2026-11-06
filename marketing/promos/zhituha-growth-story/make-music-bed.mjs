import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const sampleRate=44100,duration=28,frames=sampleRate*duration;
const left=new Float32Array(frames),right=new Float32Array(frames);
const hz=midi=>440*Math.pow(2,(midi-69)/12);
function addTone(midi,start,dur,gain,{pan=0,attack=.06,release=.28,partials=[.72,.20,.06,.02],decay=0}={}){
  const begin=Math.max(0,Math.floor(start*sampleRate)),end=Math.min(frames,Math.floor((start+dur)*sampleRate));
  const f=hz(midi),pl=Math.sqrt((1-pan)*.5),pr=Math.sqrt((1+pan)*.5);
  for(let i=begin;i<end;i++){
    const t=i/sampleRate-start,remaining=start+dur-i/sampleRate;
    const a=Math.min(1,t/attack),r=Math.min(1,Math.max(0,remaining/release));
    const env=Math.max(0,a*r)*Math.exp(-decay*Math.max(0,t-attack));
    let sample=0;for(let h=1;h<=partials.length;h++)sample+=partials[h-1]*Math.sin(2*Math.PI*f*h*t);
    left[i]+=sample*gain*env*pl;right[i]+=sample*gain*env*pr;
  }
}

const bpm=92,beat=60/bpm,bar=beat*4;
const chords=[
  {notes:[55,59,62,66,69],bass:43}, // Gmaj9
  {notes:[50,54,57,59,64],bass:38}, // D6/9
  {notes:[48,52,55,59,62],bass:36}, // Cmaj9
  {notes:[50,54,57,62,66],bass:38}, // Dmaj7
];
for(let b=0;b<Math.ceil(duration/bar);b++){
  const t=b*bar,chord=chords[b%chords.length],length=Math.min(bar,duration-t);
  for(let n=0;n<chord.notes.length;n++)addTone(chord.notes[n],t,length,.025,{pan:(n-2)*.1,attack:.22,release:.32,partials:[.84,.12,.035,.01],decay:.025});
  addTone(chord.bass,t,length,.045,{attack:.08,release:.32,partials:[.92,.07,.01],decay:.03});
  const melody=[chord.notes[1]+12,chord.notes[2]+12,chord.notes[4]+12,chord.notes[2]+12];
  for(let beatIndex=0;beatIndex<4;beatIndex++){
    const noteStart=t+beatIndex*beat;
    const note=melody[(beatIndex+b)%melody.length];
    addTone(note,noteStart,Math.min(.56,duration-noteStart),.042,{pan:beatIndex%2?.12:-.12,attack:.04,release:.2,partials:[.9,.08,.015,.005],decay:2.2});
  }
}

const pcm=Buffer.alloc(44+frames*4);
pcm.write('RIFF',0);pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVE',8);pcm.write('fmt ',12);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(2,22);pcm.writeUInt32LE(sampleRate,24);pcm.writeUInt32LE(sampleRate*4,28);pcm.writeUInt16LE(4,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++){
  const fadeIn=Math.min(1,i/(sampleRate*.6)),fadeOut=Math.min(1,(frames-i)/(sampleRate*.9));
  const l=Math.tanh(left[i]*1.55)*fadeIn*fadeOut,r=Math.tanh(right[i]*1.55)*fadeIn*fadeOut;
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,l))*32767),44+i*4);
  pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,r))*32767),46+i*4);
}
const output=path.join(here,'music-bed-brighter.wav');fs.writeFileSync(output,pcm);console.log(`Wrote ${output} (${duration}s, ${bpm} BPM, warm major-key instrumental)`);
