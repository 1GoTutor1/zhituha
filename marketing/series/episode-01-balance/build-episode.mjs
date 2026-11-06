import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { characterSvg, episodeWalker } from '../animation-library/character-rig.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const timeline = JSON.parse(fs.readFileSync(path.join(here, 'audio', 'episode-timeline.json'), 'utf8'));
const subtitleManifestPath = path.join(here, 'audio', 'aligned-subtitles.json');
const alignedSubtitleCues = process.env.EPISODE_PROOF_SILENT === '1' ? [] : fs.existsSync(subtitleManifestPath) ? JSON.parse(fs.readFileSync(subtitleManifestPath, 'utf8')).cues : [];
const proofAudioMuted = process.env.EPISODE_PROOF_SILENT === '1' ? ' muted' : '';
const walkerRuntime = fs.readFileSync(path.join(here, '..', 'animation-library', 'walker-runtime.js'), 'utf8');
const worldScale = Object.freeze({ antonHeightCm: 175, pixelsPerCm: 3, tableHeightCm: 74, seatHeightCm: 45, phoneCm: [15.5, 7.5], thermosHeightCm: 40, cupHeightCm: 10, cartHandleCm: 95, doorHeightCm: 205 });
const board = fs.readFileSync(path.join(here, 'scene-01-10-storyboard.svg'), 'utf8');
const defsStart = board.indexOf('<defs>') + '<defs>'.length;
const defsEnd = board.indexOf('</defs>');
const defs = board.slice(defsStart, defsEnd);
const frames = [...board.matchAll(/<svg x="\d+" y="\d+" width="360" height="640" viewBox="0 0 360 640">[\s\S]*?<\/svg>/g)].map(m => m[0]);
if (frames.length !== 12) throw new Error(`Expected 11 story frames + finance note, found ${frames.length}`);

const timing = Array.from({ length: 11 }, (_, i) => {
  const shot = timeline.shots[`shot${String(i + 1).padStart(2, '0')}`];
  return [shot.start, shot.end];
});
const setupAntonMarkup = `<g id="setupAnton" transform="translate(8 143) scale(.55)">
 <g id="setupLeftLeg"><path d="M222 350Q220 372 218 395L214 442" fill="none" stroke="#30343B" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M198 447h32" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g><g id="setupRightLeg"><path d="M278 350Q280 372 282 395L286 442" fill="none" stroke="#30343B" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="M270 447h32" fill="none" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g>
 <use href="#v4-hoodie"/><g id="setupHead"><use href="#v4-head-thinking"/></g>
 <path id="setupLeftArmUpperOutline" d="M190 192Q182 218 174 250" fill="none" stroke="#25292D" stroke-width="14" stroke-linecap="round"/><path id="setupLeftArmUpper" d="M190 192Q182 218 174 250" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><path id="setupLeftArmLowerOutline" d="M174 250Q177 292 179 337" fill="none" stroke="#25292D" stroke-width="14" stroke-linecap="round"/><path id="setupLeftArmLower" d="M174 250Q177 292 179 337" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><circle id="setupLeftHand" cx="179" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2"/>
 <path id="setupArmUpperOutline" d="M310 192Q326 218 326 250" fill="none" stroke="#25292D" stroke-width="14" stroke-linecap="round"/><path id="setupArmUpper" d="M310 192Q326 218 326 250" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><path id="setupArmLowerOutline" d="M326 250Q323 292 322 337" fill="none" stroke="#25292D" stroke-width="14" stroke-linecap="round"/><path id="setupArmLower" d="M326 250Q323 292 322 337" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><circle id="setupHand" cx="322" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2"/>
 </g>`;
