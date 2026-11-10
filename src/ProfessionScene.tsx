import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import './ProfessionScene.css';

type Profession = 'miner' | 'lumberjack' | 'fisherman' | 'farmer' | 'courier' | 'taxi';
type SceneProps = { profession: string; stage: number; cycleId: string | null; onBusyChange?: (busy: boolean) => void };
const LABELS: Record<Profession, string> = {
  miner: 'Под землёй', lumberjack: 'Лесная делянка', fisherman: 'Тихая заводь',
  farmer: 'Свой урожай', courier: 'От двери до двери', taxi: 'Городской маршрут',
};

// All artwork is local vector geometry. The server's acknowledged step is the
// only input to the animation; animation completion never advances game state.
function Mine() {
  return <>
    <path fill="#1e3032" d="M0 0h480v232H0z" />
    <path fill="#293e40" d="m0 0 81 11 28 31 66-18 69 15 56-13 55 28 70-27 55 15v190H0Z" />
    <path fill="#34494a" d="m250 75 48-30 62 9 41 33 29 68-16 47H240l-29-63Z" />
    <path fill="#405453" d="m298 45 13 60 49-51 41 33-37 64 66 4-16 47H283l-18-69-54 6 39-64Z" />
    <path fill="none" stroke="#23383a" strokeWidth="3" d="m311 105-46 28 18 69m81-51-53-46m53 46-13 51" />
    <path fill="#25373a" d="M0 197q121-13 226 2t254-6v39H0Z" />
    <g fill="#806d51" stroke="#243335" strokeWidth="3">
      <path d="M51 25h16v173H51zM181 25h16v173h-16z" />
      <path d="M42 25h164v17H42z" />
      <path d="m65 42 25 28-8 7-17-19zm118 0-25 28 8 7 17-19z" />
    </g>
    <path stroke="#ad9270" strokeWidth="2" d="M56 48v136M186 50v133M52 31h143" />
    <path stroke="#a8b0a0" strokeWidth="2" d="M120 42v17" />
    <path fill="#ddbd6b" opacity=".08" d="m111 69-55 123h132L130 69Z" />
    <g className="ws-lamp"><rect x="109" y="57" width="23" height="26" rx="5" fill="#263331" stroke="#aa9470" strokeWidth="2" /><rect x="114" y="62" width="13" height="15" rx="2" fill="#f2d184" /><path stroke="#887556" strokeWidth="2" d="M109 79h23" /></g>
    <path stroke="#92aaa5" strokeWidth="4" d="m18 212 229-10m-211 22 223-10" />
    <path stroke="#5e7774" strokeWidth="4" d="m40 211 3 15m38-17 3 15m38-17 3 15m38-17 3 15m38-17 3 15" />
    <g className="ws-rock"><path fill="#6d8480" stroke="#253b3c" strokeWidth="3" d="m267 143 27-17 30 7 17 35-13 29h-61l-14-26Z" /><path fill="#8b9e90" d="m267 143 27-17-2 29-24 15-15 1Z" /><path fill="none" stroke="#c1c8a1" strokeWidth="4" strokeLinecap="round" d="m293 150 12 9 10-12" /><path className="ws-crack ws-step-1" fill="none" stroke="#243a39" strokeWidth="3" d="m299 141-7 18 11 10-11 23" /><path className="ws-crack ws-step-2" fill="none" stroke="#243a39" strokeWidth="3" d="m293 159-21 4m30 7 22 9" /></g>
    <g className="ws-pick" style={{ transformOrigin: '225px 164px' }}><path stroke="#332d26" strokeWidth="12" strokeLinecap="round" d="m218 178 59-80" /><path stroke="#b8915c" strokeWidth="7" strokeLinecap="round" d="m218 178 59-80" /><path fill="#c3cec5" stroke="#283e3f" strokeWidth="3" strokeLinejoin="round" d="m253 92 19-9 13 1 25 27-31-14-20 5Z" /><path stroke="#edf0db" strokeWidth="2" d="m258 93 17-6 9 1" /></g>
    <g className="ws-chips" fill="#d7c58c"><path d="m291 138 6-8 5 9-6 3Z" /><path d="m310 144 6-5 5 5-8 5Z" /><path d="m278 148-7-4 2-6 9 6Z" /></g>
    <g className="ws-cart"><g fill="#9fa68a" stroke="#293d3b" strokeWidth="2"><path className="ws-step-1" d="m92 162 10-16 17 2 13 16Z" /><path className="ws-step-2" d="m117 161 7-25 21 2 15 25Z" /><path className="ws-step-3" d="m78 166 5-18 13-6 15 23Zm70-2 9-18 18 7 2 12Z" /></g><path fill="#748c83" stroke="#20383a" strokeWidth="3" d="m72 163 111-3-11 35-88 3Z" /><path fill="#93a69a" d="m78 167 99-3-2 7-94 3Z" /><path stroke="#405b57" strokeWidth="3" d="m104 176 3 16m41-18-2 16" /><path stroke="#182e31" strokeWidth="5" d="m88 199 82-3" /><g fill="#273d3d" stroke="#9baca0" strokeWidth="3"><circle cx="96" cy="203" r="10" /><circle cx="160" cy="200" r="10" /></g><g fill="#abb5a4"><circle cx="96" cy="203" r="3" /><circle cx="160" cy="200" r="3" /></g></g>
    <path fill="#536b63" d="m368 204 12-11 17 12Zm-20 8 7-8 9 9Z" />
  </>;
}

