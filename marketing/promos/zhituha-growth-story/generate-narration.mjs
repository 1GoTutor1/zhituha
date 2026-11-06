import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const reference=path.resolve(here,'../../series/episode-01-balance/audio/narrator-v3-master.wav');
const profilePath=path.join(here,'voice-profile.json');
const outputPath=path.join(here,'voiceover-elevenlabs.mp3');
const alignmentPath=path.join(here,'alignment.json');
const text='Есть игра, где ты сам выбираешь, кем стать. Начни с работы: бери заказы и копи на своё дело. Открой бизнес — следи за товарами, продажами и кассой. А когда приезжает торговец, зови семью на общее событие. Закроете цель — семье начислят пятнадцать очков. Житуха. Твоя история начинается с первого шага.';
let apiKey=process.env.ELEVENLABS_API_KEY||'';
if(!apiKey){
  process.stdout.write('Вставь API-ключ ElevenLabs (ввод скрыт): ');
  process.stdin.resume();
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  apiKey=await new Promise(resolve=>{
    let value='';
    process.stdin.on('data',chunk=>{
      for(const char of chunk.toString()){
        if(char==='\r'||char==='\n'){
          if(process.stdin.isTTY)process.stdin.setRawMode(false);
          resolve(value.trim());
          return;
        }
        value+=char;
      }
    });
  });
}
if(!apiKey)throw new Error('No API key was provided through stdin.');
if(!fs.existsSync(reference))throw new Error('Approved narrator V3 reference is missing.');

async function check(response,operation){
  if(response.ok)return response;
  const detail=(await response.text()).slice(0,1200);
  throw new Error(`${operation} failed (${response.status}): ${detail}`);
}

let profile=fs.existsSync(profilePath)?JSON.parse(fs.readFileSync(profilePath,'utf8')):null;
if(!profile?.voice_id){
  const form=new FormData();
  form.set('name','Житуха — рассказчик V3');
  form.set('description','Voice clone based on the previously approved Russian narrator reference for Zhituha promo narration.');
  form.append('files',new File([fs.readFileSync(reference)],path.basename(reference),{type:'audio/wav'}));
  const response=await fetch('https://api.elevenlabs.io/v1/voices/add',{method:'POST',headers:{'xi-api-key':apiKey},body:form});
  const created=await (await check(response,'ElevenLabs voice clone')).json();
  if(!created.voice_id)throw new Error('ElevenLabs did not return a voice ID.');
  if(created.requires_verification)throw new Error('ElevenLabs requires voice verification before this clone can be used.');
  profile={voice_id:created.voice_id,provider:'ElevenLabs Instant Voice Cloning',reference:'narrator-v3-master.wav',model_id:'eleven_multilingual_v2'};
  fs.writeFileSync(profilePath,JSON.stringify(profile,null,2)+'\n','utf8');
  console.log('Created a new promo narrator clone from approved narrator V3.');
}

const settings={stability:0.42,similarity_boost:0.78,style:0.18,use_speaker_boost:true};
const speech=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${profile.voice_id}?output_format=mp3_44100_128`,{
  method:'POST',
  headers:{'xi-api-key':apiKey,'Content-Type':'application/json','Accept':'audio/mpeg'},
  body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:settings})
});
const speechOk=await check(speech,'ElevenLabs speech generation');
fs.writeFileSync(outputPath,Buffer.from(await speechOk.arrayBuffer()));
profile.last_generation={model_id:'eleven_multilingual_v2',settings,characters:text.length,output:path.basename(outputPath),text};
fs.writeFileSync(profilePath,JSON.stringify(profile,null,2)+'\n','utf8');

const alignForm=new FormData();
alignForm.set('file',new File([fs.readFileSync(outputPath)],path.basename(outputPath),{type:'audio/mpeg'}));
alignForm.set('text',text);
const alignResponse=await fetch('https://api.elevenlabs.io/v1/forced-alignment',{method:'POST',headers:{'xi-api-key':apiKey},body:alignForm});
const aligned=await (await check(alignResponse,'ElevenLabs forced alignment')).json();
if(!Array.isArray(aligned.words)||!aligned.words.length)throw new Error('ElevenLabs returned no word-level timestamps.');
fs.writeFileSync(alignmentPath,JSON.stringify({provider:'ElevenLabs Forced Alignment',text,words:aligned.words,loss:aligned.loss??null},null,2)+'\n','utf8');
console.log(JSON.stringify({voice_id:profile.voice_id,model_id:'eleven_multilingual_v2',characters:text.length,word_timestamps:aligned.words.length,output:outputPath}));
