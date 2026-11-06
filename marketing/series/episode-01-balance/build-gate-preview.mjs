import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const board = fs.readFileSync(path.join(here, 'scene-01-10-storyboard.svg'), 'utf8');
const defs = board.slice(board.indexOf('<defs>') + 6, board.indexOf('</defs>'));

const workers = [
  { id: 'workerA', coat: '#26394B', height: 178, x: 72, speed: 76, stride: 68, phase: 0.00 },
  { id: 'workerB', coat: '#70777B', height: 168, x: 393, speed: 82, stride: 70, phase: 0.21 },
  { id: 'workerC', coat: '#324C3D', height: 185, x: 715, speed: 73, stride: 66, phase: 0.43, bag: true },
];

function workerMarkup(w) {
  const s = w.height * 3 / 457;
  const floor = 1510 - ((w.id === 'workerB') ? 22 : 0);
  const y = floor - 489 * s;
  return `<g id="${w.id}" class="worker" data-height="${w.height}" data-start-x="${w.x}" data-speed="${w.speed}" data-stride="${w.stride}" data-phase="${w.phase}" data-scale="${s}" data-floor="${floor}" transform="translate(${w.x} ${y}) scale(${s})">
    <g id="${w.id}Body"><path d="M207 174 Q250 162 293 174 Q315 181 315 204 L321 326 Q322 352 300 355 L200 355 Q178 352 179 326 L185 204 Q185 181 207 174Z" fill="${w.coat}" stroke="#25292D" stroke-width="2.2" stroke-linejoin="round"/><path d="M218 188Q250 204 282 188" fill="none" stroke="#25292D" stroke-width="2"/>${w.bag ? '<path d="M202 193L293 313" fill="none" stroke="#25292D" stroke-width="9"/><rect x="280" y="292" width="46" height="57" rx="8" fill="#292D32" stroke="#25292D" stroke-width="3"/>' : ''}</g>
    <g id="${w.id}Legs"><path id="${w.id}LegL" d="M222 350L218 449" fill="none" stroke="#30343B" stroke-width="14" stroke-linecap="round"/><path id="${w.id}FootL" d="M218 449h31" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/><path id="${w.id}LegR" d="M278 350L282 449" fill="none" stroke="#30343B" stroke-width="14" stroke-linecap="round"/><path id="${w.id}FootR" d="M282 449h31" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g>
    <g id="${w.id}Arms"><path id="${w.id}ArmL" d="M190 192Q178 250 179 337" fill="none" stroke="${w.coat}" stroke-width="23" stroke-linecap="round"/><circle id="${w.id}HandL" cx="179" cy="341" r="10" fill="#E0D9CB" stroke="#25292D" stroke-width="2"/><path id="${w.id}ArmR" d="M310 192Q322 250 321 337" fill="none" stroke="${w.coat}" stroke-width="23" stroke-linecap="round"/><circle id="${w.id}HandR" cx="321" cy="341" r="10" fill="#E0D9CB" stroke="#25292D" stroke-width="2"/></g>
    <g id="${w.id}Head"><use href="#v4-head-neutral"/></g>
  </g>`;
}