function Pine({ x, y, scale = 1, color = '#597866' }: { x: number; y: number; scale?: number; color?: string }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><path stroke="#756f50" strokeWidth="7" d="M0 0v-102" /><path fill={color} d="m0-137-28 49h14l-26 38h20L-46-9h92L20-50h20L14-88h14Z" /><path stroke="#c6d2ae" strokeWidth="2" opacity=".25" d="m0-115-13 25m13 19L-19-42" /></g>;
}
function Forest() {
  return <>
    <path fill="#c8d5b8" d="M0 0h480v232H0z" /><circle cx="92" cy="53" r="28" fill="#e9deb0" />
    <path fill="#b3c6ab" d="M0 122q76-55 170-15t155-12 155 13v124H0Z" />
    {[30, 98, 162, 377, 451].map((x, i) => <Pine key={x} x={x} y={176} scale={.65 + i % 3 * .13} color="#94ad91" />)}
    <path fill="#879c76" d="M0 181q120-23 242 5t238-13v59H0Z" /><path fill="#a4b18a" d="M0 204q124-30 238-5t242 0v33H0Z" />
    <Pine x={53} y={203} scale={1.25} color="#426857" />
    <g className="ws-falling-tree" style={{ transformOrigin: '302px 183px' }}><path fill="#917253" stroke="#5a5c43" strokeWidth="2" d="m290 185 5-113h17l6 113Z" /><path stroke="#bd9970" strokeWidth="3" d="m301 86-1 80" /><path fill="#466c55" d="m304 14-37 52h18l-32 39h23l-40 40h134l-39-40h22l-33-39h17Z" /><path fill="#5f8463" d="m304 14-37 52h18l-32 39h23l-40 40h63l5-131Z" /><path stroke="#91a17c" strokeWidth="2" fill="none" d="m291 54-11 10m11 30-17 10m18 28-23 8" /><path className="ws-step-2" fill="#dbc094" d="m289 169 17 9-18 5Z" /></g>
    <g className="ws-stump"><path fill="#896949" d="m286 179 34 1 5 22-45 1Z" /><ellipse cx="303" cy="181" rx="17" ry="5" fill="#d7b98b" /><ellipse cx="303" cy="181" rx="9" ry="2.5" fill="none" stroke="#a58259" strokeWidth="1.5" /></g>
    <g className="ws-axe" style={{ transformOrigin: '212px 164px' }}><path stroke="#4d4c38" strokeWidth="13" strokeLinecap="round" d="m205 178 54-75" /><path stroke="#b48a56" strokeWidth="8" strokeLinecap="round" d="m205 178 54-75" /><path fill="#aab9aa" stroke="#344f46" strokeWidth="3" d="m248 91 18 10 27 5-14 23-18-17-21-9Z" /><path fill="#e0e2ca" d="m284 106 9 0-14 23-6-7Z" /></g>
    <g className="ws-chips" fill="#e5c28d"><path d="m280 172-8-8 4-2 8 8Z" /><path d="m285 181-14 2v-4l13-2Z" /><path d="m284 163-4-9 5-1 3 10Z" /></g>
    <g stroke="#725b42" strokeWidth="2"><path fill="#ac875a" d="m111 188 53-8 15 12-56 10Z" /><ellipse cx="121" cy="195" rx="11" ry="8" fill="#dec394" /><ellipse cx="121" cy="195" rx="5" ry="4" fill="none" /><path fill="#9a774e" d="m129 202 47-7 11 10-51 9Z" /><ellipse cx="135" cy="207" rx="9" ry="7" fill="#d7b98b" /></g>
    <g fill="none" stroke="#5c7753" strokeWidth="2" strokeLinecap="round"><path d="m73 214-5-10m5 10 5-14m-5 14 9-5m268 1-3-12m3 12 7-9m83 0-5-10m5 10 7-13" /></g>
  </>;
}

