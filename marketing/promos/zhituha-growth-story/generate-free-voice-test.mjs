import fs from 'node:fs';
const voiceId='JBFqnCBsd6RMkjVDRZzb';
const text='Есть игра, где ты сам выбираешь, кем стать. Начни с работы: бери заказы и копи на своё дело.';
let apiKey=process.env.ELEVENLABS_API_KEY||'';
if(!apiKey){process.stdout.write('Вставь API-ключ ElevenLabs (ввод скрыт): ');process.stdin.resume();if(process.stdin.isTTY)process.stdin.setRawMode(true);apiKey=await new Promise(resolve=>{let v='';process.stdin.on('data',c=>{for(const ch of c.toString()){if(ch==='\r'||ch==='\n'){if(process.stdin.isTTY)process.stdin.setRawMode(false);resolve(v.trim());return;}v+=ch;}});});}
const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.45,similarity_boost:0.78,style:0.18,use_speaker_boost:true}})});
if(!res.ok)throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0,1000)}`);
const file=new URL('./elevenlabs-free-voice-test.mp3',import.meta.url);fs.writeFileSync(file,Buffer.from(await res.arrayBuffer()));console.log(`Generated short ElevenLabs test: ${file.pathname}`);