const workerModels = workers.map(workerMarkup).join('\n');
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><title>Проходная — анимационный фрагмент</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#17151b;color:#f8f7f3;font:600 14px/1.3 system-ui,Segoe UI,sans-serif;display:flex;justify-content:center;min-height:100vh}.app{width:min(100vw,540px);display:flex;flex-direction:column;min-height:100vh;background:#211b27}.viewer{position:relative;flex:1;min-height:calc(100vh - 92px);display:flex;align-items:center;justify-content:center;background:#141319;overflow:hidden}.frame{height:min(calc(100vh - 96px), 960px);width:auto;max-width:100%;aspect-ratio:9/16;display:block;background:#252b35}.controls{position:sticky;bottom:0;padding:12px 14px 14px;background:#211b27;border-top:1px solid #4a4050;display:grid;grid-template-columns:auto auto 1fr auto;gap:10px;align-items:center;z-index:5}.controls button{border:1px solid #66536f;background:#30263a;color:#f8f7f3;border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer}.controls button.primary{background:#ff8b16;border-color:#ff8b16;color:#191519}.controls input{width:100%;accent-color:#ff8b16}.clock{min-width:78px;text-align:right;font-variant-numeric:tabular-nums;color:#d8cbdc}.hint{position:absolute;left:14px;top:12px;padding:7px 10px;border-radius:8px;background:#211b27cc;color:#dfd6e2;font-size:12px;pointer-events:none}
</style></head><body><main class="app"><section class="viewer"><div class="hint">SVG · Anton V4 · 15 секунд · 30 FPS</div>
<svg id="frame" class="frame" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" role="img" aria-label="Антон с тележкой у заводской проходной">
<defs>${defs}</defs>
<rect width="1080" height="1920" fill="#252B35"/>
<rect width="1080" height="840" fill="#39434C"/>
<circle cx="900" cy="210" r="72" fill="#D4A078" opacity=".72"/>
<path d="M0 590H1080V1190H0Z" fill="#46515A"/>
<path d="M0 675H1080" stroke="#778087" stroke-width="12"/>
<path d="M55 835V610H320V835M360 835V520H620V835M650 835V640H1010V835" fill="#58636B" stroke="#303840" stroke-width="18"/>
<g opacity=".76" fill="#E7D4B2"><rect x="112" y="666" width="34" height="50"/><rect x="205" y="666" width="34" height="50"/><rect x="420" y="600" width="34" height="48"/><rect x="518" y="600" width="34" height="48"/><rect x="730" y="700" width="36" height="44"/><rect x="850" y="700" width="36" height="44"/></g>
<path d="M0 1180H1080V1510H0Z" fill="#69747A"/>
<path d="M0 1510H1080V1920H0Z" fill="#A49C8B"/>
<path d="M0 1512H1080" stroke="#E2D2B3" stroke-width="10"/>
<!-- Gate door is 205 cm tall at the shared 3 px/cm scale. -->
<path d="M733 895H1037V1510H733Z" fill="#39434C" stroke="#303840" stroke-width="18"/>
<path d="M756 920V1484M830 920V1484M904 920V1484M978 920V1484" stroke="#A8B0B1" stroke-width="8"/>
<path d="M733 1000H1037M733 1115H1037M733 1230H1037M733 1345H1037M733 1460H1037" stroke="#515C65" stroke-width="8"/>
<rect x="702" y="865" width="366" height="30" rx="8" fill="#303840"/>
<!-- Cart -->
<g id="cart" visibility="hidden"><path d="M0 1295H230" stroke="#39434C" stroke-width="20" stroke-linecap="round"/><path d="M25 1295L48 1456H190L215 1295" fill="#58636B" stroke="#303840" stroke-width="12"/><path d="M190 1235H230" stroke="#303840" stroke-width="16" stroke-linecap="round"/><circle id="wheelA" cx="73" cy="1484" r="29" fill="#25292D" stroke="#11161A" stroke-width="8"/><circle id="wheelB" cx="178" cy="1484" r="29" fill="#25292D" stroke="#11161A" stroke-width="8"/><path d="M42 1328H198" stroke="#A8B0B1" stroke-width="7"/></g>
<!-- Table: 74 cm high. -->
<g id="table"><path d="M550 1298H925" stroke="#514A43" stroke-width="28" stroke-linecap="round"/><path d="M578 1310V1510M897 1310V1510" stroke="#514A43" stroke-width="27" stroke-linecap="round"/><path d="M565 1360H910" stroke="#71665B" stroke-width="12"/></g>
<!-- Three workers at the gate: same shape language, small differences in clothes and gait. -->
<g id="workersInitial">${workerModels}</g>
<!-- One passing worker and one worker approaching the coffee table. -->
${workerMarkup({id:'workerPass',coat:'#A39179',height:173,x:0,speed:0,stride:66,phase:0})}
${workerMarkup({id:'workerApproach',coat:'#393D43',height:181,x:0,speed:0,stride:70,phase:.31,bag:true})}
<!-- Anton V4; its head, hoodie and face shapes are reused directly from the approved storyboard SVG. -->
<g id="antonRoot" transform="translate(-180 958) scale(1.15)">
  <g id="antonLegs"><path id="antonLegL" d="M222 350L218 449" fill="none" stroke="#30343B" stroke-width="14" stroke-linecap="round"/><path id="antonFootL" d="M218 449h31" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/><path id="antonLegR" d="M278 350L282 449" fill="none" stroke="#30343B" stroke-width="14" stroke-linecap="round"/><path id="antonFootR" d="M282 449h31" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g>
  <use href="#v4-hoodie"/>
  <g id="antonArms"><path id="antonArmL" d="M190 192Q178 250 179 337" fill="none" stroke="#30343B" stroke-width="18" stroke-linecap="round"/><circle id="antonHandL" cx="179" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2.2"/><path id="antonArmR" d="M310 192Q322 250 321 337" fill="none" stroke="#30343B" stroke-width="18" stroke-linecap="round"/><circle id="antonHandR" cx="321" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2.2"/></g>
  <g id="antonHead"><use href="#v4-head-neutral"/></g>