function Lake() {
  return <>
    <path fill="#c8dcdb" d="M0 0h480v232H0z" /><circle cx="373" cy="47" r="25" fill="#eee5c7" />
    <path fill="#a3bfba" d="M0 87q65-24 123 0t126-7 123-1 108 5v67H0Z" /><path fill="#789f98" d="m0 109 50-16 19 12 45-17 51 26 69-16 54 17 90-22 102 18v42H0Z" />
    <path fill="#649d9f" d="M0 132h480v100H0z" /><path fill="#75aaac" d="M0 132h480v19H0z" />
    <g className="ws-water" stroke="#accdbe" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M212 159h35m66-8h49m48 19h43M189 198h46m56 14h32m51-21h47m-157-11h29M38 219h41" /></g>
    <path fill="#74836b" d="M0 147q48-16 84 1l20 84H0Z" />
    <g stroke="#5d5944" strokeWidth="3"><path d="M72 169v47m72-47v40" /><path fill="#b19b75" d="m0 155 163 1 14 22H0Z" /><path fill="#8b765a" d="M0 178h177v7H0Z" /><path stroke="#75684f" strokeWidth="2" d="m35 156 3 21m32-20 4 20m32-20 5 20m29-20 8 20" /></g>
    <g className="ws-rod" style={{ transformOrigin: '123px 155px' }}><path fill="none" stroke="#405a50" strokeWidth="4" strokeLinecap="round" d="M123 155Q191 45 282 59" /><path stroke="#b7925b" strokeWidth="7" strokeLinecap="round" d="m120 160 17-25" /><circle cx="132" cy="149" r="6" fill="#d7c79e" stroke="#405a50" strokeWidth="2" /><path className="ws-line" fill="none" stroke="#e9ead2" strokeWidth="1.5" d="M282 59Q286 109 305 160" /></g>
    <g className="ws-bobber"><ellipse cx="305" cy="164" rx="25" ry="5" fill="none" stroke="#b5d5c6" strokeWidth="1.5" /><path stroke="#3b686a" strokeWidth="2" d="M305 149v14" /><path fill="#e4d9bd" d="M300 157a5 5 0 0 1 10 0v4h-10Z" /><path fill="#cb7c5b" d="M300 157a5 5 0 0 1 10 0v1h-10Z" /></g>
    <g className="ws-splash" fill="none" stroke="#d4e5d3" strokeWidth="3" strokeLinecap="round"><path d="m292 151-6-8m27 8 7-8m-17 3v-12" /></g>
    <path className="ws-catch-line" style={{ transformOrigin: '282px 59px' }} fill="none" stroke="#e9ead2" strokeWidth="1.5" d="M282 59v56" />
    <g className="ws-catch"><g className="ws-fish" style={{ transformOrigin: '282px 127px' }}><path fill="#c2cda6" stroke="#3e706e" strokeWidth="2.5" d="M282 113c-24 4-30 28 0 40 27-12 22-36 0-40Zm0 40-10 12h21Z" /><path fill="#90ae95" d="M281 116c-14 9-15 22 1 34-2-13-1-24-1-34Z" /><circle cx="288" cy="123" r="2.5" fill="#294e50" /><path fill="none" stroke="#648b7b" strokeWidth="2" d="m282 132 8 5-8 5" /></g></g>
    <g fill="#486c59"><path d="M26 180q-20-46-16-64 20 23 20 64Zm8 0q-1-56 10-77 6 32-5 77Z" /><path d="M450 232q-22-46-14-67 13 24 18 67Zm10 0q-4-51 11-71 1 30-7 71Z" /></g>
    <path fill="#aab9a0" stroke="#48645a" strokeWidth="2" d="m79 141 27 1-3 28H82Z" /><path fill="none" stroke="#d3d6b8" strokeWidth="2" d="M81 148v-11q12-15 23 1v10" /><ellipse cx="92" cy="142" rx="13" ry="3" fill="#627f6f" />
  </>;
}