const storyShots = frames.slice(0, 11).map((frame, i) => {
  let inner = frame
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<text\b[^>]*\by="(?:22|603|622)"[^>]*>[\s\S]*?<\/text>/g, '')
    .replace(/<rect width="360" height="640" rx="15"/, '<rect width="360" height="640"');
  if (i === 0) {
    inner = inner.replace('<g transform="translate(8 143) scale(.67)">', '<g id="homeAnton" transform="translate(8 143) scale(.67)">');
    inner = inner.replace('<g transform="rotate(-5 250 105)">', '<g id="homeHead" transform="rotate(-5 250 105)">');
    inner = inner.replace('<use href="#v4-head-neutral"/></g>', '<use href="#v4-head-neutral"/><ellipse id="homeBlinkL" cx="226" cy="106" rx="6" ry="0" fill="#F8F7F3" opacity="0"/><ellipse id="homeBlinkR" cx="274" cy="106" rx="6" ry="0" fill="#F8F7F3" opacity="0"/><path id="homeLidL" d="M221 106h10M269 106h10" stroke="#25292D" stroke-width="2" stroke-linecap="round" opacity="0"/></g>');
    inner = inner.replace('<ellipse cx="207" cy="145"', '<ellipse id="homeHand" cx="207" cy="145"');
  }
  if (i === 1) inner = inner.replace('<g transform="translate(-48 99) scale(.82)">', '<g id="phoneAnton" transform="translate(-48 99) scale(.82)">').replace('<g transform="rotate(-6 250 105)"><use href="#v4-head-neutral"/></g>', '<g id="phoneHead" transform="rotate(-6 250 105)"><use href="#v4-head-neutral"/><circle id="phoneEyeL" cx="226" cy="106" r="4.2" fill="#25292D"/><circle id="phoneEyeR" cx="274" cy="106" r="4.2" fill="#25292D"/></g>');
  if (i === 2) inner = inner.replace('<g transform="rotate(-8 181 340)">', '<g id="phoneBuzz" transform="rotate(-8 181 340)">');
  if (i === 3) {
    inner = inner.replace('<rect x="102" y="267" width="174" height="96"', '<g id="pickupPhone"><rect x="102" y="267" width="174" height="96"');
    inner = inner.replace('transform="rotate(-8 189 315)"/>', 'transform="rotate(-8 189 315)"/></g>');
    inner = inner.replace('<path d="M360 296 Q321 298 278 323"', '<path id="pickupArm" d="M360 296 Q321 298 278 323"');
    inner = inner.replace('<circle cx="274" cy="324"', '<circle id="pickupHand" cx="274" cy="324"');
  }
  if (i === 5) {
    inner = inner.replace('<g transform="translate(-57 197) scale(.7)">', '<g id="windowAnton" transform="translate(-57 197) scale(.7)">');
    inner = inner.replace('<g transform="rotate(4 250 105)">', '<g id="windowHead" transform="rotate(4 250 105)">');
  }
  if (i === 6) inner = inner.replace('<g stroke="#30343B" stroke-width="6"', '<g id="gateWorkers" stroke="#30343B" stroke-width="6"');
  if (i === 6) {
    const workersStart = inner.indexOf('<g id="gateWorkers"');
    let depth = 0, workersEnd = -1;
    if (workersStart >= 0) {
      const tags = /<\/?g\b[^>]*>/g;
      tags.lastIndex = workersStart;
      let tag;
      while ((tag = tags.exec(inner))) {
        if (tag[0].startsWith('</g')) depth -= 1;
        else if (!tag[0].endsWith('/>')) depth += 1;
        if (depth === 0) { workersEnd = tags.lastIndex; break; }
      }
    }
    if (workersStart >= 0 && workersEnd > workersStart) {
      inner = inner.slice(0, workersStart) + `<g id="storyGateWalkers">${episodeWalker('storyWorkerA', '#26394B', 60, 448, .42, 0, false, 290)}${episodeWalker('storyWorkerB', '#70777B', 180, 448, .42, .22, false, 245)}${episodeWalker('storyWorkerC', '#324C3D', 300, 448, .42, .44, false, 325)}</g>` + inner.slice(workersEnd);
    }
  }
  if (i === 7) {
    inner = inner.replace(
      /<g opacity="\.45" fill="#70797C">[\s\S]*?<\/g>/,
      `<g id="coffeeBackgroundWorkers">${episodeWalker('coffeeWorkerA', '#26394B', 57, 465, .34, .12, false, 35, 1)}${episodeWalker('coffeeWorkerB', '#70777B', 307, 465, .34, .38, false, 42, -1)}</g>`
    );
  }
  if (i === 8) inner = inner.replace('<g transform="rotate(-4 250 105)">', '<g id="ideaHead" transform="rotate(-4 250 105)">');
  if (i === 8) {
    inner = inner.replace('<g transform="translate(-57 197) scale(.7)">', '<g id="ideaAnton" transform="translate(-57 197) scale(.7)">');
    inner = inner.replace('<ellipse cx="250" cy="134" rx="5" ry="7" fill="#25292D"/>', '<ellipse cx="250" cy="134" rx="12" ry="10" fill="#F8F7F3"/><ellipse id="talkingMouth" cx="250" cy="134" rx="3" ry="2" fill="#25292D"/>');
    inner = inner.replace(/<rect x="18" y="475"[\s\S]*?<text x="33" y="504"[\s\S]*?<\/text>/, '');
  }
  if (i === 9) {
    inner = inner.replace('<path d="M350 322 Q306 307 257 328"', '<path id="decisionArm" d="M350 322 Q306 307 257 328"');
    inner = inner.replace('<circle cx="255" cy="329"', '<circle id="decisionHand" cx="255" cy="329"');
  }
  if (i === 0) inner = inner.replace(/<path d="M300 365[^>]*stroke="#F8F7F3"[^>]*\/>/, '<path d="M190 192 C202 236 213 305 212 365 C210 320 208 235 207 145" fill="none" stroke="#515861" stroke-width="12" stroke-linecap="round"/>');
  if (i === 1) inner = inner.replace(/<path d="M290 348[^>]*stroke="#F8F7F3"[^>]*\/>/, '<path d="M190 192 C204 234 222 292 228 348 C220 304 208 226 202 145" fill="none" stroke="#515861" stroke-width="12" stroke-linecap="round"/>');
  if (i === 10) {
    inner = inner.replace('<path d="M34 364l118-11" stroke="#30343B" stroke-width="2"/>', '');
    inner = inner.replace('<text x="238" y="271" fill="#30343B" font-family="Arial,sans-serif" font-size="18" font-weight="700">8 500 РІвЂљР…</text>', '<text x="238" y="145" fill="#30343B" font-family="Arial,sans-serif" font-size="18" font-weight="700">8 500 РІвЂљР…</text>');
    inner = inner.replace(/<path d="M266 207h22v14h-22z"[\s\S]*?<\/text>/, '');
    inner = inner.replace('<g transform="translate(25 278) scale(.9)">', '<g id="purchaseThermos" transform="translate(25 278) scale(.9)">');
    inner = inner.replace('<g transform="translate(101 280)">', '<g id="purchaseCart" transform="translate(101 280)">');
    inner = inner.replace('<g transform="translate(204 345) scale(.72)">', '<g id="purchaseCup1" transform="translate(204 345) scale(.72)">');
    inner = inner.replace('<g transform="translate(250 345) scale(.72)">', '<g id="purchaseCup2" transform="translate(250 345) scale(.72)">');
    inner = inner.replace('<g transform="translate(296 345) scale(.72)">', '<g id="purchaseCup3" transform="translate(296 345) scale(.72)">');
    inner = inner.replace('<g id="purchaseThermos"', `${setupAntonMarkup}<g id="purchaseThermos"`);
    inner = inner.replace('id="purchaseThermos" transform="translate(25 278) scale(.9)"', 'id="purchaseThermos" transform="translate(190 285) scale(.9)"');
    inner = inner.replace('id="purchaseCart" transform="translate(101 280)"', 'id="purchaseCart" transform="translate(230 315)"');
    inner = inner.replace('id="purchaseCup1" transform="translate(204 345) scale(.72)"', 'id="purchaseCup1" transform="translate(260 380) scale(.62)"');
    inner = inner.replace('id="purchaseCup2" transform="translate(250 345) scale(.72)"', 'id="purchaseCup2" transform="translate(287 380) scale(.62)"');
    inner = inner.replace('id="purchaseCup3" transform="translate(296 345) scale(.72)"', 'id="purchaseCup3" transform="translate(314 380) scale(.62)"');
  }
  return `<g id="shot${String(i + 1).padStart(2, '0')}" class="shot board-shot" data-start="${timing[i][0]}" data-end="${timing[i][1]}"><g transform="scale(3)">${inner}</g></g>`;
}).join('\n');

const workerSpecs = [
  { key: 'A', coat: '#26394B', height: 178, depth: 1.00, speed: 530, delay: 0.00, lane: 0, cycle: 0.92, broad: 0 },
  { key: 'B', coat: '#70777B', height: 168, depth: 0.82, speed: 475, delay: 0.82, lane: -26, cycle: 1.04, broad: 18 },
  { key: 'C', coat: '#324C3D', height: 185, depth: 1.04, speed: 590, delay: 2.08, lane: 22, cycle: 0.86, broad: -8 },
  { key: 'D', coat: '#A39179', height: 173, depth: 0.76, speed: 500, delay: 3.42, lane: -12, cycle: 0.80, broad: -14 },
  { key: 'E', coat: '#393D43', height: 181, depth: 0.93, speed: 550, delay: 4.68, lane: 16, cycle: 0.98, broad: 0, bag: true },
];
const crowdMarkup = (prefix, scene, leftToRight = true) => workerSpecs.map((w, i) => {
  const id = `${prefix}${w.key}`;
  const depthScale = w.depth * w.height / worldScale.antonHeightCm;
  const floor = 1415 + w.lane;
  const y = floor - 470 * depthScale;
  return `<g id="${id}-root" class="walker" data-scene="${scene}" data-delay="${w.delay}" data-speed="${w.speed}" data-cycle="${w.cycle}" data-scale="${depthScale}" data-dir="${leftToRight ? 1 : -1}" transform="translate(-500 ${y}) scale(${depthScale})">${characterSvg(id, w.coat, w.broad, w.bag)}</g>`;
}).join('');
const gateCrowd = crowdMarkup('gateWalker', 'gate');
const waitCrowd = crowdMarkup('waitWalker', 'wait', false);

const extraShots = `
  <g id="shot12" class="shot" data-start="${timeline.shots.shot12.start}" data-end="${timeline.shots.shot12.end}">
    <rect width="1080" height="1920" fill="#252B35"/>
    <path d="M0 0h1080v760H0z" fill="#39434C"/><circle cx="880" cy="230" r="78" fill="#C78F60" opacity=".8"/>
    <path d="M0 748h1080v460H0z" fill="#69747A"/><path d="M50 760V475h300v285M425 760V365h260v395M760 760V510h270v250" fill="#58636B" stroke="#303840" stroke-width="20"/>
    <path d="M0 1208h1080v712H0z" fill="#A49C8B"/><path d="M0 1360h1080" stroke="#E2D2B3" stroke-width="12"/>
    <path d="M62 988h956v310H62z" fill="#39434C" stroke="#26303A" stroke-width="16"/>
    <path d="M88 1020v264M214 1020v264M340 1020v264M466 1020v264M592 1020v264M718 1020v264M844 1020v264M970 1020v264" stroke="#A8B0B1" stroke-width="8"/>
    ${episodeWalker('passer12a', '#26394B', 170, 1510, 1.15, 0, false, 550, 1)}
    ${episodeWalker('passer12b', '#70777B', 760, 1510, 1.08, .28, false, 580, -1)}
    <g id="arrivalCart" transform="translate(50 0)"><path d="M700 1185h205l45 214H742z" fill="#30343B" stroke="#25292D" stroke-width="12"/><path d="M704 1184l-12-34h152" fill="none" stroke="#25292D" stroke-width="16" stroke-linecap="round"/><path d="M760 1291h90" fill="none" stroke="#25292D" stroke-width="17" stroke-linecap="round"/><path d="M740 1390h205" stroke="#59636A" stroke-width="14"/><circle id="arrivalWheelA" cx="765" cy="1427" r="29" fill="#25292D"/><circle id="arrivalWheelB" cx="918" cy="1427" r="29" fill="#25292D"/><path d="M770 1175h102v-84h-102z" fill="#59636A" stroke="#25292D" stroke-width="9"/><path d="M790 1091v-20h62v20" fill="none" stroke="#25292D" stroke-width="8"/></g>
    <g id="anton12" transform="translate(396 650) scale(1.88)">
      <g id="arrivalLeftLeg"><path d="M222 350L214 442" fill="none" stroke="#25292D" stroke-width="19" stroke-linecap="round"/><path id="arrivalLeftShoe" d="M198 447h32" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g><g id="arrivalRightLeg"><path d="M278 350L286 442" fill="none" stroke="#25292D" stroke-width="19" stroke-linecap="round"/><path id="arrivalRightShoe" d="M270 447h32" stroke="#25292D" stroke-width="18" stroke-linecap="round"/></g><use href="#v4-hoodie"/><g id="anton12Head"><use href="#v4-head-neutral"/></g>
      <path id="arrivalArmLeft" d="M190 192 Q205 225 263 270" fill="none" stroke="#30343B" stroke-width="13" stroke-linecap="round"/><path id="arrivalArmRight" d="M310 192 Q300 226 249 270" fill="none" stroke="#30343B" stroke-width="13" stroke-linecap="round"/><circle id="arrivalHandLeft" cx="263" cy="270" r="10" fill="#F8F7F3"/><circle id="arrivalHandRight" cx="249" cy="270" r="10" fill="#F8F7F3"/>
    </g>
    <text x="70" y="190" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="42" font-weight="700">05:30</text>
    <text x="72" y="252" fill="#D7D3CC" font-family="Arial,sans-serif" font-size="27">Р СџР ВµРЎР‚Р Р†Р В°РЎРЏ РЎРѓР СР ВµР Р…Р В°. Р СњР С‘Р С”РЎвЂљР С• Р Р…Р Вµ Р С•РЎРѓРЎвЂљР В°Р Р…Р В°Р Р†Р В»Р С‘Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ.</text>
  </g>

  <g id="shot13" class="shot" data-start="${timeline.shots.shot13.start}" data-end="${timeline.shots.shot13.end}">
    <rect width="1080" height="1920" fill="#252B35"/><path d="M0 0h1080v760H0z" fill="#39434C"/><path d="M0 748h1080v460H0z" fill="#69747A"/>
    <path d="M50 760V475h300v285M425 760V365h260v395M760 760V510h270v250" fill="#58636B" stroke="#303840" stroke-width="20"/>
    <path d="M0 1208h1080v712H0z" fill="#A49C8B"/><path d="M0 1360h1080" stroke="#E2D2B3" stroke-width="12"/>
    <path d="M62 988h956v310H62z" fill="#39434C" stroke="#26303A" stroke-width="16"/><path d="M88 1020v264M214 1020v264M340 1020v264M466 1020v264M592 1020v264M718 1020v264M844 1020v264M970 1020v264" stroke="#A8B0B1" stroke-width="8"/>
    ${episodeWalker('passer13a', '#A39179', 1050, 1510, 1.08, .11, false, 720, -1)}
    ${episodeWalker('passer13b', '#324C3D', 740, 1510, 1.02, .43, true, 520, -1)}
    <g id="anton13" transform="translate(192 650) scale(1.88)"><path d="M222 350L214 442M278 350L286 442" fill="none" stroke="#30343B" stroke-width="15" stroke-linecap="round"/><path d="M198 447h32M270 447h32" stroke="#25292D" stroke-width="18" stroke-linecap="round"/><use href="#v4-hoodie"/><g id="anton13Head"><use href="#v4-head-neutral"/></g><path id="anton13LeftArm" d="M190 192 Q175 250 181 337" fill="none" stroke="#30343B" stroke-width="11" stroke-linecap="round"/><path id="anton13RightArm" d="M310 192 Q327 249 321 337" fill="none" stroke="#30343B" stroke-width="11" stroke-linecap="round"/><circle id="anton13LeftHand" cx="181" cy="341" r="10" fill="#F8F7F3"/><circle id="anton13RightHand" cx="321" cy="341" r="10" fill="#F8F7F3"/></g>
    <g id="setupTable"><path d="M606 1326h410v42H606z" fill="#514A43"/><path d="M626 1368v195m370-195v195" stroke="#514A43" stroke-width="26"/></g>
    <g id="setupThermos13" transform="translate(651 1187) scale(1.08)"><use href="#small-thermos"/></g><g id="setupCup1" transform="translate(810 1304) scale(1.03)"><use href="#cup"/></g><g id="setupCup2" transform="translate(874 1304) scale(1.03)"><use href="#cup"/></g><g id="setupCup3" transform="translate(938 1304) scale(1.03)"><use href="#cup"/></g>
    <circle cx="865" cy="280" r="115" fill="#E8E3DA" stroke="#30343B" stroke-width="15"/><path id="clockHand" d="M865 280V196M865 280l60 33" stroke="#30343B" stroke-width="14" stroke-linecap="round"/><path d="M840 280h25" stroke="#D58C47" stroke-width="14"/>
    <text x="72" y="190" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="42" font-weight="700">Р СџР С•Р С”Р В° Р В±Р ВµР В· Р С—РЎР‚Р С•Р Т‘Р В°Р В¶</text>
    <text x="72" y="252" fill="#D7D3CC" font-family="Arial,sans-serif" font-size="27">Р СџРЎР‚Р С•РЎвЂ¦Р С•Р Т‘Р С‘РЎвЂљ Р Р†РЎР‚Р ВµР СРЎРЏ. Р С’Р Р…РЎвЂљР С•Р Р… Р В¶Р Т‘РЎвЂРЎвЂљ.</text>
    <text x="72" y="1810" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="32" font-weight="700">Р СџРЎР‚Р С•Р Т‘Р В°Р В¶: 0</text>
  </g>

  <g id="shot14" class="shot" data-start="${timeline.shots.shot14.start}" data-end="${timeline.shots.shot14.end}">
    <rect width="1080" height="1920" fill="#252B35"/><path d="M0 0h1080v760H0z" fill="#39434C"/><path d="M0 748h1080v460H0z" fill="#69747A"/>
    <path d="M50 760V475h300v285M425 760V365h260v395M760 760V510h270v250" fill="#58636B" stroke="#303840" stroke-width="20"/><path d="M0 1208h1080v712H0z" fill="#A49C8B"/><path d="M0 1360h1080" stroke="#E2D2B3" stroke-width="12"/>
    <path d="M62 988h956v310H62z" fill="#39434C" stroke="#26303A" stroke-width="16"/><path d="M88 1020v264M214 1020v264M340 1020v264M466 1020v264M592 1020v264M718 1020v264M844 1020v264M970 1020v264" stroke="#A8B0B1" stroke-width="8"/>
    <g id="anton14" transform="translate(128 650) scale(1.88)"><path d="M222 350L214 442M278 350L286 442" fill="none" stroke="#30343B" stroke-width="15" stroke-linecap="round"/><path d="M198 447h32M270 447h32" stroke="#25292D" stroke-width="18" stroke-linecap="round"/><use href="#v4-hoodie"/><g id="anton14Head"><use href="#v4-head-neutral"/><ellipse id="anton14Mouth" cx="250" cy="134" rx="2" ry="1.5" fill="#25292D"/></g><path id="anton14Arm" d="M310 192 Q327 249 321 337" fill="none" stroke="#30343B" stroke-width="12" stroke-linecap="round"/><circle id="anton14Hand" cx="321" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2"/><path id="anton14PaymentArm" d="M190 192Q178 250 181 337" fill="none" stroke="#30343B" stroke-width="12" stroke-linecap="round"/><circle id="anton14PaymentHand" cx="181" cy="341" r="10" fill="#F8F7F3" stroke="#25292D" stroke-width="2"/></g>
    ${episodeWalker('customer14', '#55636B', 1140, 1510, 1.25, .31, false, 240, -1)}
    <path d="M606 1326h410v42H606z" fill="#514A43"/><path d="M626 1368v195m370-195v195" stroke="#514A43" stroke-width="26"/><g transform="translate(651 1187) scale(1.08)"><use href="#small-thermos"/></g>
    <path id="coffeeStream" d="M710 1275Q760 1278 836 1306" fill="none" stroke="#8C6047" stroke-width="7" stroke-linecap="round" opacity="0"/><g id="saleCup" transform="translate(819 1305) scale(1.05)"><use href="#cup"/><path id="cupFill" d="M6 50H32L29 53Q18 56 8 53Z" fill="#8C6047" opacity="0"/></g><circle id="buyerCupGrip" cx="864" cy="1305" r="10" fill="#E0D9CB" stroke="#25292D" stroke-width="3" opacity="0"/><g transform="translate(894 1305) scale(1.05)"><use href="#cup"/></g><g id="paymentCash" opacity="0"><circle cx="0" cy="0" r="28" fill="#E9B84E" stroke="#6F5119" stroke-width="5"/><text x="0" y="13" text-anchor="middle" fill="#33260C" font-family="Arial,sans-serif" font-size="32" font-weight="700">РІвЂљР…</text></g>
    <text x="72" y="190" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="40" font-weight="700">Р СџР ВµРЎР‚Р Р†РЎвЂ№Р в„– Р С—Р С•Р С”РЎС“Р С—Р В°РЎвЂљР ВµР В»РЎРЉ</text>
    <g id="saleToast" opacity="0"><rect x="740" y="1465" width="275" height="112" rx="24" fill="#1D2923"/><text x="878" y="1538" text-anchor="middle" fill="#8FE0A7" font-family="Arial,sans-serif" font-size="39" font-weight="700">+100 РІвЂљР…</text></g>
    <g id="speechBubble"><rect x="74" y="1610" width="932" height="132" rx="26" fill="#161B23" opacity=".93"/><text id="speechText" x="540" y="1694" text-anchor="middle" fill="#FFFFFF" font-family="Arial,sans-serif" font-size="44" font-weight="700">Р вЂњР С•РЎР‚РЎРЏРЎвЂЎР С‘Р в„–?</text></g>
  </g>

  <g id="shot15" class="shot" data-start="${timeline.shots.shot15.start}" data-end="${timeline.shots.shot15.end}">
    <rect width="1080" height="1920" fill="#272A30"/><path d="M0 0h1080v610H0z" fill="#56616A"/><circle cx="860" cy="230" r="110" fill="#D49B65" opacity=".65"/>
    <path d="M0 610h1080v675H0z" fill="#707A7D"/><path d="M0 1285h1080v635H0z" fill="#948779"/><path d="M0 1285h1080" stroke="#D0C1AA" stroke-width="13"/>
    <g id="anton15" transform="translate(65 650) scale(1.52)"><use href="#v4-seated-legs"/><use href="#v4-hoodie"/><g id="anton15Head"><use href="#v4-head-thinking"/></g><path id="anton15LeftArm" d="M190 192 Q175 250 181 337" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><path id="anton15RightArm" d="M310 192 Q327 249 321 337" fill="none" stroke="#30343B" stroke-width="9" stroke-linecap="round"/><circle id="anton15LeftHand" cx="181" cy="341" r="10" fill="#F8F7F3"/><circle id="anton15RightHand" cx="321" cy="341" r="10" fill="#F8F7F3"/></g>
    <path d="M246 1225h170v60H246z" fill="#514A43"/><path d="M266 1285v130m130-130v130" stroke="#514A43" stroke-width="24"/><g transform="translate(274 1012) scale(1.18)"><use href="#small-thermos"/></g>
    <g id="dailySummary"><rect x="470" y="520" width="545" height="780" rx="32" fill="#F8F7F3" stroke="#D6D0C6" stroke-width="5"/>
      <text x="520" y="600" fill="#30343B" font-family="Arial,sans-serif" font-size="39" font-weight="700">Р РЋР Р†Р С•Р Т‘Р С”Р В° Р С—Р ВµРЎР‚Р Р†Р С•Р в„– Р С—РЎР‚Р С•Р Т‘Р В°Р В¶Р С‘</text>
      <path d="M520 644h440" stroke="#C8C2B9" stroke-width="4"/>
      <text x="520" y="725" fill="#59636A" font-family="Arial,sans-serif" font-size="31">Р СџРЎР‚Р С•Р Т‘Р В°Р В¶Р В° РЎРѓРЎвЂљР В°Р С”Р В°Р Р…Р В°</text><text x="950" y="725" text-anchor="end" fill="#30343B" font-family="Arial,sans-serif" font-size="34" font-weight="700">+100 РІвЂљР…</text>
      <text x="520" y="815" fill="#59636A" font-family="Arial,sans-serif" font-size="31">Р РЋР ВµР В±Р ВµРЎРѓРЎвЂљР С•Р С‘Р СР С•РЎРѓРЎвЂљРЎРЉ РІвЂ°в‚¬</text><text x="950" y="815" text-anchor="end" fill="#30343B" font-family="Arial,sans-serif" font-size="34" font-weight="700">30 РІвЂљР…</text>
      <path d="M520 858h440" stroke="#C8C2B9" stroke-width="4"/>
      <text x="520" y="934" fill="#30343B" font-family="Arial,sans-serif" font-size="31" font-weight="700">Р вЂќР С• Р С—РЎР‚Р С•РЎвЂЎР С‘РЎвЂ¦ РЎР‚Р В°РЎРѓРЎвЂ¦Р С•Р Т‘Р С•Р Р†</text><text x="950" y="995" text-anchor="end" fill="#308354" font-family="Arial,sans-serif" font-size="49" font-weight="700">РІвЂ°в‚¬70 РІвЂљР…</text>
      <text x="520" y="1085" fill="#73777A" font-family="Arial,sans-serif" font-size="25">Р В­РЎвЂљР С• РЎР‚Р В°Р В·Р Р…Р С‘РЎвЂ Р В°, Р Р…Р Вµ РЎвЂЎР С‘РЎРѓРЎвЂљР В°РЎРЏ Р С—РЎР‚Р С‘Р В±РЎвЂ№Р В»РЎРЉ.</text>
    </g>
    <text x="540" y="1515" text-anchor="middle" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="38" font-weight="700">Р СџР ВµРЎР‚Р Р†РЎвЂ№Р в„– РЎРѓРЎвЂљР В°Р С”Р В°Р Р… Р С•Р Р… Р С—РЎР‚Р С•Р Т‘Р В°Р В».</text>
    <text x="540" y="1570" text-anchor="middle" fill="#F8F7F3" font-family="Arial,sans-serif" font-size="34">Р СњР С• РЎвЂЎРЎвЂљР С• Р Т‘Р ВµР В»Р В°РЎвЂљРЎРЉ РЎРѓ Р С•РЎРѓРЎвЂљР В°Р В»РЎРЉР Р…РЎвЂ№Р С Р С”Р С•РЎвЂћР Вµ?</text>
  </g>

  <g id="purchaseReceipt" visibility="hidden">
    <rect x="100" y="200" width="880" height="1440" rx="22" fill="#F8F7F3" stroke="#25292D" stroke-width="5"/>
    <text x="160" y="285" fill="#30343B" font-family="Arial,sans-serif" font-size="43" font-weight="700">Р В§Р вЂўР С™ Р’В· Р СџР вЂўР В Р вЂ™Р В«Р в„ў Р СњР С’Р вЂР С›Р В </text><text x="160" y="340" fill="#73777A" font-family="Arial,sans-serif" font-size="28">Р РЋРЎвЂљР В°РЎР‚РЎвЂљ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•Р Т‘Р В°Р В¶Р С‘ Р С”Р С•РЎвЂћР Вµ</text><path d="M160 390h760" stroke="#B9B6AF" stroke-width="4"/>
    <g fill="#30343B" font-family="Arial,sans-serif" font-size="31"><text x="160" y="470">Р СћР ВµРЎР‚Р СР С•РЎРѓ</text><text x="920" y="470" text-anchor="end">2 200 РІвЂљР…</text><text x="160" y="555">Р РЋРЎвЂљР С•Р В»</text><text x="920" y="555" text-anchor="end">1 400 РІвЂљР…</text><text x="160" y="640">Р СћР ВµР В»Р ВµР В¶Р С”Р В°</text><text x="920" y="640" text-anchor="end">900 РІвЂљР…</text><text x="160" y="725">Р РЋРЎвЂљР В°Р С”Р В°Р Р…РЎвЂ№ Р С‘ Р С”РЎР‚РЎвЂ№РЎв‚¬Р С”Р С‘</text><text x="920" y="725" text-anchor="end">1 500 РІвЂљР…</text><text x="160" y="810">Р С™Р С•РЎвЂћР ВµР в„–Р Р…Р С•Р Вµ Р В·Р ВµРЎР‚Р Р…Р С•</text><text x="920" y="810" text-anchor="end">1 600 РІвЂљР…</text><text x="160" y="895">Р РЋР В°РЎвЂ¦Р В°РЎР‚, Р С”Р В°Р С”Р В°Р С•, Р СР ВµРЎв‚¬Р В°Р В»Р С”Р С‘</text><text x="920" y="895" text-anchor="end">500 РІвЂљР…</text><text x="160" y="980">Р В Р В°Р В·Р СР ВµР Р… Р Р…Р В°Р В»Р С‘РЎвЂЎР Р…РЎвЂ№РЎвЂ¦ Р’В· Р Р† Р С”Р В°РЎРѓРЎРѓРЎС“</text><text x="920" y="980" text-anchor="end">400 РІвЂљР…</text></g>
    <path d="M160 1040h760" stroke="#30343B" stroke-width="4"/><text x="160" y="1120" fill="#59636A" font-family="Arial,sans-serif" font-size="27">Р СџР С•Р С”РЎС“Р С—Р С”Р С‘</text><text x="920" y="1120" text-anchor="end" fill="#30343B" font-family="Arial,sans-serif" font-size="30" font-weight="700">8 100 РІвЂљР…</text><text x="160" y="1190" fill="#59636A" font-family="Arial,sans-serif" font-size="27">Р В Р В°Р В·Р СР ВµР Р… Р С•РЎРѓРЎвЂљР В°РЎвЂРЎвЂљРЎРѓРЎРЏ Р Р† Р С”Р В°РЎРѓРЎРѓР Вµ</text><text x="920" y="1190" text-anchor="end" fill="#30343B" font-family="Arial,sans-serif" font-size="30" font-weight="700">400 РІвЂљР…</text>
    <path d="M160 1240h760" stroke="#30343B" stroke-width="4"/><text x="160" y="1340" fill="#30343B" font-family="Arial,sans-serif" font-size="37" font-weight="700">Р вЂ™РЎвЂ№Р Т‘Р ВµР В»Р ВµР Р…Р С• Р Р…Р В° РЎРѓРЎвЂљР В°РЎР‚РЎвЂљ</text><text x="920" y="1340" text-anchor="end" fill="#30343B" font-family="Arial,sans-serif" font-size="42" font-weight="700">8 500 РІвЂљР…</text><text x="160" y="1410" fill="#73777A" font-family="Arial,sans-serif" font-size="25">Р В Р В°Р В·Р СР ВµР Р… РІР‚вЂќ Р С•Р В±Р С•РЎР‚Р С•РЎвЂљР Р…РЎвЂ№Р Вµ Р Т‘Р ВµР Р…РЎРЉР С–Р С‘, Р Р…Р Вµ РЎР‚Р В°РЎРѓРЎвЂ¦Р С•Р Т‘.</text>
  </g>
`;

const saleWrappedShots = extraShots.replace(/(<g id="shot14"[^>]*>)([\s\S]*?)(<\/g>\s*<g id="shot15")/, '$1<g id="saleCameraWorld">$2</g></g><g id="shot15"').replace(/(<g id="saleCameraWorld">[\s\S]*?)<text x="72" y="190"/, '$1<text id="saleTitle" x="72" y="190"');
const productionShots = saleWrappedShots.replace(/<text x="540" y="1515"[\s\S]*?<\/text>\s*<text x="540" y="1570"[\s\S]*?<\/text>/, '').replace(/<g id="speechBubble">[\s\S]*?<\/g>/, '');
const document = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Р вЂ“Р С‘РЎвЂљРЎС“РЎвЂ¦Р В° РІР‚вЂќ Р С—Р С‘Р В»Р С•РЎвЂљ, РЎРѓР ВµРЎР‚Р С‘РЎРЏ 1</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#13151a;color:#f7f5f0;font-family:Arial,sans-serif}.player{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}.frame{position:relative;width:min(100vw,calc((100vh - 74px)*.5625));height:min(calc(100vw*1.7777778),calc(100vh - 74px));aspect-ratio:9/16;background:#20242d;overflow:hidden;box-shadow:0 12px 45px #0008}.film{width:100%;height:100%;display:block}.shot{position:absolute;inset:0;width:100%;height:100%;visibility:hidden;opacity:0;transform-origin:center;overflow:hidden}.subtitle{position:absolute;left:6%;right:6%;bottom:7.5%;white-space:pre-line;padding:14px 18px;text-align:center;font-size:clamp(30px,3.1vh,40px);line-height:1.22;font-weight:700;color:#fff;-webkit-text-stroke:.6px #111;text-shadow:0 2px 3px #000,-1px -1px #000,1px 1px #000;z-index:5;opacity:0;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease;background:#111923d9;border-radius:12px}.subtitle.on{opacity:1;transform:translateY(0)}.controls{display:flex;align-items:center;gap:12px;width:min(92vw,600px);font-size:14px}.controls button{border:1px solid #5b6068;background:#282d35;color:white;padding:8px 14px;border-radius:8px;cursor:pointer}.controls input{flex:1;accent-color:#eda650}.controls .time{min-width:96px;text-align:right;font-variant-numeric:tabular-nums}.hidden-audio{display:none}
#phoneBuzz{transform-origin:180px 320px}#saleCup,#purchaseReceipt,#dailySummary{will-change:transform,opacity}#anton14Mouth{transform-box:fill-box;transform-origin:center}#phoneBuzz{animation:buzz .12s linear infinite}#clockHand{transform-origin:865px 280px;animation:clock 1.1s linear infinite}
@keyframes buzz{0%,100%{translate:0 0}25%{translate:3px -1px}50%{translate:-3px 2px}75%{translate:2px 1px}}@keyframes clock{to{transform:rotate(360deg)}}@keyframes fadeSteam{from{opacity:.75;transform:translateY(0)}to{opacity:.12;transform:translateY(-22px)}}
</style></head><body><main class="player"><div class="frame"><svg class="film" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet"><defs>${defs}
<linearGradient id="dawn" x2="0" y2="1"><stop stop-color="#54606b"/><stop offset="1" stop-color="#9b8a78"/></linearGradient>
</defs>${storyShots}${productionShots}</svg><div id="subtitle" class="subtitle" aria-live="polite"></div></div><div class="controls"><button id="play">РІвЂ“В¶ Р РЋРЎвЂљР В°РЎР‚РЎвЂљ</button><button id="restart">РІвЂ С” Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В°</button><button id="captions">Р РЋРЎС“Р В±РЎвЂљР С‘РЎвЂљРЎР‚РЎвЂ№: Р Р†Р С”Р В».</button><input id="seek" type="range" min="0" max="${timeline.duration}" step="0.01" value="0"><span id="time" class="time">00:00 / ${String(Math.floor(timeline.duration/60)).padStart(2,'0')}:${String(Math.floor(timeline.duration%60)).padStart(2,'0')}</span></div></main>
<audio id="narrator" class="hidden-audio"${proofAudioMuted} src="audio/narrator.wav"></audio><audio id="antonVoice" class="hidden-audio"${proofAudioMuted} src="audio/anton.wav"></audio><audio id="buyerVoice" class="hidden-audio"${proofAudioMuted} src="audio/buyer.wav"></audio><audio id="fx" class="hidden-audio"${proofAudioMuted} src="audio/sfx.wav"></audio><audio id="music" class="hidden-audio"${proofAudioMuted} src="audio/music.wav"></audio>
<script>
const dur=${timeline.duration}, shotData=[...document.querySelectorAll('.shot')].map((e,i)=>({e,start:+e.dataset.start,end:+e.dataset.end,i})),timelineAnims=document.getAnimations();let playing=false,captions=true,base=0,startStamp=0,raf=0;const sub=document.getElementById('subtitle'),seek=document.getElementById('seek'),timeLabel=document.getElementById('time');
const speech=${JSON.stringify(alignedSubtitleCues.map(c=>({a:c.start,b:c.end,t:c.text,speaker:c.speaker,file:c.file})))};
function windowFor(file){const cues=speech.filter(c=>c.file===file);if(cues.length)return{a:Math.min(...cues.map(c=>c.a)),b:Math.max(...cues.map(c=>c.b))};const line=${JSON.stringify(timeline.speech)}.find(c=>c.file===file);return line?{a:line.start,b:line.end}:null}
${walkerRuntime}
function renderCharacterActions(t){const breath=Math.sin(t*2*Math.PI/3.8)*1.4;const home=document.getElementById('homeAnton');if(home)home.setAttribute('transform','translate(8 '+(143+breath)+') scale(.67)');const homeHead=document.getElementById('homeHead');if(homeHead)homeHead.setAttribute('transform','rotate('+( -5+Math.sin(t*1.7)*.8)+' 250 105)');const blink=(()=>{const phase=t%3.65;return Math.max(0,1-Math.abs(phase-1.95)/.10)})();for(const id of ['homeBlinkL','homeBlinkR']){const eye=document.getElementById(id);if(eye){eye.setAttribute('ry',String(blink*4.8));eye.setAttribute('opacity',String(blink))}}const lids=document.getElementById('homeLidL');if(lids)lids.setAttribute('opacity',String(blink));const homeHand=document.getElementById('homeHand');if(homeHand)homeHand.setAttribute('transform','rotate('+Math.sin(t*1.4)*1.3+' 207 145)');const windowAnton=document.getElementById('windowAnton');if(windowAnton)windowAnton.setAttribute('transform','translate(-57 '+(197+breath*.7)+') scale(.7)');const windowHead=document.getElementById('windowHead');if(windowHead)windowHead.setAttribute('transform','rotate('+(4+Math.sin(t*1.1)*1.3)+' 250 105)');const ideaHead=document.getElementById('ideaHead');if(ideaHead){const s=${timeline.shots.shot09.start},q=Math.max(0,Math.min(1,(t-s)/1.1));ideaHead.setAttribute('transform','rotate('+(-4+4*q+Math.sin(t*1.5)*.55)+' 250 105)')}const finalAnton=document.getElementById('anton15');if(finalAnton)finalAnton.setAttribute('transform','translate(65 '+(650+breath*.5)+') scale(1.52)');const finalHead=document.getElementById('anton15Head');if(finalHead)finalHead.setAttribute('transform','rotate('+(Math.sin(t*1.2)*.8)+' 250 105)');const waitingHead=document.getElementById('anton12Head');if(waitingHead){const s=${timeline.shots.shot12.start},q=Math.max(0,Math.min(1,(t-s)/1.25));waitingHead.setAttribute('transform','rotate('+(-2+4*q+Math.sin(t*1.2)*.6)+' 250 105)')}const waitArms=document.getElementById('anton12Arms');if(waitArms){const w=Math.sin(t*1.1)*2.2;waitArms.setAttribute('transform','translate(0 '+w+')')}const waiting13=document.getElementById('anton13Head');if(waiting13)waiting13.setAttribute('transform','rotate('+Math.sin(t*1.45)*1.2+' 250 105)');const pickupPhone=document.getElementById('pickupPhone'),pickupArm=document.getElementById('pickupArm'),pickupHand=document.getElementById('pickupHand');if(pickupPhone&&pickupArm&&pickupHand){const a=${timeline.shots.shot04.start},b=${timeline.shots.shot04.end};let p=Math.max(0,Math.min(1,(t-a)/Math.max(.1,b-a)));p=p*p*(3-2*p);pickupPhone.setAttribute('transform','translate('+(-15*p)+' '+(-26*p)+')');pickupArm.setAttribute('d','M360 296 Q'+(321-17*p)+' '+(298-18*p)+' '+(278-23*p)+' '+(323-28*p));pickupHand.setAttribute('cx',String(274-23*p));pickupHand.setAttribute('cy',String(324-28*p));}const dArm=document.getElementById('decisionArm'),dHand=document.getElementById('decisionHand');if(dArm&&dHand){const a=${timeline.shots.shot10.start},b=${timeline.shots.shot10.end};let p=Math.max(0,Math.min(1,(t-a)/Math.max(.1,b-a)));p=p*p*(3-2*p);const x=255-55*p,y=329-37*p;dArm.setAttribute('d','M350 322 Q'+(306-35*p)+' '+(307-20*p)+' '+x+' '+y);dHand.setAttribute('cx',String(x));dHand.setAttribute('cy',String(y));}const start=${timeline.shots.shot11.start},local=t-start,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)};const setup=document.getElementById('setupAnton');if(setup)setup.setAttribute('transform','translate('+(8-45*(1-ease(local/.55)))+' '+(143+Math.sin(t*2.1)*.8)+') scale(.55)');const thermos=document.getElementById('purchaseThermos'),cart=document.getElementById('purchaseCart');const thermosUp=ease((local-1.45)/.85),cartUp=ease((local-2.2)/.85);if(thermos)thermos.setAttribute('transform','translate(190 '+(285-45*thermosUp)+') scale(.9)');if(cart)cart.setAttribute('transform','translate(230 '+(315-51*cartUp)+')');for(const [i,id] of ['purchaseCup1','purchaseCup2','purchaseCup3'].entries()){const cup=document.getElementById(id);if(cup){const q=ease((local-3.3-i*.38)/.72);cup.setAttribute('transform','translate('+(260+i*27)+' '+(380-23*q)+') scale(.62)');}}const rightReach=ease((local-1.05)/.65)*(1-ease((local-3.6)/.7)),leftReach=ease((local-1.8)/.65)*(1-ease((local-3.9)/.7));function setLimb(prefix,shoulder,elbow,wrist){const upper='M'+shoulder[0]+' '+shoulder[1]+' Q'+((shoulder[0]+elbow[0])/2)+' '+((shoulder[1]+elbow[1])/2)+' '+elbow[0]+' '+elbow[1],lower='M'+elbow[0]+' '+elbow[1]+' Q'+((elbow[0]+wrist[0])/2)+' '+((elbow[1]+wrist[1])/2)+' '+wrist[0]+' '+wrist[1];for(const [suffix,d] of [['UpperOutline',upper],['Upper',upper],['LowerOutline',lower],['Lower',lower]]){const node=document.getElementById(prefix+suffix);if(node)node.setAttribute('d',d)}}const rEnd=[322+(385-322)*rightReach,337+(213-337)*rightReach],rElbow=[326+(345-326)*rightReach,250+(205-250)*rightReach];setLimb('setupArm',[310,192],rElbow,rEnd);const rHand=document.getElementById('setupHand');if(rHand){rHand.setAttribute('cx',rEnd[0]);rHand.setAttribute('cy',rEnd[1]+4)}const lEnd=[179+(455-179)*leftReach,337+(238-337)*leftReach],lElbow=[174+(350-174)*leftReach,250+(205-250)*leftReach];setLimb('setupLeftArm',[190,192],lElbow,lEnd);const lHand=document.getElementById('setupLeftHand');if(lHand){lHand.setAttribute('cx',lEnd[0]);lHand.setAttribute('cy',lEnd[1]+4)}const setupHead=document.getElementById('setupHead');if(setupHead)setupHead.setAttribute('transform','rotate('+(-2+rightReach*3+Math.sin(t*1.4)*.5)+' 250 105)')}
function renderActionsV2(t){
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v)},mix=(a,b,p)=>a+(b-a)*p;
 const node=id=>document.getElementById(id),attr=(id,key,value)=>{const n=node(id);if(n)n.setAttribute(key,String(value));return n};
 const lerp=(a,b,p)=>mix(a,b,ease(p));
 const shot=id=>node(id),start=id=>+shot(id).dataset.start,end=id=>+shot(id).dataset.end;
 function limb(prefix,sx,sy,ex,ey,wx,wy){const d1='M'+sx+' '+sy+' Q'+((sx+ex)/2)+' '+((sy+ey)/2)+' '+ex+' '+ey,d2='M'+ex+' '+ey+' Q'+((ex+wx)/2)+' '+((ey+wy)/2)+' '+wx+' '+wy;for(const [s,d] of [['UpperOutline',d1],['Upper',d1],['LowerOutline',d2],['Lower',d2]])attr(prefix+s,'d',d);}
 function armPath(id,sx,sy,ex,ey,wx,wy){attr(id,'d','M'+sx+' '+sy+' Q'+((sx+ex)/2)+' '+((sy+ey)/2)+' '+ex+' '+ey+' Q'+((ex+wx)/2)+' '+((ey+wy)/2)+' '+wx+' '+wy);}
 // Home: gaze shifts from Anton to the vibrating phone before he leans toward it.
 const p2=clamp((t-start('shot02'))/(end('shot02')-start('shot02')));
 attr('homeHead','transform','rotate('+(-5+2.2*ease(p2))+' 250 105)');
 const phoneHead=node('phoneHead');if(phoneHead){const q=ease(p2);phoneHead.setAttribute('transform','rotate('+(-6+3*q)+' 250 105)');attr('phoneEyeL','cx',226+3*q);attr('phoneEyeR','cx',274+3*q);}
 const phoneRoot=node('phoneAnton');if(phoneRoot){const q=ease(p2);phoneRoot.setAttribute('transform','translate('+(-48+7*q)+' '+(99-5*q)+') scale(.82)');}
 // One continuous reach, contact, grip and lift. The phone follows the wrist after contact.
 const a=start('shot04'),b=end('shot04'),u=clamp((t-a)/(b-a)),reach=ease(u/.50),lift=ease((u-.40)/.60);
 const px=-14*lift,py=-52*lift;const phone=node('pickupPhone');if(phone)phone.setAttribute('transform','translate('+px+' '+py+')');
 const wristX=mix(355,278,reach)-14*lift,wristY=mix(355,323,reach)-52*lift,elbowX=mix(367,320,reach)-6*lift,elbowY=mix(323,296,reach)-25*lift;
 armPath('pickupArm',360,296,elbowX,elbowY,wristX,wristY);attr('pickupHand','cx',wristX);attr('pickupHand','cy',wristY);
 // Arrival: Anton walks in with the cart; cart travel, feet and wheel rotation stop together.
 const as=start('shot12'),arrivalT=t-as,arrivalP=ease(arrivalT/2.75),move=1-arrivalP,antonX=396-204*arrivalP,cartX=150-204*arrivalP;
 const arrival=node('anton12');if(arrival)arrival.setAttribute('transform','translate('+antonX+' '+(650+Math.abs(Math.sin(arrivalT*5))*2.1*move)+') scale(1.88)');
 const cart=node('arrivalCart');if(cart)cart.setAttribute('transform','translate('+cartX+' 0)');
 const stride=Math.sin(arrivalT*5.1)*13*move;attr('arrivalLeftLeg','transform','rotate('+stride+' 222 350)');attr('arrivalRightLeg','transform','rotate('+(-stride)+' 278 350)');
 attr('arrivalWheelA','transform','rotate('+((arrivalT<2.75?arrivalT*204/29*57.3:403))+' 765 1427)');attr('arrivalWheelB','transform','rotate('+((arrivalT<2.75?arrivalT*204/29*57.3:403))+' 918 1427)');
 if(arrivalT<3.45){armPath('arrivalArmLeft',190,192,246,240,298,337);armPath('arrivalArmRight',310,192,290,240,321,337);attr('arrivalHandLeft','cx',298);attr('arrivalHandLeft','cy',341);attr('arrivalHandRight','cx',321);attr('arrivalHandRight','cy',341);}else{armPath('arrivalArmLeft',190,192,174,250,178,337);armPath('arrivalArmRight',310,192,326,250,322,337);attr('arrivalHandLeft','cx',178);attr('arrivalHandLeft','cy',341);attr('arrivalHandRight','cx',322);attr('arrivalHandRight','cy',341);}
 const ah=node('anton12Head');if(ah)ah.setAttribute('transform','rotate('+(-2+arrivalP*2+Math.sin(arrivalT*1.3)*.5)+' 250 105)');
 // Setup: unfold/place the table, then carry and set down the thermos and each cup.
 const ss=start('shot13'),s=Math.max(0,t-ss),table=node('setupTable'),tablePlace=ease(s/1.65);if(table)table.setAttribute('transform','translate('+mix(420,0,tablePlace)+' '+mix(-80,0,tablePlace)+') rotate('+mix(7,0,tablePlace)+' 606 1368)');
 const thermos=node('setupThermos13');const tp=ease((s-1.45)/1.15),thermosX=mix(780,651,tp);if(thermos)thermos.setAttribute('transform','translate('+thermosX+' 1187) scale(1.08)');
 const cupIds=['setupCup1','setupCup2','setupCup3'],targets=[[810,1304],[874,1304],[938,1304]];
 cupIds.forEach((id,i)=>{const q=ease((s-(2.85+i*.8))/.72),n=node(id);if(n)n.setAttribute('transform','translate('+mix(790,targets[i][0],q)+' '+mix(1287,targets[i][1],q)+') scale(1.03)');});
 const thermoReach=ease((s-1.2)/.45)*(1-ease((s-2.65)/.3)),sh=node('setupHead');if(sh){const bored=s>6.1&&s<8.1?1:0;sh.setAttribute('transform','rotate('+(-1+thermoReach*2+bored*2+Math.sin(t*1.4)*.35)+' 250 105)');}
 // Shopping montage: Anton takes three cups one at a time and sets them on the cart.
 const prepStart=t-start('shot11'),prepAnton=node('setupAnton'),prepWalk=ease(prepStart/.85),prepStride=Math.sin(prepStart*10.5)*12*(1-ease((prepStart-.65)/.35));
 if(prepAnton)prepAnton.setAttribute('transform','translate('+mix(-48,8,prepWalk)+' '+(143+Math.sin(t*2.1)*.65)+') scale(.55)');
 attr('setupLeftLeg','transform','rotate('+prepStride+' 222 350)');attr('setupRightLeg','transform','rotate('+(-prepStride)+' 278 350)');
 const cupSources=[[260,380],[287,380],[314,380]],cupDestinations=[[240,295],[268,295],[296,295]],cupStages=[3.75,4.85,5.95];
 let activeCup=-1,handProgress=0,handWorld=[322,337];
 cupSources.forEach(([sx,sy],i)=>{
  const cupNode=node('purchaseCup'+(i+1)),stage=cupStages[i],elapsed=prepStart-stage,reach=ease(elapsed/.2),carry=ease((elapsed-.2)/.56),release=ease((elapsed-.77)/.2),[dx,dy]=cupDestinations[i];
  const x=mix(sx,dx,carry),y=mix(sy,dy,carry);if(cupNode)cupNode.setAttribute('transform','translate('+x+' '+y+') scale(.62)');
  if(elapsed>=0&&elapsed<=.98){activeCup=i;handProgress=elapsed<.2?reach:elapsed<.77?1:1-release;handWorld=[x+16,y+12];}
 });
 if(activeCup>=0){const wx=(handWorld[0]-8)/.55,wy=(handWorld[1]-143)/.55,reach=handProgress,ex=mix(326,wx-36,reach),ey=mix(250,wy-54,reach),hx=mix(322,wx,reach),hy=mix(337,wy,reach);limb('setupArm',310,192,ex,ey,hx,hy);attr('setupHand','cx',hx);attr('setupHand','cy',hy+4);}
 // Waiting has discrete performance beats: notice, follow, deflate, then reset toward the next worker.
 const w=s;let angle=0,lean=0;if(w<2.2){angle=mix(0,-3,w/2.2);lean=ease(w/2.2)*-2;}else if(w<4.1){angle=mix(-3,2,(w-2.2)/1.9);lean=mix(-2,1,(w-2.2)/1.9);}else if(w<6.2){angle=mix(2,-5,(w-4.1)/2.1);lean=mix(1,-3,(w-4.1)/2.1);}else if(w<7.8){angle=mix(-5,1,(w-6.2)/1.6);lean=mix(-3,0,(w-6.2)/1.6);}else{angle=Math.sin(t*1.2)*.45;lean=Math.sin(t*.8)*.4;}
 const wh=node('anton13Head');if(wh)wh.setAttribute('transform','rotate('+angle+' 250 105)');const anton=node('anton13');if(anton)anton.setAttribute('transform','translate('+(192+lean)+' '+(650+Math.sin(t*1.8)*.7)+') scale(1.88)');
 const tableReach=ease(s/.7)*(1-ease((s-1.55)/.25));let leftX=mix(178,220,tableReach),leftY=mix(337,360,tableReach);if(s>5.8&&s<7.6){const adjust=ease((s-5.8)/.35)*(1-ease((s-7.0)/.3));leftX=mix(leftX,198,adjust);leftY=mix(leftY,354,adjust);}armPath('anton13LeftArm',190,192,mix(174,196,tableReach),mix(250,297,tableReach),leftX,leftY);attr('anton13LeftHand','cx',leftX);attr('anton13LeftHand','cy',leftY+4);
 let rightX=mix(321,(thermosX+30-192)/1.88,thermoReach),rightY=mix(337,(1215-650)/1.88,thermoReach),rightElbowX=mix(326,rightX-40,thermoReach),rightElbowY=mix(250,rightY-54,thermoReach);
 const cupStage=s>=2.85&&s<5.85?Math.min(2,Math.floor((s-2.85)/.8)): -1;if(cupStage>=0){const q=ease((s-(2.85+cupStage*.8))/.72),target=targets[cupStage];rightX=mix(321,(target[0]+22-192)/1.88,q);rightY=mix(337,(target[1]+18-650)/1.88,q);rightElbowX=mix(326,rightX-35,q);rightElbowY=mix(250,rightY-50,q);}
 if(s>5.85){rightX=mix(rightX,322,ease((s-5.85)/.6));rightY=mix(rightY,337,ease((s-5.85)/.6));rightElbowX=mix(rightElbowX,326,ease((s-5.85)/.6));rightElbowY=mix(rightElbowY,250,ease((s-5.85)/.6));}
 armPath('anton13RightArm',310,192,rightElbowX,rightElbowY,rightX,rightY);attr('anton13RightHand','cx',rightX);attr('anton13RightHand','cy',rightY+4);
  // Sale blocking follows the dialogue and real contact points: approach, order, pour, handoff, payment, reaction.
  const buyerCue=windowFor('buyer-01.wav'),antonCue=windowFor('anton-02.wav'),saleCue=windowFor('narration-13.wav');
  const saleStart=start('shot14'),elapsed=t-saleStart,buyer=node('customer14-root'),buyerAsk=buyerCue?.a??saleStart+3.4;
  const approachDuration=Math.max(.9,buyerAsk-saleStart-.22),leaveStart=(antonCue?.b??buyerAsk+2)+.7;
  const approach=ease(elapsed/approachDuration),leave=ease((t-leaveStart)/1.65),buyerX=1140-240*approach+460*leave;
  if(buyer){const bs=+buyer.dataset.scale;buyer.setAttribute('transform','translate('+(buyerX-250*bs)+' '+(1510-449*bs)+') scale('+bs+')');}
  const askEnd=buyerCue?.b??buyerAsk+.8,replyStart=antonCue?.a??askEnd+.35,replyEnd=antonCue?.b??replyStart+1.5;
  const pourStart=Math.max(askEnd+.12,replyStart),pourEnd=pourStart+.82,handoutStart=pourEnd+.16,handoutEnd=handoutStart+.52;
  const pickup=ease((t-pourStart)/.34),pour=ease((t-pourStart)/.82),buyerTake=ease((t-handoutStart)/.52);
  const bparts=(buyer?.getAttribute('transform')||'translate(0 0) scale(1)').replace('translate(','').replace(') scale(',',').replace(')','').split(/[ ,]+/).map(Number),bs=bparts[2],handReach=ease((t-handoutStart)/.5),leaveOffset=460*leave;
  const handLocalX=mix(178,221,handReach),handLocalY=mix(337,285,handReach),handX=bparts[0]+bs*handLocalX,handY=bparts[1]+bs*handLocalY;
  const cupX=mix(819,handX-26,buyerTake),cupY=mix(mix(1305,1274,pickup),handY-16,buyerTake),sale=node('saleCup');
  if(sale){sale.dataset.owner=t<pourStart?'table':t<handoutStart?'anton_hand':t<handoutEnd?'transfer':'buyer_hand';sale.setAttribute('transform','translate('+(cupX+leaveOffset)+' '+(cupY+31*leave)+') scale(1.05)');}
  const stream=node('coffeeStream');if(stream){const on=t>=pourStart&&t<pourEnd;stream.setAttribute('opacity',on?String(.88*Math.min(1,(pourEnd-t)/.12)):'0');stream.setAttribute('d','M710 1275Q760 1278 '+cupX+' '+cupY);}
  const fill=node('cupFill');if(fill){fill.setAttribute('opacity',String(pour));fill.setAttribute('d','M6 '+(50-22*pour)+'H32L29 53Q18 56 8 53Z');}
  const buyerArm=node('customer14-leftArm');if(buyerArm){const elbowX=mix(174,205,handReach),elbowY=mix(250,238,handReach),paths=buyerArm.querySelectorAll('path');if(paths.length>=4){const upper='M190 192 Q'+((190+elbowX)/2)+' '+((192+elbowY)/2)+' '+elbowX+' '+elbowY,lower='M'+elbowX+' '+elbowY+' Q'+((elbowX+handLocalX)/2)+' '+((elbowY+handLocalY)/2)+' '+handLocalX+' '+handLocalY;for(const i of [0,1])paths[i].setAttribute('d',upper);for(const i of [2,3])paths[i].setAttribute('d',lower);}const hand=buyerArm.querySelector('circle');if(hand){hand.setAttribute('cx',String(handLocalX));hand.setAttribute('cy',String(handLocalY));}}
  const grip=node('buyerCupGrip');if(grip){grip.setAttribute('cx',handX);grip.setAttribute('cy',handY);grip.setAttribute('opacity',buyerTake>0?'1':'0');}
  const reachCup=ease((t-replyStart)/.48)*(1-ease((t-handoutEnd)/.28)),cupElbowX=mix(326,335,reachCup),cupElbowY=mix(250,275,reachCup),cupWristX=mix(321,370,reachCup),cupWristY=mix(337,331,reachCup);armPath('anton14Arm',310,192,cupElbowX,cupElbowY,cupWristX,cupWristY);attr('anton14Hand','cx',cupWristX);attr('anton14Hand','cy',cupWristY+4);
  const payStart=handoutEnd+.12,paid=ease((t-payStart)/.72),cash=node('paymentCash');if(cash){cash.setAttribute('opacity',t>=payStart&&t<payStart+1.15?'1':'0');cash.setAttribute('transform','translate('+(990-258*paid)+' '+(1370-79*paid)+')');}
  const pElbowX=mix(174,274,paid),pElbowY=mix(250,220,paid),pHandX=mix(178,321,paid),pHandY=mix(337,341,paid);armPath('anton14PaymentArm',190,192,pElbowX,pElbowY,pHandX,pHandY);attr('anton14PaymentHand','cx',pHandX);attr('anton14PaymentHand','cy',pHandY+4);
  const head=node('anton14Head');if(head){const reaction=ease((t-payStart)/.7);head.setAttribute('transform','rotate('+(-1+3*reaction)+' 250 105)');}
  const saleCamera=node('saleCameraWorld');if(saleCamera){const stages=[{time:saleStart,scale:1,cx:540,cy:960},{time:buyerAsk,scale:1.1,cx:580,cy:1000},{time:pourStart,scale:1.22,cx:630,cy:1080},{time:payStart,scale:1.1,cx:580,cy:950},{time:(saleCue?.a??payStart+1),scale:1.04,cx:560,cy:930}];let state=stages[0];for(let i=1;i<stages.length;i++){if(t<=stages[i].time){const prev=stages[i-1],next=stages[i],q=ease((t-prev.time)/Math.max(.08,next.time-prev.time));state={scale:mix(prev.scale,next.scale,q),cx:mix(prev.cx,next.cx,q),cy:mix(prev.cy,next.cy,q)};break;}state=stages[i];}const camX=540-state.cx*state.scale,camY=960-state.cy*state.scale;saleCamera.setAttribute('transform','translate('+camX+' '+camY+') scale('+state.scale+')');const title=node('saleTitle');if(title)title.setAttribute('transform','translate('+(-camX/state.scale)+' '+(-camY/state.scale)+') scale('+(1/state.scale)+')');}
  const toast=node('saleToast'),toastStart=saleCue?.a??payStart+1;if(toast)toast.setAttribute('opacity',String(ease((t-toastStart)/.2)*(1-ease((t-(saleCue?.b??toastStart+3.1))/.25))));
 // Final: follow the buyer, notice the payment, glance at remaining coffee, then settle on a hopeful decision.
 const fin=t-start('shot15'),fh=node('anton15Head');if(fh){let d=fin<1.8?mix(0,-3,fin/1.8):fin<3.8?mix(-3,4,(fin-1.8)/2):fin<6.5?mix(4,-2,(fin-3.8)/2.7):mix(-2,1,(fin-6.5)/2.8);fh.setAttribute('transform','rotate('+d+' 250 105)');}
 const finalRoot=node('anton15');if(finalRoot)finalRoot.setAttribute('transform','translate(65 '+(650+Math.sin(t*1.7)*.55)+' ) scale(1.52)');
 const towardThermos=ease((fin-4.8)/.65)*(1-ease((fin-6.5)/.45)),finalWX=mix(181,154,towardThermos),finalWY=mix(337,292,towardThermos);armPath('anton15LeftArm',190,192,mix(175,164,towardThermos),mix(250,238,towardThermos),finalWX,finalWY);attr('anton15LeftHand','cx',finalWX);attr('anton15LeftHand','cy',finalWY+4);
 const summary=node('dailySummary'),summaryIn=ease((fin-4.8)/.75);if(summary){summary.setAttribute('transform','translate('+(150*(1-summaryIn))+' 0) scale(.82)');summary.setAttribute('opacity',summaryIn);}
}
function renderAt(t){t=Math.max(0,Math.min(dur,t));for(const anim of timelineAnims){anim.currentTime=t*1000;anim.pause()}for(const s of shotData){let a=t>=s.start&&t<s.end?1:0;if(a&&t-s.start<.22)a=(t-s.start)/.22;if(a&&s.end-t<.22)a=(s.end-t)/.22;s.e.style.visibility=a>0?'visible':'hidden';s.e.style.opacity=String(Math.max(0,Math.min(1,a)));if(a){let p=(t-s.start)/(s.end-s.start);let z=(s.i===0||s.i===1||s.i===5||s.i===8||s.i===14)?1+.018*p:1;s.e.style.transform='scale('+z+')';}}
renderWalkers(t);renderCharacterActions(t);
document.getElementById('purchaseReceipt').setAttribute('visibility',t>=${timeline.effects.receiptStart}&&t<${timeline.effects.receiptEnd}?'visible':'hidden');
const active=speech.find(v=>t>=v.a&&t<v.b),captionOn=!!active&&captions;sub.textContent=active?active.t:'';sub.classList.toggle('on',captionOn);if(captionOn){const fade=Math.min(1,(t-active.a)/.12,(active.b-t)/.12);sub.style.opacity=String(Math.max(0,fade));sub.style.transform='translateY('+((1-Math.max(0,fade))*4)+'px)';}else{sub.style.opacity='0';sub.style.transform='translateY(4px)';}
const m=document.getElementById('talkingMouth'),m1w=windowFor('anton-01.wav');if(m&&m1w){const speaking=t>=m1w.a&&t<m1w.b;const q=speaking?t-m1w.a:0;const open=speaking?Math.max(0,Math.sin(q*8.3)+.25*Math.sin(q*15.7)):0;m.setAttribute('rx',String(2+Math.max(0,open)*2.4));m.setAttribute('ry',String(1.5+Math.max(0,open)*3.1));}
const m2=document.getElementById('anton14Mouth'),m2w=windowFor('anton-02.wav');if(m2&&m2w){const speaking=t>=m2w.a&&t<m2w.b;const q=speaking?t-m2w.a:0;const open=speaking?Math.max(0,Math.sin(q*8.1)+.2*Math.sin(q*13.6)):0;m2.setAttribute('rx',String(2+Math.max(0,open)*2.4));m2.setAttribute('ry',String(1.5+Math.max(0,open)*3.1));}
const buyerMouth=document.getElementById('customer14-mouth'),buyerWindow=windowFor('buyer-01.wav');if(buyerMouth){const speaking=buyerWindow&&t>=buyerWindow.a&&t<buyerWindow.b;if(speaking){const q=t-buyerWindow.a,open=.8+Math.max(0,Math.sin(q*7.5)+.2*Math.sin(q*13.1))*2.1;buyerMouth.setAttribute('d','M '+(250-open*1.5)+' 134 Q 250 '+(134-open*1.4)+' '+(250+open*1.5)+' 134 Q 250 '+(134+open*2)+' '+(250-open*1.5)+' 134 Z');buyerMouth.setAttribute('fill','#25292D');buyerMouth.setAttribute('stroke','none');}else{buyerMouth.setAttribute('d','M242 134L258 134');buyerMouth.setAttribute('fill','none');buyerMouth.setAttribute('stroke','#25292D');}}
if(t>=${timeline.shots.shot13.start}&&t<${timeline.shots.shot13.end})document.getElementById('clockHand').style.transform='rotate('+((t-${timeline.shots.shot13.start})*360)+'deg)';
renderActionsV2(t);\nseek.value=t;timeLabel.textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t)%60).padStart(2,'0')+' / '+String(Math.floor(dur/60)).padStart(2,'0')+':'+String(Math.floor(dur%60)).padStart(2,'0');
}
function current(){return playing?base+(performance.now()-startStamp)/1000:base}function tick(){const t=current();renderAt(t);if(t>=dur){pause();base=dur;renderAt(dur);return}raf=requestAnimationFrame(tick)}
const aud=[document.getElementById('narrator'),document.getElementById('antonVoice'),document.getElementById('buyerVoice'),document.getElementById('fx'),document.getElementById('music')];
function play(){if(base>=dur)base=0;playing=true;startStamp=performance.now();for(const a of aud){a.currentTime=base;a.play().catch(()=>{})}document.getElementById('play').textContent='РІСњС™РІСњС™ Р СџР В°РЎС“Р В·Р В°';cancelAnimationFrame(raf);tick()}
function pause(){base=current();playing=false;for(const a of aud)a.pause();document.getElementById('play').textContent='РІвЂ“В¶ Р СџРЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р С‘РЎвЂљРЎРЉ';cancelAnimationFrame(raf)}
document.getElementById('play').onclick=()=>playing?pause():play();document.getElementById('restart').onclick=()=>{pause();base=0;for(const a of aud){a.currentTime=0}renderAt(0);play()};document.getElementById('captions').onclick=e=>{captions=!captions;e.currentTarget.textContent='Р РЋРЎС“Р В±РЎвЂљР С‘РЎвЂљРЎР‚РЎвЂ№: '+(captions?'Р Р†Р С”Р В».':'Р Р†РЎвЂ№Р С”Р В».');renderAt(current())};seek.oninput=()=>{pause();base=+seek.value;for(const a of aud)a.currentTime=base;renderAt(base)};
window.renderAt=renderAt;window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();playing?pause():play()}});renderAt(0);
</script></body></html>`;

const cp1251Reverse=new Map(Array.from({length:256},(_,byte)=>[new TextDecoder('windows-1251').decode(Uint8Array.of(byte)),byte]));
function cp1251Bytes(value){const out=[];for(const ch of value){if(cp1251Reverse.has(ch))out.push(cp1251Reverse.get(ch));else out.push(...new TextEncoder().encode(ch));}return new Uint8Array(out);}
function repairVisibleText(value){let out=value;const suspect=()=>/[\u0420\u0421][^\u0000-\u007f]/.test(out)||out.includes(String.fromCharCode(0x0432,0x201a,0x0405));for(let i=0;i<5&&suspect();i++){try{const next=new TextDecoder('utf-8',{fatal:true}).decode(cp1251Bytes(out));if(next===out||!/[\u0400-\u04ff]/.test(next))break;out=next;}catch{break;}}return out;}
const playerDocument = document
  .replace('<input id="seek"', '<button id="voiceTest">Р СџР С•Р В»Р С‘РЎР‚Р С•Р Р†Р С”Р В° v2</button><button id="voiceTest2">Р СљРЎРЏР С–РЎвЂЎР Вµ v3</button><input id="seek"')
  .replace('<script>', `<audio id="narratorTestPreview" class="hidden-audio"${proofAudioMuted} preload="none" src="audio/narrator-test-polished.wav"></audio><audio id="narratorTest2" class="hidden-audio"${proofAudioMuted} preload="none" src="audio/narrator-test-softer.wav"></audio>\n<script>`)
  .replace("seek.oninput=()=>", "document.getElementById('voiceTest').onclick=()=>{const preview=document.getElementById('narratorTestPreview');preview.currentTime=0;preview.play().catch(()=>{})};document.getElementById('voiceTest2').onclick=()=>{const preview=document.getElementById('narratorTest2');preview.currentTime=0;preview.play().catch(()=>{})};seek.oninput=()=>");
const currencyToken=String.fromCharCode(0x0432,0x201a,0x0405),correctedCurrency=playerDocument.replaceAll(currencyToken,String.fromCharCode(0x20bd));
const scriptStart=correctedCurrency.indexOf('<script>');
const visibleMarkup=correctedCurrency.slice(0,scriptStart).replace(/>([^<>]+)</g,(all,text)=>text.includes(String.fromCharCode(0x0420))||text.includes(String.fromCharCode(0x0421))?('>'+repairVisibleText(text)+'<'):all);
fs.writeFileSync(path.join(here, 'episode-01-production.html'), (visibleMarkup+correctedCurrency.slice(scriptStart)).replaceAll(currencyToken,String.fromCharCode(0x20bd)), 'utf8');
console.log('Built episode-01-production.html using the approved Anton V4 storyboard.');