</g>
<!-- Thermos rests on the cart, travels with Anton's hand, and lands upright on the table. -->
<g id="thermosOnCart" transform="translate(0 0) scale(.764)" visibility="hidden"><use href="#small-thermos"/></g>
<g id="thermosOnTable" transform="translate(0 0) scale(.764)" visibility="hidden"><use href="#small-thermos"/></g>
<g id="cups" transform="translate(720 1268) scale(.5)"><use href="#cup"/><use href="#cup" x="70"/><use href="#cup" x="140"/></g>
<g id="actionCaption" font-family="Arial,sans-serif" fill="#F8F7F3"><rect x="48" y="72" width="984" height="94" rx="24" fill="#25292D" opacity=".88"/><text id="captionText" x="82" y="132" font-size="34" font-weight="700">Рабочие идут на смену</text></g>
<g id="focusMark" opacity="0"><circle cx="0" cy="0" r="9" fill="#E8C27A"/></g>
</svg></section><div class="controls"><button id="play" class="primary" type="button">▶︎ Пуск</button><button id="restart" type="button">↺ Сначала</button><input id="seek" type="range" min="0" max="15" step="0.01" value="0" aria-label="Перемотка"><output id="clock" class="clock">00:00.00 / 00:15.00</output></div></main>
<script>
const D=15, fps=30, frame=document.getElementById('frame'), seek=document.getElementById('seek'), clock=document.getElementById('clock'), playBtn=document.getElementById('play');
const $=id=>document.getElementById(id), clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)), smooth=t=>{t=clamp(t);return t*t*(3-2*t)}, mix=(a,b,t)=>a+(b-a)*t, mod=(n,m)=>(n%m+m)%m;
const antonScale=1.15, antonY=958, floor=1510, naturalRootX=150;
const workerData=[
 {id:'workerA',start:72,speed:76,stride:68,offset:0,dir:1,visible:[0,8]},
 {id:'workerB',start:393,speed:82,stride:70,offset:.21,dir:1,visible:[0,8]},
 {id:'workerC',start:715,speed:73,stride:66,offset:.43,dir:1,visible:[0,8]},
 {id:'workerPass',start:90,speed:96,stride:66,offset:.15,dir:1,visible:[8.7,12.15],floor:1468},
 {id:'workerApproach',start:850,speed:112,stride:70,offset:.31,dir:-1,visible:[11.7,15],floor:1510}
];
function armPath(id, shoulder, elbow, hand){$(id).setAttribute('d',\`M\${shoulder[0]} \${shoulder[1]}Q\${elbow[0]} \${elbow[1]} \${hand[0]} \${hand[1]}\`)}
function setWalker(w,t){const g=$(w.id);if(t<w.visible[0]||t>w.visible[1]){g.setAttribute('visibility','hidden');return}g.setAttribute('visibility','visible');let d, speed=w.speed;
 if(w.id==='workerApproach'){const q=clamp((t-12)/3);d=400*(q-.5*q*q);speed=133*(1-q)}else{d=speed*(t-w.visible[0]);}
 const sign=w.dir, x=w.start+sign*d, scale=+(g.dataset.scale), y=(w.floor??+g.dataset.floor)-489*scale;
 g.setAttribute('transform',\`translate(\${x} \${y}) scale(\${scale})\`);
 const traveled=d/(w.stride*scale), phase=mod(traveled+w.offset,1), phaseR=mod(traveled+w.offset+.5,1);
 function foot(phase,hip){let dx,lift;if(phase<.62){dx=.31*w.stride-phase*w.stride;lift=0}else{const q=(phase-.62)/.38;dx=-.31*w.stride+.62*w.stride*smooth(q);lift=Math.sin(Math.PI*q)*17}return{x:hip+sign*dx,y:449-lift,lift}}
 const L=foot(phase,222),R=foot(phaseR,278);
 const leg=(prefix,hip,p)=>{const kneeX=mix(hip,p.x,.48),kneeY=397-p.lift*.46;$(prefix+'LegL');return \`M\${hip} 350Q\${kneeX} \${kneeY} \${p.x} \${p.y}\`};
 $(w.id+'LegL').setAttribute('d',leg('',222,L));$(w.id+'LegR').setAttribute('d',\`M278 350Q\${mix(278,R.x,.48)} \${397-R.lift*.46} \${R.x} \${R.y}\`);
 $(w.id+'FootL').setAttribute('d',\`M\${L.x} \${L.y}h\${sign*31}\`);$(w.id+'FootR').setAttribute('d',\`M\${R.x} \${R.y}h\${sign*31}\`);
 const gait=Math.sin((phase*2*Math.PI)), gaitR=Math.sin((phaseR*2*Math.PI));
 $(w.id+'Body').setAttribute('transform',\`translate(0 \${Math.abs(gait)*-2.3})\`);
 $(w.id+'Head').setAttribute('transform',\`translate(0 \${Math.abs(gait)*1.8}) rotate(\${gait*1.1} 250 105)\`);
 armPath(w.id+'ArmL',[190,192],[180+gaitR*15,252],[179+gaitR*26,337]);armPath(w.id+'ArmR',[310,192],[322-gaitR*15,252],[321-gaitR*26,337]);
 $(w.id+'HandL').setAttribute('cx',179+gaitR*26);$(w.id+'HandL').setAttribute('cy',337);$(w.id+'HandR').setAttribute('cx',321-gaitR*26);$(w.id+'HandR').setAttribute('cy',337);
}
function renderAt(t){t=clamp(+t,0,D);seek.value=t;clock.value=\`00:\${String(Math.floor(t)).padStart(2,'0')}.\${String(Math.floor((t%1)*100)).padStart(2,'0')} / 00:15.00\`;
 const approach=smooth((t-3)/3), rootX=t<3?-180:t<6?mix(-180,naturalRootX,approach):naturalRootX;
 const walkDistance=t<3?0:t<6?mix(0,330,approach):330;
 const moving=t>=3&&t<5.98;const antonWalkPhase=walkDistance/(82*antonScale);
 const antonYNow=antonY+(moving?Math.sin(antonWalkPhase*Math.PI*2)*-2.7:0);
 $('antonRoot').setAttribute('transform',\`translate(\${rootX} \${antonYNow}) scale(\${antonScale})\`);
 const antonLeg=(hip,phase)=>{let p;if(phase<.62)p={x:hip+.31*82-phase*82,y:449,lift:0};else{let q=(phase-.62)/.38;p={x:hip-.31*82+.62*82*smooth(q),y:449-Math.sin(Math.PI*q)*18,lift:0}}return \`M\${hip} 350Q\${mix(hip,p.x,.48)} 397 \${p.x} \${p.y}\`};
 const phaseL=mod(antonWalkPhase,1),phaseR=mod(antonWalkPhase+.5,1);
 $('antonLegL').setAttribute('d',antonLeg(222,phaseL));$('antonLegR').setAttribute('d',antonLeg(278,phaseR));
 const footX=(hip,p)=>p<.62?hip+.31*82-p*82:hip-.31*82+.62*82*smooth((p-.62)/.38);
 $('antonFootL').setAttribute('d',\`M\${footX(222,phaseL)} 449h31\`);$('antonFootR').setAttribute('d',\`M\${footX(278,phaseR)} 449h31\`);
 const cartX=rootX+160; $('cart').setAttribute('transform',\`translate(\${cartX} 0)\`);$('cart').setAttribute('visibility',t>=3?'visible':'hidden');
 const wheelAngle=(moving?walkDistance/29:330/29);$('wheelA').setAttribute('transform',\`rotate(\${wheelAngle} 73 1484)\`);$('wheelB').setAttribute('transform',\`rotate(\${wheelAngle} 178 1484)\`);
 let thermosX=rootX+248, thermosY=1170;
 if(t>=6&&t<8.45){const q=smooth((t-6.35)/1.78);thermosX=mix(naturalRootX+248,650,q);thermosY=1170-Math.sin(q*Math.PI)*32}
 if(t<3){$('thermosOnCart').setAttribute('visibility','hidden');$('thermosOnTable').setAttribute('visibility','hidden')}
 else if(t<8.45){$('thermosOnCart').removeAttribute('visibility');$('thermosOnTable').setAttribute('visibility','hidden');$('thermosOnCart').setAttribute('transform',\`translate(\${thermosX-22} \${thermosY}) scale(.764)\`)}else{$('thermosOnCart').setAttribute('visibility','hidden');$('thermosOnTable').removeAttribute('visibility');$('thermosOnTable').setAttribute('transform',\`translate(\${650-22} 1170) scale(.764)\`)}
 const toCart=clamp((t-3.05)/.5),release=clamp((t-6.0)/.35),toThermos=clamp((t-6.3)/.5),carry=clamp((t-6.75)/1.6),releaseThermos=clamp((t-8.25)/.3);
 let handR={x:321,y:337};
 if(t>=3&&t<6.15)handR={x:340,y:241};
 else if(t>=6.15&&t<8.55){const from={x:340,y:241}, target={x:(thermosX+24-rootX)/antonScale,y:(thermosY+45-antonY)/antonScale};const q=t<6.65?smooth((t-6.15)/.5):t<8.35?1:1-smooth((t-8.35)/.2);handR={x:mix(from.x,target.x,q),y:mix(from.y,target.y,q)}}
 const nod=smooth((t-9)/.35)*(1-smooth((t-11.6)/.4));const straighten=smooth((t-12)/.55);
 const bodyLean=(nod*.012);$('antonRoot').setAttribute('transform',\`translate(\${rootX} \${antonYNow}) scale(\${antonScale})\`);
 $('antonHead').setAttribute('transform',\`rotate(\${mix(0,-9,nod)+mix(0,5,straighten)} 250 105)\`);
 $('antonRoot').style.transformOrigin='0 0';
 const shoulderR=[310,192],elbowR=[mix(322,handR.x,.52)+4, mix(250,handR.y,.42)];armPath('antonArmR',shoulderR,elbowR,[handR.x,handR.y]);$('antonHandR').setAttribute('cx',handR.x);$('antonHandR').setAttribute('cy',handR.y);
 const droop=nod*(1-straighten);$('antonRoot').setAttribute('transform',\`translate(\${rootX} \${antonYNow+droop*3}) scale(\${antonScale})\`);
 armPath('antonArmL',[190,192],[178,250],[179,337]);
 for(const w of workerData)setWalker(w,t);
 $('workerApproachHead').setAttribute('transform',\`rotate(\${t>12.2?-5:0} 250 105)\`);
 const cap=t<3?'Рабочие идут к проходной':t<6?'Антон подъезжает с тележкой':t<9?'Антон ставит термос на стол':t<12?'Он провожает взглядом рабочего':'Рабочий замечает кофе и подходит';$('captionText').textContent=cap;
 // Reduce shoulder line slightly while Anton watches the passer, then restore it as a customer approaches.
 $('antonArmL').setAttribute('transform',\`translate(0 \${droop*4})\`);$('antonArmR').setAttribute('transform',\`translate(0 \${droop*4})\`);
}
let playing=false,raf=0,base=0,stamp=0;
function now(){return playing?Math.min(D,base+(performance.now()-stamp)/1000):base}
function tick(){const t=now();renderAt(t);if(t>=D){playing=false;playBtn.textContent='▶︎ Пуск';return}raf=requestAnimationFrame(tick)}
function play(){if(playing)return;if(base>=D)base=0;playing=true;stamp=performance.now();playBtn.textContent='Ⅱ Пауза';raf=requestAnimationFrame(tick)}
function pause(){if(!playing)return;base=now();playing=false;cancelAnimationFrame(raf);playBtn.textContent='▶︎ Пуск';renderAt(base)}
playBtn.onclick=()=>playing?pause():play();$('restart').onclick=()=>{pause();base=0;renderAt(0);play()};seek.oninput=()=>{pause();base=+seek.value;renderAt(base)};window.renderAt=renderAt;window.pausePreview=pause;window.playPreview=play;renderAt(0);
</script></body></html>`;

fs.writeFileSync(path.join(here, 'factory-gate-animation.html'), html, 'utf8');
console.log('Wrote factory-gate-animation.html');