function Crop({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path stroke="#677748" strokeWidth="3" d="M0 0v-43" /><path fill="#b89a51" d="M0-19c-15-1-17-12-17-12 12-2 17 12 17 12Zm0-9c14-2 17-12 17-12-13-1-17 12-17 12Zm0-9c-12-2-13-12-13-12 11 0 13 12 13 12Zm0-5c10-3 10-11 10-11-9 1-10 11-10 11Z" /><path fill="#84945a" d="M0-5q-20-3-22-15Q-4-18 0-5Zm0-3q20-3 23-16Q5-20 0-8Z" /></g>;
}
function Farm() {
  return <>
    <path fill="#e2dbbd" d="M0 0h480v232H0z" /><circle cx="366" cy="42" r="24" fill="#efe7ca" /><path fill="#b8bc90" d="M0 103q94-45 178-12t143-7 159 3v145H0Z" /><path fill="#99a579" d="M0 128q140-23 222-5t258-19v128H0Z" />
    <g stroke="#969775" strokeWidth="5" fill="none"><path d="M0 129h480M0 142h480" />{[16, 65, 114, 163, 212, 261, 310, 359, 408, 457].map(x => <path key={x} d={`M${x} 118v38`} />)}</g>
    <g fill="#b68f66" stroke="#7a7151" strokeWidth="2"><path d="m72 175 209-24 79 46-224 30Z" /><path fill="#97744f" d="m86 176 192-20 66 39-206 27Z" /></g>
    <g className="ws-furrows" fill="none" stroke="#665a40" strokeWidth="5" strokeLinecap="round"><path d="m112 180 172-18m-149 30 169-19m-146 32 166-20" /></g>
    <g className="ws-seedlings" stroke="#607749" strokeWidth="3" fill="#8b9e5d">{[137, 184, 231, 278].map((x, i) => <g key={x} transform={`translate(${x} ${193 - i * 5})`}><path d="M0 0v-11" /><path d="M0-8q-13-13-17-5Q-16-5 0-8Zm0-2q10-15 15-9Q16-11 0-10Z" /></g>)}</g>
    <g className="ws-crops">{[137, 184, 231, 278].map((x, i) => <Crop key={x} x={x} y={193 - i * 5} size={.8} />)}</g>
    <g className="ws-hoe" style={{ transformOrigin: '185px 107px' }}><path stroke="#755b3f" strokeWidth="8" strokeLinecap="round" d="m155 80 81 97" /><path stroke="#c5a77a" strokeWidth="4" strokeLinecap="round" d="m155 80 81 97" /><path fill="#9baca2" stroke="#4b6254" strokeWidth="2.5" d="m233 169 17 3 11 15-35 8-3-12Z" /></g>
    <g className="ws-can" style={{ transformOrigin: '261px 109px' }}><path fill="none" stroke="#5f8072" strokeWidth="7" d="M344 83q37 7 17 32h-16" /><path fill="#769886" stroke="#3d6058" strokeWidth="2.5" d="M299 76h47v48q-23 9-47 0Zm0 29-30-8-6 9 37 18" /><ellipse cx="322" cy="76" rx="24" ry="5" fill="#9db29a" /><path fill="none" stroke="#c0c8a7" strokeWidth="2" d="M308 86v32" /><path stroke="#3d6058" strokeWidth="3" d="m264 93-5 17" /></g>
    <g className="ws-pour" fill="none" stroke="#a6c4ba" strokeWidth="2.5" strokeDasharray="3 7" strokeLinecap="round"><path d="m261 109-12 35m12-35-31 29m31-29-49 22" /></g>
    <g className="ws-harvest"><Crop x={374} y={179} size={.75} /><Crop x={389} y={179} size={.65} /><Crop x={405} y={181} size={.8} /></g>
    <g stroke="#705c42" strokeWidth="2" fill="#b88d5c"><path d="m350 180 68 1-4 30h-60Z" /><path fill="#d0a775" d="M349 179h70v8h-70Z" /><path d="m354 200 61 1" /><path stroke="#e0bb87" d="m360 188 2 20m45-20-2 21" /></g>
    <g fill="#7b8958"><path d="m33 202 2-17 6 14 8-11-3 15Zm393 18 3-13 5 11 8-13-2 15Z" /></g>
  </>;
}

function Streetscape({ taxi = false }: { taxi?: boolean }) {
  return <>
    <path fill={taxi ? '#dcd3b9' : '#c9d6cf'} d="M0 0h480v232H0z" />
    <circle cx="371" cy="45" r="26" fill={taxi ? '#edc879' : '#e8e4c7'} />
    <g fill={taxi ? '#b7b8a9' : '#a3b9b0'}><path d="M0 75h51v79H0Zm58-32h61v111H58Zm70 43h42v68h-42Zm51-26h67v94h-67Zm77-24h35v118h-35Zm43 36h59v82h-59Zm70-27h52v109h-52Zm62 24h49v85h-49Z" /></g>
    <g fill={taxi ? '#7d938c' : '#688f82'} stroke="#516f66" strokeWidth="2"><path d="M17 81h84v84H17Zm102 26h74v58h-74Zm93-26h99v84h-99Z" /></g>
    <g fill="#cad3b9">{[29, 56, 83, 133, 164, 228, 258, 288].map((x, i) => <g key={x}><path d={`M${x} ${i > 2 && i < 5 ? 119 : 95}h10v16h-10Z`} /><path d={`M${x} 131h10v17h-10Z`} /></g>)}</g>
    <path fill="#b4baa6" d="M0 164h480v24H0z" /><path stroke="#e0ddc5" strokeWidth="4" d="M0 180h480" /><path fill="#566966" d="M0 186h480v46H0z" />
    <g className="ws-road" stroke="#cccbb3" strokeWidth="3" strokeDasharray="31 29"><path d="M-120 220h720" /></g>
    <g stroke="#526b61" strokeWidth="3" fill="none"><path d="M47 164V51q0-10 10-10h13" /><path fill="#eee1ac" d="M64 38h18v8H64Z" /></g>
  </>;
}
function Scooter() {
  return <g>
    <g fill="#344d48" stroke="#aec2ae" strokeWidth="3"><circle cx="101" cy="190" r="14" /><circle cx="179" cy="190" r="14" /></g>
    <g className="ws-wheel" style={{ transformOrigin: '101px 190px' }} stroke="#90a89b" strokeWidth="2"><path d="M101 181v18m-9-9h18" /></g><g className="ws-wheel" style={{ transformOrigin: '179px 190px' }} stroke="#90a89b" strokeWidth="2"><path d="M179 181v18m-9-9h18" /></g>
    <path fill="#c97753" stroke="#4e6255" strokeWidth="2.5" d="M87 180q3-30 30-24l20 25h19l3-35h14l12 39h-53l-10-11-6 6Z" />
    <path fill="#e1a273" d="M94 171q13-17 25-3l8 8h-12l-7-4Z" /><path fill="#344d48" d="M103 153h29q5 0 5 6h-37q-2-6 3-6" />
    <path fill="none" stroke="#3f5d52" strokeWidth="4" strokeLinecap="round" d="m167 147-4-24h-13" /><path fill="#e7d8a6" stroke="#4f6959" strokeWidth="2" d="m168 133 12 2v9l-10 1Z" />
    <g className="ws-cargo"><path fill="#ba915d" stroke="#5b624b" strokeWidth="2" d="M80 126h34v27H80Z" /><path fill="#d3b485" d="M80 126h34v7H80Z" /><path stroke="#ece0b5" strokeWidth="5" d="M97 127v25" /></g>
    <g className="ws-rider">
      <path fill="none" stroke="#3d5355" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" d="m135 147 17 10-7 18" /><path fill="#2e4545" d="m141 172 8 2 8 5q0 4-6 3l-14-3Z" />
      <path fill="#c97653" stroke="#53624f" strokeWidth="2" d="m134 116 12 4-3 17-5 14-17-3 5-24Z" /><path fill="none" stroke="#dd9470" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" d="m140 125 8 13 14-7" /><circle cx="163" cy="130" r="4" fill="#d7b68a" />
      <path fill="#dbb88c" d="m139 101 17 3-2 12-10 5-8-8Z" /><path fill="#eee0b9" stroke="#526257" strokeWidth="2" d="M132 108q-6-20 10-22 16-1 18 16l-15-1-7 10Z" /><path stroke="#c77851" strokeWidth="4" d="m140 87 4 13" /><path stroke="#334c47" strokeWidth="2" d="m154 105 3 1m-17 2 7 9" />
    </g>
  </g>;
}
function DeliveryWalker() {
  return <g transform="translate(249 180)"><g className="ws-walker">
    <g className="ws-walk-leg ws-walk-leg--back" style={{ transformOrigin: '0px -31px' }}><path stroke="#344d50" strokeWidth="9" strokeLinecap="round" d="M0-32 4-17 1-4" /><path fill="#2d4341" d="m-3-7 8 1 5 6H-5Z" /></g>
    <g className="ws-walk-leg ws-walk-leg--front" style={{ transformOrigin: '0px -31px' }}><path stroke="#4e6763" strokeWidth="9" strokeLinecap="round" d="M0-32-5-17-2-4" /><path fill="#2d4341" d="m-5-7 8 1 7 6H-7Z" /></g>
    <g className="ws-walker-body"><path fill="#c97653" stroke="#53624f" strokeWidth="2" d="m-6-62 14 2 5 32-23 1-2-23Z" />
      <path fill="#dbb88c" d="m-2-75 15 2-1 12-10 4-7-9Z" /><path fill="#eee0b9" stroke="#526257" strokeWidth="2" d="M-10-68q-6-19 10-22 16-1 18 16l-15-1-6 10Z" /><path stroke="#c77851" strokeWidth="4" d="m-2-89 4 13" /><path stroke="#334c47" strokeWidth="2" d="m11-70 3 1" />
      <path fill="#c59864" stroke="#5a624b" strokeWidth="2" d="M16-45h28v25H16Z" /><path fill="#d8b98b" d="M16-45h28v6H16Z" /><path stroke="#eee0b3" strokeWidth="5" d="M30-44v23" />
      <path fill="none" stroke="#dd9470" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" d="M3-52 8-32 21-29" /><circle cx="22" cy="-29" r="4" fill="#d7b68a" />
    </g>
  </g></g>;
}
function Courier() {
  return <>
    <Streetscape />
    <g stroke="#596b5d" strokeWidth="2"><path fill="#bdac88" d="M342 71h94v104h-94Z" /><path fill="#d4c6a2" d="M336 65h106v12H336Z" /><path fill="#45675c" d="M367 112h43v63h-43Z" /><path fill="#a0b5a0" d="M373 119h31v25h-31Z" /><path stroke="#d5c8a1" strokeWidth="3" d="M399 151v7" /><path fill="#818e77" d="M357 173h63v7h-63Z" /></g>
    <g className="ws-door-light" fill="#e6ca7f"><path d="M368 88h41v14h-41Z" /><circle cx="421" cy="114" r="3" /></g>
    <g className="ws-route-pin"><path fill="#efdbc1" stroke="#a16447" strokeWidth="2" d="M390 49c-18-13-24-23-17-32 8-12 26-12 34 0 7 9 1 19-17 32Z" /><circle cx="390" cy="22" r="6" fill="#be7951" /></g>
    <g className="ws-scooter"><Scooter /></g>
    <DeliveryWalker />
    <g className="ws-delivered" fill="none" stroke="#e9f0d5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="390" cy="24" r="17" fill="#507b64" stroke="none" /><path d="m382 24 5 5 10-11" /></g>
  </>;
}
function Taxi() {
  return <>
    <Streetscape taxi />
    <g stroke="#5e7468" strokeWidth="3"><path d="M421 105v70" /><rect x="407" y="84" width="29" height="26" rx="3" fill="#d8c79e" /><path stroke="#697c67" d="M414 92h15m-15 7h15" /></g>
    <g className="ws-pickup" fill="none" stroke="#6d8d79" strokeWidth="2"><circle cx="139" cy="128" r="14" /><circle cx="139" cy="128" r="5" fill="#74927b" /></g>
    <g className="ws-taxi-car">
      <ellipse cx="147" cy="205" rx="86" ry="4" fill="#3b5350" opacity=".45" />
      <g className="ws-car-body"><path fill="#d3ad55" stroke="#394f48" strokeWidth="3" strokeLinejoin="round" d="m66 178 18-8 21-29q4-5 14-5h44q10 0 19 9l22 24 24 7 4 21H65Z" /><path fill="#e7c672" d="m73 177 32-4h96l24 6-1 7H73Z" /><path fill="#577e7a" stroke="#394f48" strokeWidth="2.5" d="m113 143-18 26h41v-26Zm32 0v26h48l-19-20q-6-6-13-6Z" /><path stroke="#b7c5b1" strokeWidth="2" d="m119 147-12 16m52-16 18 17" /><path stroke="#987e45" strokeWidth="2" d="M141 175v19m-42-18-6 16" /><path stroke="#394f48" strokeWidth="3" strokeLinecap="round" d="M149 179h7" /><path fill="#f3ddb0" d="m221 178 8 3 1 6h-11Z" /><path fill="#ae644d" d="M67 179h7v9h-8Z" /><path fill="#e7d39a" stroke="#4e6152" strokeWidth="2" d="m130 126 22 0 5 10h-31Z" /><path fill="#42594e" d="M132 129h5v4h-5Zm8 0h5v4h-5Zm8 0h4l2 4h-6Z" /><g fill="#5a634e">{[108, 118, 128, 138, 148, 158, 168, 178].map((x, i) => <rect key={x} x={x} y={185 + i % 2 * 4} width="5" height="4" />)}</g></g>
      {[96, 199].map(x => <g key={x}><circle cx={x} cy="195" r="15" fill="#2d4542" stroke="#c9c9ac" strokeWidth="3" /><g className="ws-wheel" style={{ transformOrigin: `${x}px 195px` }} stroke="#a0b1a0" strokeWidth="2"><path d={`M${x} 186v18m-9-9h18`} /><circle cx={x} cy="195" r="4" fill="#b5c2ac" /></g></g>)}
    </g>
    <g className="ws-taxi-finish" fill="none" stroke="#f0e7c7" strokeWidth="2.5"><circle cx="422" cy="60" r="15" fill="#688775" stroke="none" /><path strokeLinecap="round" strokeLinejoin="round" d="m415 60 5 5 9-10" /></g>
  </>;
}

const ART = { miner: <Mine />, lumberjack: <Forest />, fisherman: <Lake />, farmer: <Farm />, courier: <Courier />, taxi: <Taxi /> };

function playAction(root: HTMLDivElement, profession: Profession, step: number): Animation[] {
  const animations: Animation[] = [];
  const move = (selector: string, frames: Keyframe[], duration = 850, delay = 0) => {
    root.querySelectorAll<SVGElement>(selector).forEach(element => animations.push(element.animate(frames, {
      duration, delay, easing: 'cubic-bezier(.22,.65,.3,1)', fill: 'none',
    })));
  };
  const hit = (selector: string, start = 0, contact = 20) => move(selector, [
    { transform: `rotate(${start}deg)`, offset: 0 }, { transform: 'rotate(-38deg)', offset: .35 },
    { transform: `rotate(${contact}deg)`, offset: .53 }, { transform: 'rotate(8deg)', offset: .64 },
    { transform: 'rotate(0deg)', offset: 1 },
  ], 760);
  const chips = () => move('.ws-chips', [
    { opacity: 0, transform: 'translate(0, 0)' }, { opacity: 1, transform: 'translate(0, -4px)', offset: .15 },
    { opacity: 0, transform: 'translate(-18px, 20px)' },
  ], 490, 390);
  if (profession === 'miner') {
    hit('.ws-pick'); chips();
    move('.ws-rock', [{ transform: 'translateX(0)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], 230, 395);
    move('.ws-cart', [{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], 340, 560);
  } else if (profession === 'lumberjack') {
    if (step === 1) move('.ws-axe', [{ transform: 'rotate(0)' }, { transform: 'rotate(-35deg)' }], 600);
    else { hit('.ws-axe', step === 2 ? -35 : 0, 36); chips(); }
  } else if (profession === 'fisherman') {
    if (step < 3) move('.ws-rod', [{ transform: 'rotate(0)' }, { transform: `rotate(${step === 1 ? -28 : -1}deg)`, offset: .35 }, { transform: `rotate(${step === 1 ? 4 : .5}deg)`, offset: .68 }, { transform: 'rotate(0)' }], 850);
    if (step > 1) move('.ws-splash', [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: 'translateY(-14px)' }], 500);
    if (step === 3) {
      move('.ws-catch', [{ opacity: 0, transform: 'translateY(55px)' }, { opacity: 1, transform: 'translateY(-12px)', offset: .6 }, { opacity: 1, transform: 'translateY(0)' }], 1000);
      move('.ws-catch-line', [{ transform: 'scaleY(1.98)' }, { transform: 'scaleY(.79)', offset: .6 }, { transform: 'scaleY(1)' }], 1000);
    }
  } else if (profession === 'farmer') {
    if (step === 1) move('.ws-hoe', [{ opacity: 1, transform: 'translate(0, -14px) rotate(-12deg)' }, { opacity: 1, transform: 'translate(0, 0) rotate(4deg)', offset: .35 }, { opacity: 1, transform: 'translate(-40px, 6px) rotate(0deg)', offset: .8 }, { transform: 'translate(-44px, -10px)', opacity: 0 }], 1000);
    if (step === 2) move('.ws-can', [{ transform: 'rotate(0)' }, { transform: 'rotate(-23deg)', offset: .3 }, { transform: 'rotate(-23deg)', offset: .75 }, { transform: 'rotate(0)' }], 1250);
    if (step === 3) move('.ws-harvest', [{ opacity: 0, transform: 'translate(-170px, 10px)' }, { opacity: 1, transform: 'translate(-110px, -40px)', offset: .35 }, { opacity: 1, transform: 'translate(0, 0)' }], 1000);
  } else if (profession === 'courier') {
    if (step === 2) move('.ws-wheel', [{ transform: 'rotate(0)' }, { transform: 'rotate(540deg)' }], 1100);
    if (step === 3) move('.ws-walker', [{ transform: 'translate(0, -6px)' }, { transform: 'translate(0, 0)', offset: .1 }, { transform: 'translate(116px, 0)' }], 1400);
  } else if (profession === 'taxi') {
    if (step > 1) move('.ws-wheel', [{ transform: 'rotate(0)' }, { transform: `rotate(${step === 2 ? 720 : 220}deg)` }], step === 2 ? 1200 : 700);
    if (step === 3) move('.ws-car-body', [{ transform: 'rotate(0)' }, { transform: 'rotate(1deg)', offset: .65 }, { transform: 'rotate(0)' }], 800);
  }
  return animations;
}

export const ProfessionScene = memo(function ProfessionScene({ profession, stage, cycleId, onBusyChange }: SceneProps) {
  const kind: Profession = Object.hasOwn(LABELS, profession) ? profession as Profession : 'miner';
  const step = Math.max(0, Math.min(3, Number.isFinite(stage) ? Math.floor(stage) : 0));
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef<{ step: number; cycleId: string | null; visual: number } | null>(null);
  const animations = useRef<Animation[]>([]);
  const playbackVersion = useRef(0);
  const playbackDone = useRef<Promise<void>>(Promise.resolve());

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prior = previous.current;
    const completed = cycleId === null && prior?.cycleId != null && prior.step > 0;
    const visual = completed ? 3 : step;
    // App auto-collects the last step. Preserve its ending while the card
    // waits for the actual finite animations, without delaying the reward.
    root.dataset.stage = String(visual);
    root.dataset.active = String(cycleId !== null || completed);
    if (prior && visual !== prior.visual) {
      const version = ++playbackVersion.current;
      animations.current.forEach(animation => animation.cancel());
      animations.current = [];
      playbackDone.current = Promise.resolve();
      if (visual > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        playAction(root, kind, visual);
        // Include CSS transitions (falling tree, travel, crops) as well as
        // scripted actions. Ambient loops must never keep the button locked.
        animations.current = root.getAnimations({ subtree: true }).filter(animation =>
          Number.isFinite(Number(animation.effect?.getComputedTiming().endTime ?? Infinity))
          && animation.playState !== 'finished' && animation.playState !== 'idle');
        if (root.dataset.paused === 'true') animations.current.forEach(animation => animation.pause());
        onBusyChange?.(animations.current.length > 0);
        playbackDone.current = Promise.allSettled(animations.current.map(animation => animation.finished)).then(() => {
          if (version === playbackVersion.current) onBusyChange?.(false);
        });
      } else {
        onBusyChange?.(false);
      }
    }
    previous.current = { step, cycleId, visual };
    let cancelled = false;
    const timer = completed ? window.setTimeout(() => {
      void playbackDone.current.then(() => {
        if (cancelled) return;
        root.dataset.stage = '0';
        root.dataset.active = 'false';
        if (previous.current) previous.current.visual = 0;
      });
    }, 2000) : undefined;
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [kind, step, cycleId, onBusyChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let visible = true;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const paused = !visible || document.hidden || motion.matches;
      root.dataset.paused = String(paused);
      if (motion.matches) {
        // A newly enabled reduced-motion preference can cancel the active
        // finite animations. Release the card lock at the same time.
        playbackVersion.current++;
        animations.current.forEach(animation => animation.cancel());
        animations.current = [];
        playbackDone.current = Promise.resolve();
        onBusyChange?.(false);
      }
      else animations.current.forEach(animation => {
        if (paused && animation.playState === 'running') animation.pause();
        if (!paused && animation.playState === 'paused') animation.play();
      });
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(root);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      animations.current.forEach(animation => animation.cancel());
      onBusyChange?.(false);
    };
  }, [onBusyChange]);

  return <div ref={rootRef} className={`work-scene work-scene--${kind}`} role="img" aria-label={`${LABELS[kind]}. ${cycleId ? `Выполнено этапов: ${step} из 3` : 'Новая смена'}`}>
    <div className="work-scene__heading" aria-hidden="true"><span>{LABELS[kind]}</span><span className="work-scene__status"><i />{cycleId ? 'На смене' : 'Готов к работе'}</span></div>
    <svg className="work-scene__art" viewBox="0 0 480 232" fill="none" aria-hidden="true" focusable="false">{ART[kind]}</svg>
    <div className="work-scene__footer" aria-hidden="true"><span className="work-scene__footer-id">{String(Object.keys(LABELS).indexOf(kind) + 1).padStart(2, '0')} / ПРОФЕССИЯ</span><div className="work-scene__steps"><i /><i /><i /></div></div>
  </div>;
});
