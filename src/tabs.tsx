import { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Coins, UserPlus, Briefcase, Coffee, Users, Smartphone, Phone, Car, Building, Store, Hammer, ChevronRight, Gift, Wrench, Search, ShieldAlert, Ban, Trash2, ArrowLeft, X, Backpack, Bug, AlertTriangle, Wallet, ScrollText, RefreshCw, Trophy, Palette, Settings, Volume2, VolumeX, Vibrate, Pickaxe, TreePine, Fish, Sprout, PackageCheck, CarFront, Crown, Ticket, LockKeyhole, Check, Medal, Sparkles } from 'lucide-react';
import { 
  getAvatar, BUILDING_PRICE,
  TAXI_REPAIR_LADA, TAXI_REPAIR_TOYOTA, DAILY_REWARDS, S, getDayModifier,
  BUTTON_BATCH_COST, SMARTPHONE_BATCH_COST, BUTTON_BATCH_SIZE, SMARTPHONE_BATCH_SIZE,
  DEFAULT_SELL_LADA, DEFAULT_SELL_TOYOTA, DEFAULT_SELL_APARTMENT, DEFAULT_SELL_PHONE,
  DEFAULT_SELL_BUTTON, DEFAULT_SELL_SMARTPHONE, BIZ_JOBS, BUSINESS_PASSIVE_TIERS, getStock,
  PLAYER_PROFESSIONS, PROFESSION_LOOT, PROFESSION_RARITIES
} from './constants';
import { Btn, Modal } from './components';
import { AnimatedNumber } from './AnimatedNumber';
import { ItemArtwork } from './ItemArtwork';
import { ProfessionScene } from './ProfessionScene';
import { getProfileBackground, PROFILE_BACKGROUND_NAMES } from './profileBackgrounds';
import { DISTRICTS, districtForLocation, RETIRED_LOCATION_KEYS } from './districts';

const coffeeBonusMinutes = (productId: string) => productId === 'coffee_small' ? 5 : productId === 'coffee_medium' ? 7 : 9;
const bulkRestockDiscountPercent = (quantity: number) => quantity >= 500 ? 5 : quantity >= 250 ? 4 : quantity >= 100 ? 2 : 0;

const CarPlate = ({ plate, compact = false }: { plate: string; compact?: boolean }) => {
  const match = String(plate || '').toUpperCase().match(/^([\u0410-\u042fA-Z])(\d{3})([\u0410-\u042fA-Z]{2})\s*(\d{2,3})$/);
  if (!match) return <div className={'ru-license-plate' + (compact ? ' is-compact' : '')}>{plate}</div>;
  const latinMap: Record<string, string> = { '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041a': 'K', '\u041c': 'M', '\u041d': 'H', '\u041e': 'O', '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0423': 'Y', '\u0425': 'X' };
  const latin = (value: string) => [...value].map(letter => latinMap[letter] || letter).join('');
  const glyphPaths: Record<string, string[]> = {
    A: ['M5.5 70.5 L22 5.5 L38.5 70.5', 'M12 48 H32'], B: ['M7 5.5 V70.5', 'M7 5.5 H24 Q38 5.5 38 21.5 Q38 37.5 24 37.5 H7', 'M22 37.5 Q39 37.5 39 54 Q39 70.5 23 70.5 H7'],
    C: ['M38 11 H18 Q7 11 7 22 V54 Q7 70 19 70 H38'], E: ['M38 5.5 H7 V70.5 H38', 'M8 38 H31'], H: ['M7 5.5 V70.5', 'M38 5.5 V70.5', 'M7 38 H38'],
    K: ['M7 5.5 V70.5', 'M38 5.5 L12 37.5 L39 70.5'], M: ['M6 70.5 V5.5 L22 37.5 L38 5.5 V70.5'], O: ['M18 5.5 H28 Q38 5.5 38 16 V60 Q38 70.5 28 70.5 H18 Q7 70.5 7 60 V16 Q7 5.5 18 5.5 Z'],
    P: ['M7 70.5 V5.5 H24 Q38 5.5 38 21 V25 Q38 38 24 38 H7'], R: ['M7 70.5 V5.5 H24 Q38 5.5 38 21 V25 Q38 38 24 38 H7', 'M22 38 L39 70.5'],
    S: ['M38 9 H18 Q7 9 7 20 V28 Q7 38 18 38 H28 Q39 38 39 49 V59 Q39 70.5 28 70.5 H7'], T: ['M5.5 5.5 H39', 'M22 5.5 V70.5'], X: ['M7 5.5 L38 70.5', 'M38 5.5 L7 70.5'], Y: ['M7 5.5 L22.5 37.5 L38 5.5', 'M22.5 37.5 V70.5'],
    '0': ['M18 5.5 H28 Q38 5.5 38 16 V60 Q38 70.5 28 70.5 H18 Q7 70.5 7 60 V16 Q7 5.5 18 5.5 Z'], '1': ['M10 16 L22 5.5 V70.5', 'M9 70.5 H37'], '2': ['M7 19 Q7 5.5 19 5.5 H27 Q38 5.5 38 17 V28 L7 59 V70.5 H39'],
    '3': ['M7 5.5 H27 Q38 5.5 38 17 V28 Q38 35 29 38 Q39 41 39 50 V59 Q39 70.5 27 70.5 H7'], '4': ['M30 70.5 V5.5', 'M7 44 H39', 'M7 44 L30 5.5'], '5': ['M38 5.5 H9 V35 H27 Q39 35 39 47 V59 Q39 70.5 27 70.5 H7'],
    '6': ['M37 7 H19 Q7 7 7 19 V58 Q7 70.5 19 70.5 H27 Q39 70.5 39 59 V49 Q39 39 27 39 H7'], '7': ['M7 9 H39 L15 70.5'], '8': ['M19 37.5 C11 37.5 7 31 7 21.5 C7 11 11.5 5.5 22.5 5.5 C33 5.5 38 11 38 21.5 C38 31 33 37.5 25 37.5 C16 37.5 7 42 7 54 C7 65 12 70.5 22.5 70.5 C33 70.5 39 65 39 54 C39 42 30 37.5 19 37.5'],
    '9': ['M39 38 H18 Q7 38 7 27 V17 Q7 5.5 19 5.5 H27 Q39 5.5 39 17 V58 Q39 70.5 27 70.5 H10'], U: ['M7 5.5 V59 Q7 70.5 19 70.5 H27 Q39 70.5 39 59 V5.5'],
  };
  const glyph = (char: string, x: number, y: number, scale = 1, strokeWidth = 11) => (
    <g key={char + '-' + x + '-' + y} transform={'translate(' + x + ' ' + y + ') scale(' + scale + ')'} fill="none" stroke="#101010" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(glyphPaths[char] || []).map((path, index) => <path key={index} d={path} />)}
    </g>
  );
  const [firstLetter, digits, lastLetters, region] = [latin(match[1]), match[2], latin(match[3]), match[4]];
  const mainGlyphs = [glyph(firstLetter, 18, 18), ...digits.split('').map((char, index) => glyph(char, 82 + index * 48, 18)), ...lastLetters.split('').map((char, index) => glyph(char, 248 + index * 52, 18))];
  const regionScale = 58 / 77;
  const regionStep = 37;
  const regionStart = 394 + (126 - (region.length * regionStep - 3)) / 2;
  const regionGlyphs = region.split('').map((char, index) => glyph(char, regionStart + index * regionStep, 8, regionScale, 12));
  const rusGlyphs = ['R', 'U', 'S'].map((char, index) => glyph(char, 424 + index * 14, 80, 20 / 76, 11.5));
  return <svg className={'ru-license-plate' + (compact ? ' is-compact' : '')} viewBox="0 0 520 112" role="img" aria-label={'Vehicle plate ' + match[1] + ' ' + digits + ' ' + match[3] + ', region ' + region}>
    <rect x="1.75" y="1.75" width="516.5" height="108.5" rx="5" fill="#fff" stroke="#111" strokeWidth="3.5" />
    {mainGlyphs}
    <path d="M394 3.5 V108.5" stroke="#111" strokeWidth="3" />
    {regionGlyphs}
    {rusGlyphs}
    <path d="M466 82 H490 V98 H466 Z" fill="#fff" /><path d="M466 87.333 H490 V92.666 H466 Z" fill="#244b9b" /><path d="M466 92.666 H490 V98 H466 Z" fill="#d52b32" />
  </svg>;
};

const phoneNumberMultipliers = (value: string) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) digits = digits.slice(1);
  const prefix = digits.slice(0, 3);
  const tail = digits.slice(3);
  let prefixMultiplier = 1;
  let prefixReason = 'обычный префикс';
  if (prefix.length === 3 && /^([0-9])\1{2}$/.test(prefix)) { prefixMultiplier = 3; prefixReason = `три одинаковые цифры ${prefix}`; }
  else if (prefix.length === 3 && prefix === [...prefix].reverse().join('')) { prefixMultiplier = 2; prefixReason = `зеркальный префикс ${prefix}`; }
  else if (prefix[0] === prefix[1] || prefix[1] === prefix[2]) { prefixMultiplier = 1.5; prefixReason = `пара цифр в ${prefix}`; }

  const counts = new Map<string, number>();
  let run = 1; let maxRun = 1;
  for (let i = 0; i < tail.length; i += 1) {
    counts.set(tail[i], (counts.get(tail[i]) || 0) + 1);
    if (i > 0) { run = tail[i] === tail[i - 1] ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  }
  const maxRepeat = Math.max(0, ...counts.values());
  const pairCount = [...counts.values()].filter(count => count === 2).length;
  let bodyMultiplier = 1;
  let bodyReason = 'обычная комбинация';
  const offer = (multiplier: number, reason: string) => { if (multiplier > bodyMultiplier) { bodyMultiplier = multiplier; bodyReason = reason; } };
  if (maxRepeat === 7) offer(32, 'все семь цифр одинаковые');
  else if (maxRepeat === 6) offer(16, 'шесть одинаковых цифр');
  else if (maxRepeat === 5) offer(8, 'пять одинаковых цифр');
  else if (maxRepeat === 4) offer(4, 'четыре одинаковые цифры');
  else if (maxRepeat === 3) offer(2.5, 'три одинаковые цифры');
  else if (pairCount >= 2) offer(1.5, 'две пары цифр');
  else if (maxRepeat === 2) offer(1.2, 'одна пара цифр');
  if (maxRun >= 7) offer(10, 'семь одинаковых подряд');
  else if (maxRun >= 6) offer(6, 'шесть одинаковых подряд');
  else if (maxRun >= 5) offer(3, 'пять одинаковых подряд');
  else if (maxRun >= 4) offer(2, 'четыре одинаковых подряд');
  if (tail.length === 7 && tail === [...tail].reverse().join('')) offer(8, 'палиндром из семи цифр');
  if (tail.length === 7 && tail[0] === tail[2] && tail[0] === tail[4] && tail[0] === tail[6] && tail[1] === tail[3] && tail[1] === tail[5]) offer(7, 'чередующийся рисунок цифр');
  const lastFour = tail.slice(-4);
  if (lastFour === '7777') offer(10, 'последние четыре цифры — 7777');
  else if (['0000', '8888', '9999'].includes(lastFour)) offer(8, `последние четыре цифры — ${lastFour}`);
  else if (['1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321'].includes(lastFour)) offer(5, `последние цифры идут подряд: ${lastFour}`);
  else if (['1212','3434','5656','7878','9090'].includes(lastFour)) offer(4, `повторяющаяся пара ${lastFour}`);
  return { prefixMultiplier, prefixReason, bodyMultiplier, bodyReason, totalMultiplier: prefixMultiplier * bodyMultiplier };
};

const CAR_PLATE_RECOGNIZED_SERIES: Record<string, { multiplier: number; reason: string }> = {
  'ААА': { multiplier: 8, reason: 'знаковая серия ААА' },
  'АМР': { multiplier: 7, reason: 'легендарная серия АМР' },
  'ЕКХ': { multiplier: 7, reason: 'легендарная серия ЕКХ' },
  'АУЕ': { multiplier: 7, reason: 'редкая буквенная комбинация АУЕ' },
  'ХКХ': { multiplier: 6, reason: 'узнаваемая серия ХКХ' },
  'ВОР': { multiplier: 5, reason: 'читаемое слово ВОР' },
  'ХАМ': { multiplier: 5, reason: 'читаемое слово ХАМ' },
  'АМО': { multiplier: 4, reason: 'узнаваемая серия АМО' },
  'АММ': { multiplier: 4, reason: 'узнаваемая серия АММ' },
  'АОО': { multiplier: 4, reason: 'узнаваемая серия АОО' },
  'АРМ': { multiplier: 4, reason: 'узнаваемая серия АРМ' },
  'АТК': { multiplier: 4, reason: 'узнаваемая серия АТК' },
  'ВКР': { multiplier: 4, reason: 'узнаваемая серия ВКР' },
  'ВМР': { multiplier: 4, reason: 'узнаваемая серия ВМР' },
  'ВОО': { multiplier: 4, reason: 'узнаваемая серия ВОО' },
  'ЕКР': { multiplier: 4, reason: 'узнаваемая серия ЕКР' },
  'ЕОО': { multiplier: 4, reason: 'узнаваемая серия ЕОО' },
  'ЕРЕ': { multiplier: 4, reason: 'узнаваемая серия ЕРЕ' },
  'ККХ': { multiplier: 4, reason: 'узнаваемая серия ККХ' },
  'КММ': { multiplier: 4, reason: 'узнаваемая серия КММ' },
  'КМР': { multiplier: 4, reason: 'узнаваемая серия КМР' },
  'КОО': { multiplier: 4, reason: 'узнаваемая серия КОО' },
  'ММР': { multiplier: 4, reason: 'узнаваемая серия ММР' },
  'МОО': { multiplier: 4, reason: 'узнаваемая серия МОО' },
  'ОКО': { multiplier: 4, reason: 'узнаваемая серия ОКО' },
  'ООА': { multiplier: 4, reason: 'узнаваемая серия ООА' },
  'ООН': { multiplier: 4, reason: 'узнаваемая серия ООН' },
  'ООС': { multiplier: 4, reason: 'узнаваемая серия ООС' },
  'ОРР': { multiplier: 4, reason: 'узнаваемая серия ОРР' },
  'ОСК': { multiplier: 4, reason: 'узнаваемая серия ОСК' },
  'ОСМ': { multiplier: 4, reason: 'узнаваемая серия ОСМ' },
  'ОТТ': { multiplier: 4, reason: 'узнаваемая серия ОТТ' },
  'САС': { multiplier: 4, reason: 'узнаваемая серия САС' },
  'СКР': { multiplier: 4, reason: 'узнаваемая серия СКР' },
  'СОО': { multiplier: 4, reason: 'узнаваемая серия СОО' },
  'ССС': { multiplier: 8, reason: 'три одинаковые буквы ССС' },
  'ООО': { multiplier: 8, reason: 'знаковая серия ООО' },
};

const carPlateMultipliers = (plate: string) => {
  const match = String(plate || '').toUpperCase().match(/^([А-Я])(\d{3})([А-Я]{2})\s*(\d{2,3})$/);
  if (!match) return { digitMultiplier: 1, digitReason: 'обычная комбинация', letterMultiplier: 1, letterReason: 'обычные буквы', regionMultiplier: 1, regionReason: 'обычный регион', totalMultiplier: 1 };
  const [, firstLetter, digits, lastLetters, region] = match;
  const letters = firstLetter + lastLetters;
  let digitMultiplier = 1; let digitReason = 'обычные цифры';
  if (digits === '777') { digitMultiplier = 12; digitReason = '777 — особая комбинация'; }
  else if (['001','888'].includes(digits)) { digitMultiplier = 8; digitReason = `${digits} — редкая комбинация`; }
  else if (digits === '999') { digitMultiplier = 7; digitReason = '999 — три девятки'; }
  else if (digits === '555') { digitMultiplier = 6; digitReason = '555 — три пятёрки'; }
  else if (digits === '007') { digitMultiplier = 5; digitReason = '007 — особая комбинация'; }
  else if (/^(\d)\1{2}$/.test(digits)) { digitMultiplier = 4; digitReason = `${digits} — три одинаковые цифры`; }
  else if (/^[1-9]00$/.test(digits)) { digitMultiplier = 2.5; digitReason = `${digits} — круглая комбинация`; }
  else if (digits[0] === digits[1] || digits[1] === digits[2]) { digitMultiplier = 1.5; digitReason = 'пара одинаковых цифр'; }
  else if (['123','321'].includes(digits)) { digitMultiplier = 2; digitReason = 'цифры идут по порядку'; }
  let letterMultiplier = 1; let letterReason = 'обычные буквы';
  const letterOrder = 'АВЕКМНОРСТУХ';
  const letterIndexes = [...letters].map(letter => letterOrder.indexOf(letter));
  const recognizedSeries = CAR_PLATE_RECOGNIZED_SERIES[letters];
  if (recognizedSeries) { letterMultiplier = recognizedSeries.multiplier; letterReason = recognizedSeries.reason; }
  else if (letters[0] === letters[1] && letters[1] === letters[2]) { letterMultiplier = 8; letterReason = 'три одинаковые буквы'; }
  else if (letters[0] === letters[1] || letters[1] === letters[2] || letters[0] === letters[2]) { letterMultiplier = 2.5; letterReason = 'пара одинаковых букв'; }
  else if (letterIndexes.every((value, index) => value >= 0 && (index === 0 || value === letterIndexes[index - 1] + 1)) || letterIndexes.every((value, index) => value >= 0 && (index === 0 || value === letterIndexes[index - 1] - 1))) { letterMultiplier = 3; letterReason = 'буквы идут подряд'; }
  if (['А','М','О'].includes(firstLetter)) { letterMultiplier *= 1.2; letterReason += ` · ${firstLetter} похожа на латинскую`; }
  const regionMultiplier = ['77','99','777'].includes(region) ? 2 : 1;
  const regionReason = regionMultiplier > 1 ? `регион ${region}` : `регион ${region}`;
  return { digitMultiplier, digitReason, letterMultiplier, letterReason, regionMultiplier, regionReason, totalMultiplier: digitMultiplier * letterMultiplier * regionMultiplier };
};

const CarNumberCollection = ({ app }: { app: any }) => {
  const numbers = app.numberCollection?.car_numbers || [];
  const [listingNumber, setListingNumber] = useState<any>(null);
  const [listingPrice, setListingPrice] = useState('');
  const openListing = (number: any) => { setListingNumber(number); setListingPrice(String(Math.max(1, Number(number.estimated_value) || 1))); };
  const closeListing = () => setListingNumber(null);
  const submitListing = () => {
    const price = Number(listingPrice);
    if (!listingNumber || !Number.isSafeInteger(price) || price < 1 || price > 100000000) return;
    const number = listingNumber;
    closeListing();
    app.listNumberMarketLot('car_number', number.id, price);
  };
  if (!numbers.length) return <div className="gibdd-empty">{'\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0430\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0445 \u043d\u043e\u043c\u0435\u0440\u043e\u0432. \u041a\u0440\u0443\u0442\u0438 \u043d\u043e\u043c\u0435\u0440 \u0438 \u0440\u0435\u0448\u0430\u0439, \u0447\u0442\u043e \u0441 \u043d\u0438\u043c \u0434\u0435\u043b\u0430\u0442\u044c.'}</div>;
  return <>
    <div className="gibdd-number-list">{numbers.map((number: any) => <article className="gibdd-number-row" key={number.id}>
      <div className="gibdd-number-plate"><CarPlate plate={number.plate} compact /><small>{number.is_active ? '\u0421\u0435\u0439\u0447\u0430\u0441 \u0441\u0442\u043e\u0438\u0442 \u043d\u0430 \u043c\u0430\u0448\u0438\u043d\u0435' : '\u0413\u043e\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u043e \u043e\u0446\u0435\u043d\u0438\u043b\u043e \u0432'} {number.is_active ? '' : Number(number.estimated_value).toLocaleString('ru-RU') + ' \u20bd'}</small></div>
      <div className="gibdd-number-actions">{!number.is_active && <button type="button" disabled={app.proc} onClick={() => openListing(number)}>{'\u041d\u0430 \u0440\u044b\u043d\u043e\u043a'}</button>}{app.hasCar && !number.is_active && <button type="button" disabled={app.proc} onClick={() => app.activateCarNumber(number.id)}>{'\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c'}</button>}<button type="button" className="is-sell" disabled={app.proc || number.is_active} onClick={() => app.sellCarNumber(number.id)}>{number.is_active ? '\u041d\u0430 \u043c\u0430\u0448\u0438\u043d\u0435' : '\u041f\u0440\u043e\u0434\u0430\u0442\u044c'}</button></div>
    </article>)}</div>
    <Modal open={!!listingNumber} onClose={closeListing} contentStyle={{ maxWidth: 360 }}>
      {listingNumber && <div style={{ display: 'grid', gap: 12, textAlign: 'left' }}><h3 style={{ margin: 0 }}>{'\u0412\u044b\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0440\u044b\u043d\u043e\u043a'}</h3><CarPlate plate={listingNumber.plate} /><small>{'\u041e\u0446\u0435\u043d\u043a\u0430 \u0433\u043e\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0430'} {'\u00b7'} {Number(listingNumber.estimated_value).toLocaleString('ru-RU')} {'\u20bd'}</small><label htmlFor="car-number-market-price">{'\u0426\u0435\u043d\u0430 \u043f\u0440\u043e\u0434\u0430\u0436\u0438'}, {'\u20bd'}</label><input id="car-number-market-price" type="number" min={1} max={100000000} step={1} value={listingPrice} onChange={event => setListingPrice(event.target.value)} style={S.input} /><div style={{ display: 'flex', gap: 8 }}><Btn variant="secondary" onClick={closeListing}>{'\u041e\u0442\u043c\u0435\u043d\u0430'}</Btn><Btn variant="primary" disabled={app.proc || !Number.isSafeInteger(Number(listingPrice)) || Number(listingPrice) < 1 || Number(listingPrice) > 100000000} onClick={submitListing}>{'\u0412\u044b\u0441\u0442\u0430\u0432\u0438\u0442\u044c'}</Btn></div></div>}
    </Modal>
  </>;
};

const SLOT_ROW_HEIGHT = 34;
const NumberSpinMachine = ({ isCar, targetValue, stopping, onSettled }: { isCar: boolean; targetValue: string | null; stopping: boolean; onSettled: () => void }) => {
  const target = targetValue || (isCar ? 'А000АА 77' : '+7 900 000-00-00');
  const reels = useMemo(() => Array.from(target).map((char, index) => {
    if (!/[0-9А-Я]/i.test(char)) return { char, index, symbols: null as string[] | null, targetIndex: -1 };
    const alphabet = /\d/.test(char) ? '0123456789' : 'АВЕКМНОРСТУХ';
    const cycle = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
    cycle[9] = char;
    return { char, index, symbols: [...cycle, ...cycle], targetIndex: 9 };
  }), [target]);
  const trackRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useLayoutEffect(() => {
    if (!stopping || !targetValue) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations = trackRefs.current.flatMap((track, index) => {
      const reel = reels[index];
      if (!track || !reel?.symbols) return [];
      const matrix = getComputedStyle(track).transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1].split(',').map(Number);
      const currentY = matrix ? (matrix.length === 16 ? matrix[13] : matrix[5]) : 0;
      track.style.animation = 'none';
      track.style.transform = `translate3d(0, ${currentY}px, 0)`;
      void track.offsetHeight;
      const currentRow = Math.max(0, -currentY / SLOT_ROW_HEIGHT);
      const targetRow = currentRow < reel.targetIndex ? reel.targetIndex : reel.targetIndex + 12;
      const animation = track.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, ${-targetRow * SLOT_ROW_HEIGHT}px, 0)` },
      ], { duration: reducedMotion ? 0 : 760 + (index % 6) * 80, delay: reducedMotion ? 0 : index * 38, easing: 'cubic-bezier(.12,.72,.16,1)', fill: 'forwards' });
      return [animation];
    });
    if (!animations.length) { onSettledRef.current(); return; }
    Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(() => onSettledRef.current());
    return () => animations.forEach(animation => animation.cancel());
  }, [stopping, targetValue, reels]);

  return <div className={`number-spin-machine is-spinning${stopping ? ' is-stopping' : ''}${isCar ? ' plate-machine' : ' phone-machine'}`} role="img" aria-label={isCar ? 'Барабаны автомобильного номера' : 'Барабаны телефонного номера'}>
    <div className="number-spin-window" aria-hidden="true">{reels.map((reel, index) => reel.symbols ? <span className="number-slot-cell" key={index}><span ref={element => { trackRefs.current[index] = element; }} className="number-slot-track" style={{ '--slot-speed': `${1.05 + (index % 7) * .19}s`, '--slot-delay': `-${(index % 9) * .13}s` } as React.CSSProperties}>{reel.symbols.map((symbol, row) => <i key={row}>{symbol}</i>)}</span></span> : <span className="number-slot-separator" key={index}>{reel.char}</span>)}</div>
    <i className="number-spin-glow" />
    <span className="number-spin-indicator" aria-hidden="true" />
  </div>;
};

const NumberSpinScreen = ({ app }: { app: any }) => {
  const [phoneListingOpen, setPhoneListingOpen] = useState(false);
  const [phoneListingPrice, setPhoneListingPrice] = useState('');
  const spin = app.numberSpinScreen;
  useEffect(() => {
    setPhoneListingOpen(false);
    setPhoneListingPrice('');
  }, [spin?.type, app.phoneNumberRoll?.number_id]);
  if (!spin) return null;
  const spinning = spin.stage !== 'result';
  const isCar = spin.type === 'car';
  const roll = isCar ? app.carPlateRoll : app.phoneNumberRoll;
  const factors = roll ? (isCar ? carPlateMultipliers(roll.plate) : phoneNumberMultipliers(roll.number)) : null;
  const factorData: any = factors;
  const capped = Boolean(isCar && roll && factors && Number(roll.estimated_value) < 1000 * factors.totalMultiplier);
  const closePhone = () => { app.setPhoneNumberRoll(null); app.setNumberSpinScreen(null); };
  const openPhoneListing = () => {
    setPhoneListingPrice(String(Math.max(1, Number(roll?.estimated_value) || 1)));
    setPhoneListingOpen(true);
  };
  const submitPhoneListing = () => {
    const price = Number(phoneListingPrice);
    if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) {
      app.showMsg('Укажи цену от 1 до 100 000 000 ₽', true);
      return;
    }
    app.listNumberMarketLot('phone_number', roll.number_id, price);
  };

  return <div className={`number-spin-screen${isCar ? ' is-car' : ' is-phone'}`} role="dialog" aria-modal="true" aria-label={isCar ? 'Крутка автомобильного номера' : 'Крутка телефонного номера'}>
    <div className="number-spin-shell">
      <header className="number-spin-header">
        <div className="number-spin-brand"><span>Ж</span><div><b>Житуха</b><small>{isCar ? 'ГИБДД · ГОСНОМЕР' : 'НОМЕРНОЙ АВТОМАТ'}</small></div></div>
        {!isCar && !spinning && <button type="button" onClick={closePhone}>Закрыть</button>}
      </header>
      <main className="number-spin-content">
        <div className="number-spin-eyebrow">{isCar ? 'НОВЫЙ АВТОМОБИЛЬНЫЙ НОМЕР' : 'НОВЫЙ МОБИЛЬНЫЙ НОМЕР'}</div>
        {spinning ? <>
          <h1>{spin.stage === 'stopping' ? 'Останавливаем барабаны' : isCar ? 'Крутим госномер' : 'Крутим номер'}</h1>
          <p>{spin.stage === 'stopping' ? 'Фиксируем выпавшую комбинацию' : 'Каждая цифра и буква крутится отдельно'}</p>
          <NumberSpinMachine isCar={isCar} targetValue={spin.stage === 'stopping' && roll ? (isCar ? roll.plate : roll.number) : null} stopping={spin.stage === 'stopping'} onSettled={() => app.setNumberSpinScreen({ type: spin.type, stage: 'result' })} />
          <div className={`number-spin-progress${spin.stage === 'stopping' ? ' is-stopping' : ''}`}><i /></div>
          <small>{spin.stage === 'stopping' ? 'Номер уже определён' : 'Сверяем комбинацию и её цену'}</small>
        </> : roll && factors ? <>
          <h1>Выпал красивый номер</h1>
          {isCar ? <CarPlate plate={roll.plate} /> : <div className="number-spin-phone-result">{roll.number}</div>}
          <section className="number-spin-factors">
            <div><span>{isCar ? `Цифры ${roll.plate.match(/\d{3}/)?.[0]}` : 'Префикс'}</span><small>{isCar ? factorData.digitReason : factorData.prefixReason}</small><b>×{String(isCar ? factorData.digitMultiplier : factorData.prefixMultiplier).replace('.', ',')}</b></div>
            <div><span>{isCar ? 'Буквы' : 'Комбинация цифр'}</span><small>{isCar ? factorData.letterReason : factorData.bodyReason}</small><b>×{String(isCar ? factorData.letterMultiplier : factorData.bodyMultiplier).replace('.', ',')}</b></div>
            {isCar && <div><span>Регион</span><small>{factorData.regionReason}</small><b>×{String(factorData.regionMultiplier).replace('.', ',')}</b></div>}
            <div className="number-spin-total"><span>Итоговый множитель</span><b>×{String(factorData.totalMultiplier).replace('.', ',')}</b></div>
          </section>
          <div className="number-spin-estimate"><small>Примерная цена государству</small><strong>{Number(roll.estimated_value).toLocaleString('ru-RU')} ₽</strong></div>
          {capped && <small className="number-spin-cap-note">Достигнут лимит оценки: 100 000 ₽.</small>}
          {isCar ? <div className="number-spin-actions">
            <Btn variant="primary" disabled={app.proc} onClick={() => app.resolveCarPlateRoll(roll.roll_id, 'keep')}>Сохранить в коллекцию</Btn>
            {app.hasCar && <Btn variant="secondary" disabled={app.proc} onClick={() => app.resolveCarPlateRoll(roll.roll_id, 'activate')}>Установить на машину</Btn>}
            <Btn variant="secondary" disabled={app.proc} onClick={() => app.resolveCarPlateRoll(roll.roll_id, 'sell')}>Продать государству</Btn>
          </div> : <div className="number-spin-actions">
            <Btn variant="primary" disabled={app.proc} onClick={closePhone}>Оставить в коллекции</Btn>
            {!phoneListingOpen ? <>
              <Btn variant="secondary" disabled={app.proc} onClick={openPhoneListing}>Выставить на рынок</Btn>
              <Btn variant="secondary" disabled={app.proc} onClick={() => app.sellPhoneNumber(roll.number_id)}>Продать государству</Btn>
              <small>Номер уже сохранён в коллекции. Его можно оставить, выставить игрокам или продать государству.</small>
            </> : <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
              <label htmlFor="phone-spin-market-price">Цена на рынке, ₽</label>
              <input id="phone-spin-market-price" type="number" min={1} max={100000000} step={1} inputMode="numeric" value={phoneListingPrice} onChange={event => setPhoneListingPrice(event.target.value)} style={S.input} />
              <small>Оценка государства: {Number(roll.estimated_value).toLocaleString('ru-RU')} ₽</small>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" disabled={app.proc} onClick={() => setPhoneListingOpen(false)}>Назад</Btn>
                <Btn variant="primary" disabled={app.proc || !Number.isSafeInteger(Number(phoneListingPrice)) || Number(phoneListingPrice) < 1 || Number(phoneListingPrice) > 100000000} onClick={submitPhoneListing}>Выставить</Btn>
              </div>
            </div>}
          </div>}
        </> : null}
      </main>
    </div>
  </div>;
};

export const AppModals = ({ app }: { app: any }) => (
  <>
    <NumberSpinScreen app={app} />
    {app.career?.pending_reward?.item && <Modal open onClose={() => {}} contentStyle={{ maxWidth: 390, padding: 18, backgroundImage: 'none' }}>
      {(() => {
        const item = app.career.pending_reward.item;
        const rarity = PROFESSION_RARITIES[item.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common;
        return <div className={`profession-drop-reveal rarity-${item.rarity || 'common'}`}>
          <div className="profession-drop-icon" style={{ color: rarity.color }}><ItemArtwork item={item} size={120} /></div>
          <div className="profession-drop-rarity" style={{ '--rarity-color': rarity.color } as React.CSSProperties}>{rarity.name}</div>
          <h2>{item.item_name}</h2>
          <p>Предмет добавлен в результаты смены.</p>
          <div className="profession-drop-value">Стоимость · {Number(item.sell_price).toLocaleString('ru-RU')} ₽</div>
          <div className="profession-drop-actions">
            <Btn variant="secondary" disabled={app.proc || (Number(app.career.inventory_slots) >= 200)} onClick={() => app.claimProfessionReward('inventory')}><Backpack size={18} /> В инвентарь</Btn>
            <Btn variant="primary" disabled={app.proc} onClick={() => { if (['rare','epic'].includes(item.rarity) && !window.confirm('\u041F\u0440\u043E\u0434\u0430\u0442\u044C \u0440\u0435\u0434\u043A\u0443\u044E \u043D\u0430\u0445\u043E\u0434\u043A\u0443?')) return; app.claimProfessionReward('sell'); }}><Coins size={18} /> Продать</Btn>
          </div>
          {Number(app.career.inventory_slots) >= 200 && <small>Инвентарь 200/200 — продай находку или освободи слот.</small>}
        </div>;
      })()}
    </Modal>}
    <Modal open={app.settingsOpen} onClose={() => app.setSettingsOpen(false)} contentStyle={{ maxWidth: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} /> Настройки</h3>
        <button type="button" aria-label="Закрыть настройки" onClick={() => app.setSettingsOpen(false)} style={{ border: 0, background: 'transparent', color: '#6b5f45', padding: 5, cursor: 'pointer' }}><X size={20} /></button>
      </div>
      <div className="settings-list">
        <button type="button" role="switch" aria-checked={app.soundEnabled} onClick={() => app.changeSoundEnabled(!app.soundEnabled)} className="settings-row">
          <span><Volume2 size={19} /> Звуковые эффекты</span><b>{app.soundEnabled ? 'Вкл.' : 'Выкл.'} {app.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</b>
        </button>
        <button type="button" role="switch" aria-checked={app.vibrationEnabled} onClick={() => app.changeVibrationEnabled(!app.vibrationEnabled)} className="settings-row">
          <span><Vibrate size={19} /> Вибрация</span><b>{app.vibrationEnabled ? 'Вкл.' : 'Выкл.'}</b>
        </button>
      </div>
      <Btn variant="secondary" onClick={() => app.setSettingsOpen(false)} style={{ marginTop: 18 }}>Готово</Btn>
    </Modal>

    <Modal open={app.refOpen} onClose={() => app.setRefOpen(false)}>
      <Gift size={40} color="#c0453a" style={{ marginBottom: 15 }} /><h3 style={{ marginTop: 0, fontSize: 20 }}>Рефералка</h3>
      <Btn variant="purple" onClick={app.inviteFriend} style={{ background: 'linear-gradient(135deg, #c0453a 0%, #be185d 100%)', color: '#fdf1ec', marginBottom: 15, padding: 12 }}><UserPlus size={20} /> Пригласить друга</Btn>
      <p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 10 }}>Приглашено друзей: <b>{app.myRefCount}</b></p>
      <div style={{ background: 'rgba(63,157,85,0.10)', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid rgba(63,157,85,0.3)', textAlign: 'left' }}><b style={{ color: '#27804d', fontSize: 13 }}>Бонусы за приглашения</b><p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.45 }}>Новому игроку — +1 000 ₽ к старту. Тебе — 500 ₽ и 10 жетонов, когда друг зайдёт в два разных дня и завершит первую работу. Затем 14 дней начисляется 5% с его оплаты за работу и собранной кассы кофейни — максимум 10 000 ₽ с одного друга. С каждой его покупки за Stars тебе навсегда начисляется ещё 10% жетонами.</p></div>
      <div style={{ background: 'rgba(192,69,58,0.08)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(192,69,58,0.25)' }}><p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#c0453a' }}>Игровой бонус: 5% с доходов приглашённых</p><p style={{ margin: 0, fontSize: 24, color: '#c0453a', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.refBalance} <Coins size={18} style={{ display: 'inline' }} /></p></div>
      <Btn variant="primary" onClick={app.collectRefBonus} disabled={app.proc || app.refBalance <= 0} style={{ background: app.refBalance > 0 ? 'linear-gradient(135deg, #3f9d55 0%, #059669 100%)' : '#e7d9b8', marginBottom: 10 }}>Собрать 5%</Btn>
      <Btn variant="secondary" onClick={() => app.setRefOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
    </Modal>

    <Modal open={app.quitOpen} onClose={() => app.setQuitOpen(false)}>
      <h3 style={{ marginTop: 0, fontSize: 20 }}>Увольнение</h3><p style={{ color: '#6b5f45', fontSize: 15, marginBottom: 20 }}>Ты уверен?</p>
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => app.setQuitOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="danger" onClick={app.quit} disabled={app.proc}>Уволиться</Btn></div>
    </Modal>

    <Modal open={app.sellOpen} onClose={() => { app.setSellOpen(false); app.setSellSource(null); }}>
      {(() => {
        const model = app.sellSource === 'stock' && app.sellItemType === 'car'
          ? app.vehicleState?.models?.find((item: any) => item.model_id === app.sellItemData) : null;
        const min = model ? Math.ceil(Number(model.base_price) * 0.75) : null;
        const max = model ? Math.floor(Number(model.base_price) * 1.25) : null;
        const valid = min == null || (max != null && Number(app.sellPrice) >= min && Number(app.sellPrice) <= max);
        return <>
      <h3>Продажа {app.sellItemType === 'phone' ? 'телефона' : app.sellItemType === 'car' ? 'машины' : 'квартиры'}</h3>
      <p style={{ color: '#6b5f45', fontSize: 12, marginBottom: 10 }}>{app.sellSource === 'personal' ? 'Из личного имущества' : 'Со склада бизнеса'}</p>
      <label style={{ display: 'block', textAlign: 'left', color: '#6b5f45', fontSize: 13, marginBottom: 6 }}>Цена продажи — назначаете сами, ₽</label>
      <input type="number" min="1" step="1" value={app.sellPrice} onChange={(e: any) => app.setSellPrice(e.target.value)} style={S.input} />
      {min != null && <small style={{ display: 'block', color: valid ? '#6b5f45' : '#c0453a', margin: '-10px 0 12px' }}>Для машины бизнеса: {min.toLocaleString('ru-RU')}–{max?.toLocaleString('ru-RU')} ₽</small>}
      <div style={{ display: 'flex', gap: 10 }}><Btn variant="secondary" onClick={() => { app.setSellOpen(false); app.setSellSource(null); }} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn><Btn variant="purple" onClick={app.listItem} disabled={!valid || app.proc}>Выставить</Btn></div>
        </>;
      })()}
    </Modal>

    <Modal open={app.promoOpen} onClose={() => app.setPromoOpen(false)}>
      <Gift size={40} color="#3f9d55" style={{ marginBottom: 15 }} />
      <h3>Активация промокода</h3>
      <input type="text" value={app.promoInput} onChange={(e: any) => app.setPromoInput(e.target.value.toUpperCase())} placeholder="ALPHA100" style={S.input} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.4fr)', gap: 10, width: '100%' }}>
        <Btn variant="secondary" onClick={() => app.setPromoOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d', minWidth: 0, padding: '12px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>Отмена</Btn>
        <Btn variant="primary" onClick={app.redeemPromo} style={{ minWidth: 0, padding: '12px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>Активировать</Btn>
      </div>
    </Modal>

    <Modal open={app.bugOpen} onClose={() => app.setBugOpen(false)}>
      <Bug size={40} color="#c0453a" style={{ marginBottom: 15 }} />
      <h3>Сообщить о баге</h3>
      <p style={{ color: '#6b5f45', fontSize: 13, marginBottom: 15 }}>Опиши проблему, и админ получит сообщение в Telegram.</p>
      <textarea 
        value={app.bugText} 
        onChange={(e: any) => app.setBugText(e.target.value)} 
        placeholder="Что случилось?" 
        style={{ ...S.input, minHeight: '100px', resize: 'none' }} 
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="secondary" onClick={() => app.setBugOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Отмена</Btn>
        <Btn variant="primary" onClick={app.submitBug} disabled={app.proc || app.bugText.trim().length === 0}>
          {app.proc ? 'Отправка...' : 'Отправить'}
        </Btn>
      </div>
    </Modal>
  </>
);

export const DailyRewardModal = ({ app }: { app: any }) => {
  if (!app.isDailyOpen) return null;
  return (
    <div style={S.modalBg}>
      <div style={{ ...S.modalBox, maxWidth: '360px' }}>
        <Gift size={40} color="#c0453a" style={{ marginBottom: 10 }} />
        <h3 style={{ marginTop: 0, marginBottom: 15 }}>Ежедневный доход</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {DAILY_REWARDS.map((rw, i) => {
            const isClaimed = app.dailyStreak > i;
            const isCurrent = app.dailyStreak === i;
            return (
              <div key={i} style={{ backgroundColor: isCurrent ? 'rgba(192,69,58,0.15)' : '#e7d9b8', border: isCurrent ? '1px solid #c0453a' : '1px solid rgba(90,70,40,0.08)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isClaimed ? 0.5 : 1 }}>
                <div style={{ fontSize: 10, color: '#6b5f45', marginBottom: 5 }}>День {i + 1}</div>
                <Coins size={20} color="#b06a15" />
                <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 5 }}>{rw.amount} {rw.type === 'money' ? 'монет' : 'шт.'}</div>
                {rw.boost && <div style={{ fontSize: 10, color: '#c0453a' }}>+Буст x1.1</div>}
              </div>
            );
          })}
        </div>
        <Btn variant="primary" onClick={app.claimDaily} disabled={app.proc || app.dailyStreak >= 7} style={{ marginBottom: 10 }}>
          {app.dailyStreak >= 7 ? 'Приходи завтра' : 'Забрать награду'}
        </Btn>
        <Btn variant="secondary" onClick={() => app.setIsDailyOpen(false)} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
      </div>
    </div>
  );
};

export const TutorialCard = ({ app }: { app: any }) => {
  if (app.onboardStep >= 6) return null;

  const steps = [
    `Выбери действие в карточке профессии и пройди 3 этапа`,
    "Находка готова! Продай её государству или отправь в инвентарь",
    "Выпей кофе из туториала ☕",
    "Загляни в 'Бизнесы'",
    "Посмотри цены на Рынке",
    "Ты в теме! Забери ежедневку 🎁"
  ];

  return (
    <div style={{ backgroundColor: 'rgba(61,126,166,0.10)', border: '1px solid #3d7ea6', borderRadius: 8, padding: 15, marginBottom: 20, position: 'relative' }}>
      <button onClick={app.skipTutorial} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#6b5f45', cursor: 'pointer' }}><X size={18} /></button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 30 }}>👨‍🦳</div>
        <div><div style={{ fontWeight: 'bold', color: '#2f6a94' }}>Дядя Гоша</div><div style={{ fontSize: 12, color: '#6b5f45' }}>Шаг {app.onboardStep + 1} из 6</div></div>
      </div>
      <div style={{ fontSize: 14, color: '#2f2a1d', marginBottom: 10 }}>{steps[app.onboardStep]}</div>
      {app.onboardStep === 2 && <Btn variant="primary" onClick={app.drinkTutorialCoffee} disabled={app.proc} style={{ padding: 10, fontSize: 14, marginBottom: 10 }}>Продолжить</Btn>}
      {app.onboardStep === 5 && <Btn variant="primary" onClick={app.claimTutorialReward} disabled={app.proc} style={{ padding: 10, fontSize: 14 }}>Забрать 2000 монет</Btn>}
    </div>
  );
};

const PROFESSION_ICONS: Record<string, any> = { miner: Pickaxe, lumberjack: TreePine, fisherman: Fish, farmer: Sprout, courier: PackageCheck, taxi: CarFront };

const BUSINESS_ART: Record<string, string> = {
  coffee: '/images/business-coffee.jpg',
  minimarket: '/images/business-minimarket.jpg',
  salon: '/images/business-showroom.jpg',
  taxi: '/images/profession-taxi.jpg',
  construction: '/images/business-construction.jpg',
  auto_repair: '/images/business-repair.jpg',
  casino: '/images/business-casino.jpg',
};

const VEHICLE_ART: Record<string, string> = {
  lada: '/images/car-lada.jpg',
  matiz: '/images/car-matiz.jpg',
  vaz_2107: '/images/car-vaz_2107.jpg',
  renault_logan: '/images/car-renault_logan.jpg',
  volkswagen_polo: '/images/car-volkswagen_polo.jpg',
  ford_focus: '/images/car-ford_focus.jpg',
  toyota: '/images/car-toyota.jpg',
  skoda_octavia: '/images/car-skoda_octavia.jpg',
  kia_optima: '/images/car-kia_optima.jpg',
  bmw_3: '/images/car-bmw_3.jpg',
  bmw_5: '/images/car-bmw_5.jpg',
  mercedes_e: '/images/car-mercedes_e.jpg',
  lexus_es: '/images/car-lexus_es.jpg',
  porsche_panamera: '/images/car-porsche_panamera.jpg',
  range_rover: '/images/car-range_rover.jpg',
};

const VehicleArtwork = ({ modelId, className = '' }: { modelId: string; className?: string }) => (
  <img className={`vehicle-artwork ${className}`} src={VEHICLE_ART[modelId] || VEHICLE_ART.lada} alt="" aria-hidden="true" loading="lazy" />
);

const ProfessionWorkCard = ({ app }: { app: any }) => {
  const [sceneBusy, setSceneBusy] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const sceneBusyRef = useRef(false);
  const requestLock = useRef(false);
  const onSceneBusyChange = useCallback((busy: boolean) => {
    sceneBusyRef.current = busy;
    setSceneBusy(busy);
  }, []);
  const professionBusy = !!app.proc || requestPending || sceneBusy;
  const runProfessionAction = async (perform: () => unknown) => {
    // Ref closes the gap before React paints the disabled button.
    if (app.proc || requestLock.current || sceneBusyRef.current) return;
    requestLock.current = true;
    setRequestPending(true);
    try { await perform(); }
    finally { requestLock.current = false; setRequestPending(false); }
  };
  const career = app.career || {};
  const profession = PLAYER_PROFESSIONS.find(item => item.id === career.profession) || PLAYER_PROFESSIONS[0];
  const Icon = PROFESSION_ICONS[profession.id] || Pickaxe;
  const cycle = career.active_cycle;
  const progress = cycle ? Math.min(100, Math.max(0, (Number(cycle.actions_done || 0) / 3) * 100)) : 0;
  const unlocked = Array.isArray(career.unlocked) ? career.unlocked : ['miner'];
  const drops = PROFESSION_LOOT[profession.id] || [];
  const taxiCars = career.taxi_fleet?.cars || [];
  const availableTaxiCars = taxiCars.filter((car: any) => !car.busy && Number(car.health) > 0);
  const courierDestination = profession.id === 'courier'
    ? DISTRICTS.find(district => district.id === cycle?.delivery_district)
    : null;
  const courierAtDestination = !!courierDestination && app.currentDistrict === courierDestination.id;
  const hasCourierRoute = profession.id === 'courier' && !!cycle;
  const needsCourierTravel = profession.id === 'courier' && Number(cycle?.actions_done) >= 1;
  const canDoStep = !!cycle && cycle.actions_done < 3 && !professionBusy
    && (!needsCourierTravel || courierAtDestination);
  const full = Number(career.inventory_slots) >= Number(career.inventory_capacity || 200) && drops.length > 0;

  return <section className="profession-work-card" aria-busy={professionBusy}>
    <div className="profession-card-head">
      <div><span className="profession-eyebrow">Профессия</span><h2>{profession.name}</h2></div>
      <div className="profession-level-badge">Уровень {career.level || 1}</div>
    </div>
    <div className="profession-xp-block">
      <div className="profession-xp-label"><b>Уровень {career.level || 1}</b><span>{Number(career.xp || 0).toLocaleString('ru-RU')} / {Number(career.xp_to_next || 100).toLocaleString('ru-RU')} XP</span></div>
      <div className="profession-xp-track"><span style={{ width: `${Math.min(100, Number(career.xp || 0) / Math.max(1, Number(career.xp_to_next || 100)) * 100)}%` }} /></div>
    </div>
    <label className="profession-select-label" htmlFor="profession-select">Специальность</label>
    <div className="profession-select-wrap"><Icon size={19} /><select id="profession-select" value={profession.id} onChange={event => { const value = event.target.value; void runProfessionAction(() => app.selectProfession(value)); }} disabled={!!cycle || professionBusy}>
      {PLAYER_PROFESSIONS.map(item => <option key={item.id} value={item.id} disabled={!unlocked.includes(item.id)}>{item.name}{unlocked.includes(item.id) ? '' : ` · с уровня ${item.unlockLevel}`}</option>)}
    </select><ChevronRight size={17} /></div>
    {profession.id === 'taxi' && <div className="profession-select-wrap taxi-shift-car">
      <CarFront size={19} />
      <select aria-label="Машина на смену" value={career.taxi_fleet?.selected_car_index ?? ''}
        onChange={event => { const value = Number(event.target.value); void runProfessionAction(() => app.selectTaxiCar(value)); }} disabled={!!cycle || professionBusy || availableTaxiCars.length === 0}>
        <option value="" disabled>{taxiCars.length ? 'Нет свободных машин' : 'В таксопарке нет машин'}</option>
        {taxiCars.map((car: any) => <option key={car.car_index} value={car.car_index} disabled={car.busy || car.health <= 0}>
          {car.model_name || app.vehicleState?.models?.find((item: any) => item.model_id === car.model)?.model_name || car.model} / {car.class === 'economy' ? 'эконом' : car.class === 'comfort' ? 'комфорт' : 'бизнес'} · {car.health}%{car.busy ? ' · занята' : ''}
        </option>)}
      </select><ChevronRight size={17} />
    </div>}
    {profession.id === 'taxi' && availableTaxiCars.length === 0 && <small className="profession-taxi-hint">{taxiCars.length ? 'Все машины заняты или требуют ремонта.' : 'Попроси владельца таксопарка добавить машину в автопарк.'}</small>}
    <ProfessionScene key={profession.id} profession={profession.id} stage={Number(cycle?.actions_done || 0)} cycleId={cycle?.id ?? (cycle ? 'active' : null)} onBusyChange={onSceneBusyChange} />
    <div className="profession-cycle-status">
      {cycle ? <>
        <div className="profession-stage-label"><b>{cycle.actions_done < 3 ? `Этап ${cycle.actions_done + 1} из 3` : 'Результат готов'}</b>
          <span>{hasCourierRoute && courierDestination
            ? cycle.actions_done === 0 ? `Забрать заказ · доставка в район «${courierDestination.name}»` : cycle.actions_done < 3 ? `Отправляйтесь в район «${courierDestination.name}»` : `Забрать можно только в районе «${courierDestination.name}»`
            : cycle.actions_done < 3 ? profession.actionLabels[cycle.actions_done] : 'Можно забрать'}</span></div>
        <div className="profession-cycle-track"><span style={{ width: `${progress}%` }} /></div>
        {hasCourierRoute && <div style={{ margin: '10px 0', padding: '10px 12px', borderRadius: 10, textAlign: 'left', background: courierAtDestination ? 'rgba(63,157,85,.12)' : 'rgba(61,126,166,.12)', border: `1px solid ${courierAtDestination ? 'rgba(63,157,85,.35)' : 'rgba(61,126,166,.3)'}` }}>
          <b style={{ display: 'block', color: courierAtDestination ? '#3f9d65' : '#3d7ea6', fontSize: 13 }}>{!courierDestination ? 'Район доставки ещё не назначен' : cycle.actions_done === 0 ? `Заказ доставить в район «${courierDestination.name}»` : courierAtDestination ? 'Вы приехали — можно продолжать заказ' : `Пункт доставки: ${courierDestination.name}`}</b>
          {!courierDestination
            ? <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>Для маршрутов курьера нужно применить SQL-миграцию районной доставки.</small>
            : cycle.actions_done === 0
              ? <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>Сначала заберите заказ. На следующем этапе отправляйтесь в этот район.</small>
              : !courierAtDestination && <>
              <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>На втором этапе отправляйтесь в указанный район. Завершить доставку получится только там.</small>
              <button type="button" disabled={professionBusy} onClick={() => app.setTab('district_map')} style={{ marginTop: 8, border: 0, borderRadius: 8, padding: '8px 11px', background: '#3d7ea6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Открыть карту районов</button>
            </>}
        </div>}
        {cycle.actions_done < 3
          ? <button className="profession-action-button" disabled={!canDoStep} onClick={() => void runProfessionAction(() => app.stepProfessionCycle(cycle.actions_done + 1))}><Icon size={20} /> {sceneBusy ? 'Выполняется…' : needsCourierTravel && !courierAtDestination ? 'Сначала доберитесь до района' : needsCourierTravel ? (cycle.actions_done === 1 ? 'Подтвердить прибытие' : 'Завершить доставку') : profession.actionLabels[cycle.actions_done]}</button>
          : <button className="profession-action-button" disabled={professionBusy || (needsCourierTravel && !courierAtDestination)} onClick={() => void runProfessionAction(app.finishProfessionCycle)}>{sceneBusy ? 'Выполняется…' : needsCourierTravel && !courierAtDestination ? 'Вернитесь в район доставки' : 'Забрать результат'}</button>}
      </> : <>
        <div className="profession-stage-label"><b>Новая смена</b><span>3 этапа · +25 XP</span></div>
        {full && <div className="profession-inventory-full">Инвентарь заполнен · {career.inventory_slots}/200 <button onClick={() => app.setTab('inventory')}>Открыть</button></div>}
        <button className="profession-action-button" disabled={professionBusy || full || (profession.id === 'taxi' && (career.taxi_fleet?.selected_car_index == null || availableTaxiCars.length === 0))} onClick={() => void runProfessionAction(app.startProfessionCycle)}><Icon size={20} /> {sceneBusy ? 'Завершаем смену…' : 'Начать работу'}</button>
      </>}
    </div>
    <div className="profession-reward-preview">
      <div className="profession-preview-title">{drops.length ? `Находки · ${profession.minPrice}–${profession.maxPrice} ₽` : `Выплата · ${profession.minPrice}–${profession.maxPrice} ₽`}</div>
      {drops.length ? <div className="profession-drop-list">{drops.map(item => <span key={item.id} style={{ color: PROFESSION_RARITIES[item.rarity].color }} title={PROFESSION_RARITIES[item.rarity].name}>{item.icon} {item.name}</span>)}</div> : <div className="profession-cash-preview">{profession.output}</div>}
      <small>Результат и редкость определяются после завершения смены.</small>
    </div>
  </section>;
};

export const HomeTab = ({ app }: { app: any }) => {
  const [clockNow, setClockNow] = useState(Date.now());
  const [seasonPass, setSeasonPass] = useState<any>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    if (!app.pid) { setSeasonPass(null); return; }
    void app.supabase.rpc('season_pass_state_rpc', { p_player_id: app.pid }).then(({ data, error }: any) => {
      if (active && !error && !data?.error) setSeasonPass(data);
    }).catch(() => {});
    return () => { active = false; };
  }, [app.pid, app.dailyMissions, app.supabase]);
  const coffeeBonusSeconds = Math.max(0, Math.ceil((Date.parse(app.coffeeBonusUntil || '') - clockNow) / 1000));
  const returnBonusSeconds = Math.max(0, Math.ceil((Date.parse(app.returnBoostUntil || '') - clockNow) / 1000));
  const seasonXp = Number(seasonPass?.xp || 0);
  const seasonLevel = Math.min(30, Math.floor(seasonXp / 45));
  const seasonXpInLevel = seasonLevel >= 30 ? 0 : seasonXp % 45;
  const seasonSecondsLeft = Math.max(0, Math.floor((Date.parse(seasonPass?.season?.ends_at || '') - clockNow) / 1000));
  const seasonDaysLeft = Math.ceil(seasonSecondsLeft / 86400);
  const seasonStartsAt = Date.parse(seasonPass?.season?.starts_at || '');
  const seasonOpenSeconds = Number.isFinite(seasonStartsAt) ? Math.max(0, Math.floor((seasonStartsAt - clockNow) / 1000)) : 0;
  const seasonLocked = !!seasonPass && seasonOpenSeconds > 0;
  const av = getAvatar(app.avatarId);
  const myCoffee = app.myBizs?.find((b: any) => b.biz_type === 'coffee');
  const hasBusiness = (app.myBizs || []).length > 0;
  const modifier = getDayModifier();
  return (
    <div className="game-tab game-tab-home" style={{ maxWidth: '460px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div className="home-player-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className={`home-avatar-button profile-avatar-frame${app.profileFrame === 'frame_test' ? ' has-exclamation-frame' : ''}${app.profileFrame === 'frame_route' ? ' has-route-frame' : ''}`} aria-label="Открыть профиль" onClick={app.handleAvatar} style={{ width: 55, height: 55, borderRadius: ['frame_test', 'frame_route'].includes(app.profileFrame) ? '50%' : '14px', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, ...(app.profileFrame === 'frame_test' ? frameStyle('frame_test') : app.profileFrame === 'frame_amber' ? frameStyle('frame_amber') : { border: '2px solid rgba(90,70,40,0.22)' }), cursor: 'pointer', userSelect: 'none' }}>{app.profileFrame === 'frame_test' && <img className="avatar-exclamation-ring" src="/images/frame-mint-exclamation.svg" alt="" aria-hidden="true" />}{av.emoji}</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', fontFamily: 'Russo One, Impact, sans-serif' }}>{app.nick}</div>
              {Date.parse(app.premiumUntil || '') > Date.now() && <Crown size={17} aria-label="VIP" style={{ color: '#d49b2a', fill: 'rgba(212,155,42,.22)' }} />}
              <button type="button" aria-label="Пригласить друга" title="Пригласить друга" onClick={() => { app.setRefOpen(true); void app.refreshProfile(); }} style={{ background: 'rgba(192,69,58,0.12)', border: '1px solid #c0453a', color: '#c0453a', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><UserPlus size={16} /></button>
              <button type="button" aria-label="Ввести промокод" title="Промокод" onClick={() => app.setPromoOpen(true)} style={{ background: 'rgba(63,157,85,0.15)', border: '1px solid #3f9d55', color: '#3f9d55', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Gift size={16} /></button>
              <button type="button" aria-label="Сообщить об ошибке" title="Сообщить об ошибке" onClick={() => app.setBugOpen(true)} style={{ background: 'rgba(192,69,58,0.12)', border: '1px solid #c0453a', color: '#c0453a', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Bug size={16} /></button>
            </div>
            <div style={{ fontSize: 13, color: '#6b5f45', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              ID: {app.tgId.slice(0, 6)}
              {app.boostEnd > Date.now() && <span style={{ color: '#c0453a', fontWeight: 'bold', marginLeft: 5, fontSize: 11, border: '1px solid #c0453a', padding: '1px 4px', borderRadius: 4 }}>x1.1 БУСТ</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <button type="button" aria-label="Настройки" title="Настройки" onClick={() => app.setSettingsOpen(true)} style={{ border: '1px solid rgba(90,70,40,.2)', borderRadius: 8, padding: 6, marginBottom: 8, background: 'rgba(90,70,40,.06)', color: '#6b5f45', cursor: 'pointer' }}><Settings size={18} /></button>
          <div style={{ color: '#b06a15', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, fontFamily: 'Russo One, Impact, sans-serif' }}><Coins size={18} /> <AnimatedNumber value={app.money} /></div>
        </div>
      </div>

      <section className="home-hero">
        <div className="home-hero-topline"><span>ТВОЯ ИГРА</span><span className="home-hero-level">Уровень {app.career?.level || 1}</span></div>
        <h1>{hasBusiness ? 'Твой следующий ход.' : 'Первая смена.'}</h1>
        <p>{hasBusiness ? 'Открывай новые возможности и развивай своё дело.' : 'Заработай первые деньги и открой свой бизнес.'}</p>
        <div className="home-hero-business-progress" aria-label={'Бизнесов: ' + Math.min(3, (app.myBizs || []).length) + ' из 3'}>
          <div><span>Твои бизнесы</span><b>{Math.min(3, (app.myBizs || []).length)} / 3</b></div>
          <i><span style={{ width: (Math.min(100, (app.myBizs || []).length / 3 * 100) + '%') }} /></i>
        </div>
      </section>

      <ProfessionWorkCard app={app} />

      <button type="button" className="home-event-card" aria-label={`Подробнее о событии дня: ${modifier.name}`} onClick={() => app.setModifierOpen(true)} style={{ width: '100%', font: 'inherit', textAlign: 'left', backgroundColor: 'rgba(90,70,40,0.08)', border: `1px solid ${modifier.color}`, borderRadius: 8, padding: 12, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <div className="home-event-icon"><Sparkles size={18} /></div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: modifier.color, fontSize: 14 }}>{modifier.name}</div>
          <div style={{ fontSize: 12, color: '#6b5f45' }}>{modifier.desc}</div>
        </div>
        <div style={{ fontSize: 12, color: '#6b5f45' }}>Подробнее →</div>
      </button>

      <button type="button" className="home-season-pass-card" onClick={() => app.setTab('season_pass')} aria-label="Открыть сезонный пропуск">
        <span className="home-season-pass-icon"><Ticket size={21} /></span>
        <span className="home-season-pass-copy">
          <span className="home-season-pass-title">Сезонный пропуск <small>{seasonLocked ? `откроется через ${Math.ceil(seasonOpenSeconds / 86400)} дн.` : seasonDaysLeft > 0 ? `ещё ${seasonDaysLeft} дн.` : seasonPass ? 'сезон завершён' : 'открыть'}</small></span>
          <span className="home-season-pass-progress-label">{seasonLocked ? 'Откроется после семейного сезона' : seasonPass ? `Уровень ${seasonLevel} / 30 · ${seasonLevel >= 30 ? 'все уровни открыты' : `${seasonXpInLevel} / 45 XP`}` : 'Награды за работу, продажи и профессии'}</span>
          <span className="home-season-pass-progress"><i style={{ width: `${seasonLevel >= 30 ? 100 : seasonPass ? seasonXpInLevel / 45 * 100 : 0}%` }} /></span>
        </span>
        <ChevronRight size={19} className="home-season-pass-arrow" />
      </button>

      {coffeeBonusSeconds > 0 && <div role="status" className="home-bonus-status"><Coffee size={16} /> <span>+10% к заработку</span><b>{Math.floor(coffeeBonusSeconds / 60)}:{String(coffeeBonusSeconds % 60).padStart(2, '0')}</b></div>}
      {returnBonusSeconds > 0 && <div role="status" className="home-bonus-status"><Gift size={16} /> <span>Бонус возвращения · +15%</span><b>{Math.floor(returnBonusSeconds / 60)}:{String(returnBonusSeconds % 60).padStart(2, '0')}</b></div>}


      <section className="home-missions" style={{ marginTop: 15, marginBottom: 15, padding: 13, borderRadius: 12, background: 'linear-gradient(145deg, rgba(38,25,55,.96), rgba(27,19,37,.98))', border: '1px solid rgba(183,142,255,.25)', color: '#f7f1ff', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
          <b>Задания на сегодня</b><small style={{ color: '#b9a6d0' }}>Обновятся в полночь UTC</small>
        </div>
        {(app.dailyMissions || []).map((mission: any) => {
          const description = mission.id === 'work_5' ? 'Поработай 5 раз' : mission.id === 'sell_1' ? 'Продай предмет из инвентаря' : 'Заверши действие в профессии';
          const complete = Number(mission.progress) >= Number(mission.target);
          return <div key={mission.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{description}</div>
              <div style={{ fontSize: 11, color: '#b9a6d0', marginTop: 3 }}>{Math.min(Number(mission.progress), Number(mission.target))}/{mission.target} · награда {Number(mission.reward).toLocaleString('ru-RU')} ₽</div>
              <div style={{ height: 4, marginTop: 5, borderRadius: 5, background: 'rgba(255,255,255,.12)' }}><div style={{ height: '100%', width: `${Math.min(100, Number(mission.progress) / Number(mission.target) * 100)}%`, borderRadius: 5, background: '#ff9824' }} /></div>
            </div>
            {mission.claimed ? <span style={{ color: '#73dc98', fontSize: 12 }}>Получено</span>
              : complete ? <button type="button" disabled={app.proc} onClick={() => app.claimDailyMission(mission.id)} style={{ border: 0, borderRadius: 7, padding: '7px 9px', background: '#ff9824', fontWeight: 700 }}>Забрать</button>
                : <span style={{ color: '#b9a6d0', fontSize: 12 }}>В процессе</span>}
          </div>;
        })}
      </section>

      <details className="home-wallet-details" style={{ marginBottom: 15, padding: '11px 13px', borderRadius: 10, background: 'rgba(61,126,166,.08)', border: '1px solid rgba(61,126,166,.22)', color: '#2f2a1d', textAlign: 'left' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Накопления и кассы · открыть</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Деньги на руках</span><b>{Number(app.money || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span>Накопленные чаевые</span><b>{Number(app.tipBalance || 0).toLocaleString('ru-RU')} ₽</b></div>
          {Number(app.tipBalance || 0) > 0 && <button type="button" disabled={app.proc} onClick={app.collectTips} style={{ border: 0, borderRadius: 7, padding: 7, background: '#3f9d55', color: '#fff', fontWeight: 700 }}>Забрать чаевые</button>}
          {Number(app.refBalance || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Реферальные бонусы</span><b>{Number(app.refBalance).toLocaleString('ru-RU')} ₽</b></div>}
          {(app.myBizs || []).map((biz: any) => <div key={biz.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid rgba(61,126,166,.14)', paddingTop: 6 }}><span>Касса · {biz.business_name}</span><b>{(Number(biz.cash_balance || 0) + Number(biz.coffee_balance || 0)).toLocaleString('ru-RU')} ₽</b></div>)}
          <small style={{ color: '#6b5f45' }}>Если покупка или выплата не прошла, причина показывается сообщением в игре.</small>
        </div>
      </details>

      <TutorialCard app={app} />

      <div className="home-shortcuts" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <button className="home-shortcut" onClick={() => app.setTab('mining')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 10, backgroundColor: 'var(--surface-soft)', border: '1px solid var(--surface-line)', color: 'var(--text-main)', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Pickaxe size={24} color="#c084fc" /><span style={{ fontSize: 13 }}>Майнинг</span>
        </button>
        <button className="home-shortcut" onClick={() => app.setTab('business')} style={{ flex: 1, padding: '15px 10px', marginRight: 10, borderRadius: 10, backgroundColor: '#fbf4e4', border: '1px solid rgba(192, 132, 252, 0.3)', color: '#2f2a1d', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Briefcase size={24} color="#5f43a0" /><span style={{ fontSize: 13 }}>Бизнесы</span>
        </button>
        <button className="home-shortcut" onClick={() => { app.setMarketTab('shops'); app.setTab('market'); }} style={{ flex: 1, padding: '15px 10px', marginLeft: 10, borderRadius: 10, backgroundColor: '#fbf4e4', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#2f2a1d', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Coffee size={24} color="#b06a15" /><span style={{ fontSize: 13 }}>Пить кофе</span>
        </button>
      </div>

      {app.currentDistrict === 'center' && <button type="button" className="home-gibdd-card" onClick={() => app.setTab('gibdd')}>
        <span className="home-gibdd-icon"><CarFront size={23} /></span><span className="home-gibdd-copy"><b>ГИБДД</b><small>Крути номера · машина не нужна</small></span><ChevronRight size={20} />
      </button>}

      {(app.role === 'admin' || app.role === 'superadmin') && <>
        <button onClick={app.openAdmin} style={{ width: '100%', marginBottom: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, border: '2px solid #8f302b', background: 'linear-gradient(180deg, #c94b40, #a9322a)', color: '#fff4e0', boxShadow: '0 4px 0 rgba(90,35,30,.35)', fontFamily: 'Russo One, sans-serif', fontSize: 14, cursor: 'pointer' }}><ShieldAlert size={20} /> Панель администратора</button>
        <button onClick={() => app.setMaintenance(true)} disabled={app.maintenanceBusy || app.maintenanceEnabled} style={{ width: '100%', marginBottom: 18, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, border: '1px solid rgba(61,126,166,.45)', background: 'rgba(61,126,166,.12)', color: '#2f5f7d', fontWeight: 700, cursor: app.maintenanceBusy || app.maintenanceEnabled ? 'default' : 'pointer', opacity: app.maintenanceEnabled ? .55 : 1 }}><Wrench size={18} /> {app.maintenanceEnabled ? 'Техработы включены' : 'Закрыть игру на техработы'}</button>
        {app.maintenanceError && <p role="alert" style={{ color: '#c0453a' }}>{app.maintenanceError}</p>}
      </>}

      <div className="home-premium-actions" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => app.setTab('shop')} style={{ ...S.btnPurple, flex: 1, width: 'auto', minWidth: 0, padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}><Gift size={18} /> Донат</button>
        <button onClick={() => app.setTab('profile')} style={{ ...S.btnSecondary, flex: 1, width: 'auto', minWidth: 0, padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}><Palette size={18} /> Косметика</button>
      </div>

      {myCoffee && (
        <div className="home-cash-card" style={{ backgroundColor: '#fbf4e4', border: '1px solid rgba(63,157,85,0.35)', borderRadius: 10, padding: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(63,157,85,0.15)', padding: 10, borderRadius: 12 }}><Coins size={24} color="#2c7a3c" /></div>
            <div><div style={{ fontSize: 16, fontWeight: 'bold' }}>Касса: {myCoffee.business_name}</div><div style={{ fontSize: 12, color: '#6b5f45' }}>Доход: <span style={{ color: '#2c7a3c', fontWeight: 'bold'}}>{myCoffee.coffee_balance || 0}</span> монет</div></div>
          </div>
          <Btn variant="primary" onClick={app.collect} disabled={app.proc || !myCoffee.coffee_balance} style={{ width: 'auto', padding: '10px 15px', fontSize: 14 }}>Собрать</Btn>
        </div>
      )}

    </div>
  );
};

export const MarketItem = ({ item, app, type }: any) => {
  let numberData: any = null;
  if (type === 'phone_number' || type === 'car_number') {
    try { numberData = JSON.parse(String(item.item_data || '{}')); } catch { numberData = {}; }
  }
  const itemKey = String(item.item_data || '').split(':').pop() || '';
  const marketArt = type === 'car' ? VEHICLE_ART[itemKey] || VEHICLE_ART.lada : type === 'house' ? '/images/market-panelka.jpg' : null;
  const title = type === 'phone_number' ? '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440'
    : type === 'car_number' ? '\u0410\u0432\u0442\u043e\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440'
    : type === 'car' ? (app.vehicleState?.models?.find((model: any) => model.model_id === itemKey)?.model_name || (itemKey === 'lada' ? '\u041e\u043a\u0430' : '\u0422\u043e\u0439\u043e\u0442\u0430'))
    : type === 'house' ? '\u041a\u0432\u0430\u0440\u0442\u0438\u0440\u0430' : itemKey === 'button' ? '\u041a\u043d\u043e\u043f\u043e\u0447\u043d\u044b\u0439 \u0442\u0435\u043b.' : itemKey === 'smartphone' ? '\u0421\u043c\u0430\u0440\u0442\u0444\u043e\u043d' : '\u0422\u0435\u043b\u0435\u0444\u043e\u043d';
  return <div className="market-item-card" style={{ backgroundColor: '#21172e', color: '#f5effa', padding: 15, borderRadius: 14, border: '1px solid rgba(232,195,140,.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
    <div className="market-item-main" style={{ textAlign: 'left' }}>
      {marketArt && <img className="market-item-art" src={marketArt} alt="" aria-hidden="true" loading="lazy" />}
      <div className="market-item-copy"><div style={{ fontSize: 16, fontWeight: 'bold' }}>{title}</div>
        {numberData?.number && (type === 'car_number' ? <div style={{ marginTop: 8 }}><CarPlate plate={numberData.number} compact /></div> : <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, letterSpacing: 1, fontVariantNumeric: 'tabular-nums' }}>{numberData.number}</div>)}
        {numberData?.estimated_value && <div style={{ fontSize: 11, color: '#b9acc7', marginTop: 4 }}>{'\u041e\u0446\u0435\u043d\u043a\u0430 \u0433\u043e\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0430'} {'\u00b7'} {Number(numberData.estimated_value).toLocaleString('ru-RU')} {'\u20bd'}</div>}
        <div style={{ fontSize: 12, color: '#b9acc7', marginTop: 4 }}>{'\u041f\u0440\u043e\u0434\u0430\u0432\u0435\u0446'}: {item.seller_name}</div>
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><span style={{ color: '#f2c27f', fontWeight: 'bold', fontFamily: 'Russo One, Impact, sans-serif' }}>{Number(item.price).toLocaleString('ru-RU')} ?</span>
      {item.seller_id !== app.pid ? <Btn variant="primary" onClick={() => app.buyLot(item)} disabled={app.proc} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{'\u041a\u0443\u043f\u0438\u0442\u044c'}</Btn> : <button onClick={() => app.cancelLot(item)} disabled={app.proc} style={{ background: 'transparent', border: 'none', color: '#c0453a', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>{'\u0421\u043d\u044f\u0442\u044c \u0441 \u043f\u0440\u043e\u0434\u0430\u0436\u0438'}</button>}
    </div>
  </div>;
};

export const MarketTab = ({ app }: { app: any }) => {
  const [showTop, setShowTop] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'money' | 'referrals' | 'donations'>('money');
  const [donationPlayers, setDonationPlayers] = useState<any[]>([]);
  const [donationLeaderboardUnavailable, setDonationLeaderboardUnavailable] = useState(false);
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<any>(null);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [shopPurchase, setShopPurchase] = useState<any>(null);
  const [shopQuantity, setShopQuantity] = useState(1);
  useEffect(() => {
    if (!showTop || leaderboardMode !== 'donations') return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'donor_leaderboard', init_data: (window as any).Telegram?.WebApp?.initData || '' }),
        });
        const result = await response.json();
        if (active) {
          setDonationLeaderboardUnavailable(!response.ok);
          if (response.ok) setDonationPlayers(result.players || []);
        }
      } catch {
        if (active) setDonationLeaderboardUnavailable(true);
      }
    })();
    return () => { active = false; };
  }, [showTop, leaderboardMode]);
  const myLots = app.market.filter((m: any) => m.seller_id === app.pid).length;
  const maxSlots = app.marketSlots;
  const topPlayers = leaderboardMode === 'money' ? app.players
    : leaderboardMode === 'referrals' ? app.referralLeaderboard
      : donationPlayers;
  const allPlayerShops = app.businessOffers?.shops || [];
  const businessLocations = app.businessCatalog?.locations || [];
  const districtPlayerShops = allPlayerShops.filter((shop: any) => {
    if (shop.district) return shop.district === app.currentDistrict;
    const location = businessLocations.find((item: any) => String(item.business_id) === String(shop.business_id));
    return location ? districtForLocation(location).id === app.currentDistrict : false;
  });
  const currentDistrictName = DISTRICTS.find(district => district.id === app.currentDistrict)?.name || 'текущий район';

  const openPlayerProfile = async (topPlayer: any) => {
    const targetId = topPlayer.id || topPlayer.player_id;
    if (!targetId) return app.showMsg('Не удалось открыть профиль игрока', true);
    if (String(targetId) === String(app.pid)) return app.handleAvatar();
    setSelectedPublicProfile(null);
    setPublicProfileLoading(true);
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'public_profile',
          target_player_id: targetId,
          init_data: (window as any).Telegram?.WebApp?.initData || '',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.profile) throw new Error(result.error || 'Не удалось загрузить профиль');
      setSelectedPublicProfile(result.profile);
    } catch (error) {
      app.showMsg(error instanceof Error ? error.message : 'Не удалось загрузить профиль', true);
    } finally {
      setPublicProfileLoading(false);
    }
  };

  if (showTop) {
    return (
      <div className="game-tab market-page market-leaderboard" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setShowTop(false)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} color="#b06a15"/>{leaderboardMode === 'money' ? '\u0422\u043e\u043f \u0431\u043e\u0433\u0430\u0447\u0435\u0439' : leaderboardMode === 'referrals' ? '\u0422\u043e\u043f \u043f\u043e \u0440\u0435\u0444\u0435\u0440\u0430\u043b\u0430\u043c' : '\u0422\u043e\u043f \u0434\u043e\u043d\u0430\u0442\u0435\u0440\u043e\u0432'}</h2>
        <div className="market-rank-tabs" style={{ display: 'flex', gap: 4, marginTop: 14, background: '#fbf4e4', padding: 5, borderRadius: 8 }}>
          <button onClick={() => setLeaderboardMode('money')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '9px 4px', border: 0, borderRadius: 7, cursor: 'pointer', background: leaderboardMode === 'money' ? '#b06a15' : 'transparent', color: leaderboardMode === 'money' ? '#fff' : '#6b5f45', fontWeight: 'bold', fontSize: 11 }}><Coins size={14} /> {'\u041f\u043e \u0434\u0435\u043d\u044c\u0433\u0430\u043c'}</button>
          <button onClick={() => setLeaderboardMode('referrals')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '9px 4px', border: 0, borderRadius: 7, cursor: 'pointer', background: leaderboardMode === 'referrals' ? '#c0453a' : 'transparent', color: leaderboardMode === 'referrals' ? '#fff' : '#6b5f45', fontWeight: 'bold', fontSize: 11 }}><Users size={14} /> {'\u0420\u0435\u0444\u0435\u0440\u0430\u043b\u044b'}</button>
          <button onClick={() => setLeaderboardMode('donations')} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '9px 4px', border: 0, borderRadius: 7, cursor: 'pointer', background: leaderboardMode === 'donations' ? '#d59518' : 'transparent', color: leaderboardMode === 'donations' ? '#fff' : '#6b5f45', fontWeight: 'bold', fontSize: 11 }}>⭐ {'\u0414\u043e\u043d\u0430\u0442\u044b'}</button>
        </div>
        <div style={{ marginTop: 20 }}>
          {topPlayers.length === 0 && <p style={{ color: '#6b5f45' }}>{leaderboardMode === 'referrals' && app.referralLeaderboardUnavailable ? '\u0420\u0435\u0439\u0442\u0438\u043d\u0433 \u0440\u0435\u0444\u0435\u0440\u0430\u043b\u043e\u0432 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d' : leaderboardMode === 'donations' && donationLeaderboardUnavailable ? '\u0422\u043e\u043f \u0434\u043e\u043d\u0430\u0442\u0435\u0440\u043e\u0432 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d' : leaderboardMode === 'money' ? '\u041f\u043e\u043a\u0430 \u043d\u0438\u043a\u043e\u0433\u043e...' : leaderboardMode === 'referrals' ? '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u044b\u0445' : '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u043e\u043d\u0430\u0442\u043e\u0432'}</p>}
          {topPlayers.map((p: any, i: number) => {
            const purchasedBackground = ['background_panelka', 'background_brick', 'background_concrete', 'background_night_route'].includes(p.profile_background)
              ? getProfileBackground(p.profile_background) : null;
            const rankBackgroundVars = purchasedBackground ? {
              '--rank-bg-color': purchasedBackground.backgroundColor,
              '--rank-bg-image': purchasedBackground.backgroundImage,
              '--rank-bg-size': purchasedBackground.backgroundSize || 'auto',
              '--rank-bg-position': purchasedBackground.backgroundPosition || '0 0',
              '--rank-bg-repeat': purchasedBackground.backgroundRepeat || 'repeat',
            } : {};
            return <button className={`market-rank-row${purchasedBackground ? ' has-profile-bg' : ''}`} key={p.id || p.player_id || `${p.nickname}-${i}`} type="button" disabled={publicProfileLoading} onClick={() => void openPlayerProfile(p)} title="Открыть профиль" style={{ width: '100%', backgroundColor: '#fbf4e4', ...rankBackgroundVars, padding: '12px 15px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(90,70,40,0.08)', marginBottom: 8, color: '#2f2a1d', cursor: publicProfileLoading ? 'wait' : 'pointer', textAlign: 'left', opacity: publicProfileLoading ? 0.7 : 1 } as any}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 'bold', color: i === 0 ? '#b06a15' : i === 1 ? '#5f43a0' : i === 2 ? '#3d7ea6' : '#6b5f45', minWidth: 26 }}>#{i + 1}</span>
                <span style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{p.nickname}{p.premium_active && <Crown size={14} aria-label="VIP" style={{ color: '#d49b2a', fill: 'rgba(212,155,42,.22)' }} />}{p.season_badge_showcase?.[0] && <span aria-label={SEASON_BADGES[p.season_badge_showcase[0]]?.name || 'Значок сезона'} title={SEASON_BADGES[p.season_badge_showcase[0]]?.name || 'Значок сезона'}>{SEASON_BADGES[p.season_badge_showcase[0]]?.icon || '✦'}</span>}</span>
              </div>
              <span style={{ color: leaderboardMode === 'money' ? '#2c7a3c' : leaderboardMode === 'referrals' ? '#c0453a' : '#b06a15', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>{leaderboardMode === 'money' ? <>{Number(p.money || 0).toLocaleString('ru-RU')} <Coins size={14} /></> : leaderboardMode === 'referrals' ? <>{Number(p.referral_count || 0).toLocaleString('ru-RU')} {'\u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0451\u043d\u043d\u044b\u0445'}</> : <>⭐ {Number(p.stars_total || 0).toLocaleString('ru-RU')} <small>· {Number(p.donation_count || 0)} {'\u043f\u043b\u0430\u0442\u0435\u0436\u0435\u0439'}</small></>}</span>
            </button>;
          })}
        </div>
        <PublicProfileModal
          profile={selectedPublicProfile}
          loading={publicProfileLoading}
          vehicleState={app.vehicleState}
          onClose={() => setSelectedPublicProfile(null)}
        />
      </div>
    );
  }

  return (
    <div className="game-tab market-page" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div className="market-heading" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
        <button 
          onClick={() => setShowTop(true)} 
          title="Топ богачей"
          style={{ background: 'rgba(224,138,46,0.15)', border: '1px solid #b06a15', color: '#b06a15', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Trophy size={16} />
        </button>
        <h2 style={{ margin: 0 }}>Рынок</h2>
      </div>
      
      <div className="market-slot-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div style={{ fontSize: 14, color: '#6b5f45' }}>Твои слоты: <b style={{color: '#2f2a1d'}}>{myLots} / {maxSlots}</b></div>
      </div>
      
      <div className="market-category-tabs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#fbf4e4', padding: 5, borderRadius: 8 }}>
        {['items', 'cars', 'realestate', 'shops'].map((t: any) => (
          <button key={t} onClick={() => app.setMarketTab(t)} style={{ flex: 1, minWidth: 0, padding: '8px 2px', fontSize: 10, whiteSpace: 'nowrap', border: 'none', borderRadius: 12, backgroundColor: app.marketTab === t ? '#3d7ea6' : 'transparent', color: app.marketTab === t ? '#f0f7fb' : '#6b5f45', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
            {t === 'items' ? '\u041f\u0440\u0435\u0434\u043c\u0435\u0442\u044b' : t === 'cars' ? '\u0410\u0432\u0442\u043e' : t === 'realestate' ? '\u0416\u0438\u043b\u044c\u0451' : '\u041c\u0430\u0433\u0430\u0437\u0438\u043d\u044b'}
          </button>
        ))}
      </div>

      {app.marketTab !== 'shops' && (() => {
        const premiumActive = Date.parse(app.premiumUntil || '') > Date.now();
        const marketDay = getDayModifier()?.type === 'market_slots';
        return <div style={{ margin: '-8px 0 14px', padding: '9px 12px', border: '1px solid rgba(61,126,166,.2)', borderRadius: 10, background: 'rgba(61,126,166,.07)', color: '#6b5f45', fontSize: 12 }}>
          {premiumActive
            ? 'Premium: комиссия рынка при продаже твоих лотов — 0%.'
            : marketDay
              ? 'Сегодня на рынке комиссия — 0%.'
              : 'Комиссия рынка при продаже — 5%.'}
        </div>;
      })()}

      {app.marketTab === 'shops' ? <>
        <h3 style={{ color: '#6b5f45', fontSize: 16, marginBottom: 10 }}>Магазины игроков</h3>
        {districtPlayerShops.map((shop: any) => {
          const own = String(shop.owner_id) === String(app.pid);
          const status = shop.status === 'open' ? 'Открыт' : shop.status === 'closed_staff' ? 'Закрыт · нет сотрудника' : 'Закрыт · нет товара';
          return <section key={shop.business_id} style={{ ...S.card, maxWidth: 'none', padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
              <div style={{ textAlign: 'left' }}><b>{shop.business_name}</b><div style={{ fontSize: 12, color: '#6b5f45' }}>Владелец: {shop.owner_name || 'Государство'}{shop.district_name ? ` · ${shop.district_name}` : ''}</div></div>
              <span style={{ fontSize: 11, color: shop.status === 'open' ? '#327b45' : '#a46b21', whiteSpace: 'nowrap' }}>{status}</span>
            </div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {(shop.products || []).map((product: any) => <div key={product.product_id} style={{ padding: 10, borderRadius: 9, background: 'rgba(90,70,40,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                <div><b>{product.product_name}</b><div style={{ fontSize: 12, color: '#6b5f45' }}>Остаток: {product.quantity}</div><strong>{Number(product.retail_price).toLocaleString('ru-RU')} ₽</strong>{String(product.product_id).startsWith('coffee_') && <div style={{ fontSize: 11, color: '#327b45', marginTop: 3 }}>Выпей: +{Number(product.energy_restore) || 0} энергии · +10% к заработку на {coffeeBonusMinutes(product.product_id)} мин</div>}</div>
                <button type="button" disabled={app.proc || own || shop.status !== 'open' || product.quantity < 1} onClick={() => { setShopPurchase({ shop, product }); setShopQuantity(1); }} style={{ border: 0, borderRadius: 8, padding: '9px 12px', color: '#fff', background: own || shop.status !== 'open' ? '#777181' : '#3f9d55', fontWeight: 700, whiteSpace: 'nowrap' }}>{own ? 'Твой магазин' : 'Купить'}</button>
              </div>)}
              {shop.biz_type === 'minimarket' && <div style={{ padding: 10, borderRadius: 9, background: 'rgba(135,89,190,.08)', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><b>Номерной автомат</b><div style={{ fontSize: 12, color: '#6b5f45' }}>Случайный +7 номер · комиссия кассиру, доход магазина облагается налогом</div></div><button type="button" disabled={app.proc || own || shop.status !== 'open' || app.money < 2500} onClick={() => app.spinPhoneNumber(shop.business_id)} style={{ border: 0, borderRadius: 8, padding: '9px 12px', color: '#fff', background: own || shop.status !== 'open' ? '#777181' : '#8150a8', fontWeight: 700, whiteSpace: 'nowrap' }}>Крутить · 2 500 ₽</button></div>
              </div>}
            </div>
          </section>;
        })}
        <h3 style={{ color: '#6b5f45', fontSize: 16, margin: '18px 0 10px' }}>Автомастерские</h3>
        <div style={{ ...S.card, maxWidth: 'none', padding: 14, marginBottom: 12, textAlign: 'left' }}>
          <b>Личная машина</b><div style={{ color: '#6b5f45', fontSize: 12, marginTop: 4 }}>{app.hasCar ? `${app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.model_name || (app.carModel === 'lada' ? 'Ока' : 'Тойота')} · состояние ${app.carHealth}%` : 'Личной машины нет'}</div>
          {(app.businessOffers?.repair_shops || []).map((shop: any) => <div key={shop.business_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid rgba(90,70,40,.12)', paddingTop: 8, marginTop: 8 }}>
            <div><b>{shop.business_name}</b><small style={{ display: 'block', color: shop.status === 'open' ? '#327b45' : '#a46b21' }}>{shop.status === 'open' ? `Механик на месте · владелец ${shop.owner_name}` : 'Закрыта · нет механика'}</small></div>
            {app.hasCar && <button type="button" disabled={app.proc || shop.status !== 'open' || app.carHealth >= 100 || String(shop.owner_id) === String(app.pid)} onClick={() => app.repairPersonalCarAtShop(shop.business_id)} style={{ border: 0, borderRadius: 8, padding: '8px 10px', color: '#fff', background: '#3d7ea6', whiteSpace: 'nowrap' }}>{app.carHealth >= 100 ? 'Исправна' : 'Починить'}</button>}
          </div>)}
          {!(app.businessOffers?.repair_shops || []).length && <small style={{ color: '#6b5f45' }}>Пока нет автомастерских.</small>}
        </div>
        {allPlayerShops.length === 0 && <p style={{ color: '#6b5f45' }}>Магазины появятся после покупки точек у государства.</p>}
        {allPlayerShops.length > 0 && districtPlayerShops.length === 0 && <p style={{ color: '#6b5f45' }}>{businessLocations.length === 0 ? 'Загружаем расположение магазинов…' : `В районе «${currentDistrictName}» пока нет магазинов игроков.`}</p>}
        <Modal open={!!shopPurchase} onClose={() => setShopPurchase(null)}>
          {shopPurchase && <>
            <h3 style={{ marginTop: 0 }}>{shopPurchase.product.product_name}</h3>
            <p style={{ color: '#6b5f45' }}>{shopPurchase.shop.business_name} · {Number(shopPurchase.product.retail_price).toLocaleString('ru-RU')} ₽ за штуку</p>
            {String(shopPurchase.product.product_id).startsWith('coffee_') && <p style={{ color: '#327b45', fontSize: 13, textAlign: 'left' }}>После покупки кофе сразу выпивается и восстанавливает до {Number(shopPurchase.product.energy_restore) || 0} энергии. Также чашка добавляет {coffeeBonusMinutes(shopPurchase.product.product_id)} минут к общему бонусу +10%; время суммируется до 24 часов. Цену задаёт владелец кофейни.</p>}
            <label htmlFor="shop-buy-quantity" style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>Количество</label>
            <input id="shop-buy-quantity" type="number" min={1} max={Math.min(20, Number(shopPurchase.product.quantity))} value={shopQuantity} onChange={event => setShopQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} style={S.input} />
            <p style={{ margin: '0 0 12px', textAlign: 'left' }}>Итого: <b>{(Number(shopPurchase.product.retail_price) * shopQuantity).toLocaleString('ru-RU')} ₽</b></p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setShopPurchase(null)}>Назад</Btn>
              <Btn variant="primary" disabled={app.proc || app.money < Number(shopPurchase.product.retail_price) * shopQuantity || shopQuantity > Number(shopPurchase.product.quantity)} onClick={() => { app.buyBusinessProduct(shopPurchase.shop.business_id, shopPurchase.product.product_id, shopQuantity); setShopPurchase(null); }}>{String(shopPurchase.product.product_id).startsWith('coffee_') ? 'Купить и выпить' : 'Подтвердить покупку'}</Btn>
            </div>
          </>}
        </Modal>

      </> : <>
          {(() => {
            const visibleLots = app.market.filter((m: any) => app.marketTab === 'items'
              ? ['phone', 'phone_number', 'car_number'].includes(m.item_type)
              : m.item_type === (app.marketTab === 'cars' ? 'car' : 'house'));
            const title = app.marketTab === 'items' ? '\u041b\u043e\u0442\u044b (\u041f\u0440\u0435\u0434\u043c\u0435\u0442\u044b)' : app.marketTab === 'cars' ? '\u041b\u043e\u0442\u044b (\u0410\u0432\u0442\u043e)' : '\u041b\u043e\u0442\u044b (\u0416\u0438\u043b\u044c\u0451)';
            return <><h3 style={{ color: '#6b5f45', fontSize: 16, marginBottom: 10 }}>{title}</h3>
              {visibleLots.length === 0 && <p style={{ color: '#6b5f45' }}>{'\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043b\u043e\u0442\u043e\u0432.'}</p>}
              {visibleLots.map((item: any) => <MarketItem key={item.id} item={item} app={app} type={item.item_type} />)}
            </>;
          })()}
        </>}
    </div>
  );
};

const BusinessAuctionEntry = ({ location, app }: any) => {
  const [bid, setBid] = useState(String(Number(location.highest_bid || 0) + 1));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(location.ends_at) - now) / 1000));
  const countdown = `${Math.floor(remaining / 3600)}ч ${Math.floor((remaining % 3600) / 60)}м`;
  const ownAuction = String(location.owner_id) === String(app.pid);
  return <div className="business-auction-entry">
    <small>Ставка: {Number(location.highest_bid).toLocaleString('ru-RU')} ₽ · {remaining ? countdown : 'завершение'}</small>
    {!ownAuction && <div><input aria-label="Сумма ставки" type="number" min={Number(location.highest_bid) + 1} step="1000" value={bid} onChange={event => setBid(event.target.value)} />
      <button disabled={app.proc || Number(bid) <= Number(location.highest_bid)} onClick={() => app.bidBusinessAuction(location.auction_id, Number(bid))}>Ставка</button></div>}
  </div>;
};

export const BusinessTab = ({ app, activeBiz, currentStock }: any) => {
  const [businessView, setBusinessView] = useState<'all' | 'mine'>('all');
  const [passiveNow, setPassiveNow] = useState(Date.now());
  const [salesHistory, setSalesHistory] = useState<any>(null);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [salesHistoryError, setSalesHistoryError] = useState('');
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [auctionPrice, setAuctionPrice] = useState('');
  const [cashAmount, setCashAmount] = useState('1000');
  const [shopPriceDrafts, setShopPriceDrafts] = useState<Record<string, string>>({});
  const [autostockDrafts, setAutostockDrafts] = useState<Record<string, { threshold: string; refill: string }>>({});
  const [restockDrafts, setRestockDrafts] = useState<Record<string, string>>({});
  const businessLocations: any[] = (app.businessCatalog?.locations || []).filter((location: any) =>
    !RETIRED_LOCATION_KEYS.has(location.location_key) || Boolean(location.business_id)
  );
  useEffect(() => {
    const timer = setInterval(() => setPassiveNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    if (!activeBiz || activeBiz.biz_type === 'casino' || !app.pid) {
      setSalesHistory(null);
      setSalesHistoryError('');
      return;
    }
    const refreshSalesHistory = async (showLoading = false) => {
      if (showLoading) setSalesHistoryLoading(true);
      const { data, error } = await app.supabase.rpc('business_sales_history_rpc', {
        p_player_id: app.pid, p_business_id: activeBiz.id, p_limit: 30,
      });
      if (disposed) return;
      if (error || data?.error) setSalesHistoryError(error?.message || data?.error || 'Не удалось загрузить историю');
      else { setSalesHistory(data); setSalesHistoryError(''); }
      if (showLoading) setSalesHistoryLoading(false);
    };
    void refreshSalesHistory(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshSalesHistory();
    }, 10 * 60_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [activeBiz?.id, activeBiz?.biz_type, app.pid, app.supabase]);

  const getBizName = (type: string) => ({ coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк', construction: 'Стройтрест', minimarket: 'Мини-маркет', auto_repair: 'Автомастерская', casino: 'Казино' }[type] || 'Бизнес');

  const bizWorkers = app.allWorkers?.filter((w: any) => w.business_id === activeBiz?.id) || [];
  const salonHasSeller = bizWorkers.some((worker: any) => worker.role === 'Продавец');
  const carOrderTotal = (price: number, amount: number) => {
    const subtotal = price * amount;
    return salonHasSeller ? subtotal : subtotal + Math.floor(subtotal * 0.1);
  };
  const salonClass = activeBiz?.location_key === 'salon_mid' ? 'mid' : activeBiz?.location_key === 'salon_high' ? 'high' : 'low';
  const salonModels = (app.vehicleState?.models || []).filter((model: any) => model.salon_class === salonClass);
  const vehicleName = (modelId: string) => app.vehicleState?.models?.find((model: any) => model.model_id === modelId)?.model_name || modelId;
  const vehicleRepairPrice = (modelId: string) => Number(app.vehicleState?.models?.find((model: any) => model.model_id === modelId)?.repair_price || (modelId === 'lada' ? TAXI_REPAIR_LADA : TAXI_REPAIR_TOYOTA));
  const passiveTiers = activeBiz ? BUSINESS_PASSIVE_TIERS[activeBiz.biz_type as keyof typeof BUSINESS_PASSIVE_TIERS] : null;
  const activeLease = app.businessCatalog?.locations?.find((location: any) => String(location.business_id) === String(activeBiz?.id) && location.lease_active);
  const passiveLevel = Math.max(-1, Math.min(3, Number(activeBiz?.passive_level ?? -1)));
  const nextPassiveTier = passiveTiers?.[passiveLevel + 1];
  const passiveCarCount = activeBiz?.biz_type === 'taxi' ? (getStock(activeBiz).taxi_cars?.length || 0) : 1;
  const passiveHasStaff = activeBiz?.biz_type !== 'taxi' || bizWorkers.length > 0;
  const passiveRate = passiveLevel >= 0 && passiveTiers ? passiveTiers[passiveLevel].incomePerMinute : 0;
  const passiveUpdatedAt = Date.parse(activeBiz?.passive_updated_at || '');
  const passiveElapsedMinutes = passiveLevel >= 0 && passiveHasStaff && Number.isFinite(passiveUpdatedAt)
    ? Math.max(0, Math.floor((passiveNow - passiveUpdatedAt) / 60000))
    : 0;
  const passivePending = Number(activeBiz?.passive_balance || 0) + passiveElapsedMinutes * passiveRate * passiveCarCount;
  const passiveUpgradeFunds = activeLease ? Number(activeBiz?.cash_balance || 0) : Number(app.money || 0);
  const activeBusinessArt = BUSINESS_ART[activeBiz?.biz_type];

  return (
    <div className="business-page" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button><h2>Бизнесы</h2>
      <p style={{ margin: '-8px 0 14px', padding: '9px 11px', borderRadius: 10, background: 'rgba(61,126,166,.08)', color: '#6b5f45', fontSize: 12, lineHeight: 1.4 }}>Налог на доход бизнеса — 13% с обычных и пассивных начислений. Пополнение кассы своими деньгами налогом не облагается.</p>
      {activeBiz && activeBusinessArt && <section className="business-scene-banner" aria-label={`${getBizName(activeBiz.biz_type)} в вечернем городе`} style={{ '--business-scene-image': `url('${activeBusinessArt}')` } as React.CSSProperties}><div><span>СВОЁ ДЕЛО В ГОРОДЕ</span><b>{activeBiz.business_name}</b></div></section>}

      <div role="tablist" aria-label="Разделы бизнеса" style={{ display: 'flex', gap: 6, padding: 5, marginBottom: 18, borderRadius: 10, background: 'rgba(90,70,40,.08)' }}>
        {([{ id: 'all', label: 'Все' }, { id: 'mine', label: `Мои (${app.myBizs.length})` }] as const).map(item => <button key={item.id} type="button" role="tab" aria-selected={businessView === item.id} onClick={() => setBusinessView(item.id)} style={{ flex: 1, padding: 10, border: 0, borderRadius: 7, cursor: 'pointer', fontWeight: 700, background: businessView === item.id ? '#fbf4e4' : 'transparent', color: '#2f2a1d', boxShadow: businessView === item.id ? '0 1px 4px rgba(50,40,25,.12)' : 'none' }}>{item.label}</button>)}
      </div>

      {businessView === 'mine' && <>
      <section className="business-location-catalog" style={{ marginBottom: 18 }}>
        <div className="business-catalog-heading"><div><h3>Мои бизнесы</h3><span>{app.myBizs.length} / 3</span></div></div>
        {app.myBizs.length ? app.myBizs.map((business: any) => <button key={business.id} type="button" onClick={() => { app.setActiveBizType(business.biz_type); app.setActiveBizId(business.id); }} className="business-location-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: '#2f2a1d', background: String(activeBiz?.id) === String(business.id) ? 'rgba(61,126,166,.12)' : undefined }}>
          {BUSINESS_ART[business.biz_type] && <img className="business-location-thumb" src={BUSINESS_ART[business.biz_type]} alt="" aria-hidden="true" loading="lazy" />}
          <span className="business-location-info"><b>{business.business_name}</b><small>{getBizName(business.biz_type)}{String(activeBiz?.id) === String(business.id) ? ' · выбрано' : ''}</small></span>
          <span className="business-location-action">Открыть</span>
        </button>) : <p style={{ margin: 12, color: '#6b5f45', fontSize: 13 }}>У тебя пока нет бизнеса. Найди свободную точку во вкладке «Все».</p>}
      </section>
      </>}

      {businessView === 'all' && <section className="business-location-catalog">
        <div className="business-catalog-heading"><div><h3>Точки бизнеса</h3><span>В собственности: {app.businessCatalog?.owned_count ?? app.myBizs.length} / 3</span></div><button onClick={app.loadBusinessCatalog} aria-label="Обновить список"><RefreshCw size={17} /></button></div>
        {DISTRICTS.map((district) => {
          const districtLocations = businessLocations.filter((location: any) => districtForLocation(location).id === district.id);
          if (!districtLocations.length) return null;
          return <div key={district.id} style={{ marginTop: 12 }}>
          <div style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(61,126,166,.09)', color: '#3d7ea6', fontWeight: 800, fontSize: 13 }}>{district.name} <span style={{ fontWeight: 500, opacity: .8 }}>· {districtLocations.length} точек</span></div>
          {districtLocations.map((location: any) => {
          const leased = location.status === 'leased';
          const owned = location.status === 'owned' || leased;
          const stateOwned = location.state_owned === true;
          const available = location.status === 'available';
          const purchasable = ['coffee','salon','taxi','construction','minimarket','auto_repair','casino'].includes(location.biz_type);
          const leaseEligible = ['coffee','minimarket','salon','taxi','auto_repair'].includes(location.biz_type);
          const alreadyOwnType = (app.myBizs || []).some((business: any) => business.biz_type === location.biz_type);
          const businessArt = BUSINESS_ART[location.biz_type];
          const price = location.price == null ? null : Number(location.price);
          const leaseDownPayment = price == null ? null : Math.ceil(price * 0.25);
          return <div key={location.location_key} className="business-location-row">
            {businessArt && <img className="business-location-thumb" src={businessArt} alt="" aria-hidden="true" loading="lazy" />}
            <div className="business-location-info"><b>{location.business_name}</b><small>{district.name} · {leased ? `В аренде с выкупом · осталось ${Number(location.lease_remaining).toLocaleString('ru-RU')} ₽` : owned ? 'Твой бизнес' : available ? 'Свободно у государства' : `Владелец: ${location.owner_name || 'занято'}`}</small></div>
            <div className="business-location-action" style={available && leaseEligible ? { display: 'grid', gap: 5, textAlign: 'right' } : undefined}>
              {owned ? <button onClick={() => { app.setActiveBizType(location.biz_type); app.setActiveBizId(location.business_id); setBusinessView('mine'); }}>Управлять</button>
                : available && purchasable && price != null ? alreadyOwnType ? <span>У тебя уже есть бизнес этого типа</span> : <>
                  {!stateOwned && <button disabled={app.proc || app.businessCatalog?.owned_count >= 3 || app.money < price} onClick={() => app.purchaseBusinessLocation(location.location_key)}>Купить · {price.toLocaleString('ru-RU')} ₽</button>}
                  {leaseEligible && <button title="Взнос 25%; половина выручки пойдёт в выкуп" disabled={app.proc || app.businessCatalog?.owned_count >= 3 || app.money < Number(leaseDownPayment)} onClick={() => {
                    if (!window.confirm(`Внести ${Number(leaseDownPayment).toLocaleString('ru-RU')} ₽ (25%)? Половина учитываемой выручки бизнеса будет идти в выкуп.`)) return;
                    app.leaseBusinessLocation(location.location_key);
                  }}>Аренда · {Number(leaseDownPayment).toLocaleString('ru-RU')} ₽</button>}
                </>
                : location.status === 'auction' ? <BusinessAuctionEntry location={location} app={app} />
                : <span>{price == null ? 'Цена не задана' : !purchasable ? 'Готовится' : 'Занято'}</span>}
            </div>
          </div>;
        })}
        </div>;
        })}
      </section>}

      <Modal open={auctionOpen} onClose={() => setAuctionOpen(false)} contentStyle={{ maxWidth: 360 }}>
        <h3 style={{ marginTop: 0 }}>Выставить бизнес на торги</h3>
        <p style={{ color: '#6b5f45', fontSize: 13 }}>Торги идут 24 часа. Ставка покупателя резервируется, а при перебивании возвращается.</p>
        <label style={{ display: 'block', textAlign: 'left', fontSize: 12, marginBottom: 6 }}>Начальная цена, ₽</label>
        <input type="number" min="1" step="1000" value={auctionPrice} onChange={event => setAuctionPrice(event.target.value)} style={S.input} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setAuctionOpen(false)}>Отмена</Btn>
          <Btn variant="primary" disabled={app.proc || Number(auctionPrice) < 1} onClick={() => { app.createBusinessAuction(activeBiz.id, Number(auctionPrice)); setAuctionOpen(false); }}>Начать торги</Btn>
        </div>
      </Modal>

      {businessView === 'mine' && (activeBiz ? (
        <div style={S.card}>
          <section style={{ marginBottom: 18, padding: 13, borderRadius: 10, background: 'rgba(61,126,166,.08)', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>Касса бизнеса</b><strong>{Number(activeBiz.cash_balance || 0).toLocaleString('ru-RU')} ₽</strong></div>
            <label htmlFor="business-cash-amount" style={{ display: 'block', fontSize: 12, margin: '10px 0 5px', color: '#6b5f45' }}>Сумма пополнения или снятия</label>
            <input id="business-cash-amount" type="number" min="1" max="10000000" value={cashAmount} onChange={event => setCashAmount(event.target.value)} style={{ ...S.input, marginBottom: 8, padding: 10, fontSize: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" disabled={app.proc || Number(cashAmount) < 1 || app.money < Number(cashAmount)} onClick={() => app.transferBusinessCash(activeBiz.id, Number(cashAmount), 'deposit')}>Внести</Btn>
              <Btn variant="secondary" disabled={app.proc || Number(cashAmount) < 1 || Number(activeBiz.cash_balance || 0) < Number(cashAmount)} onClick={() => app.transferBusinessCash(activeBiz.id, Number(cashAmount), 'withdraw')}>Снять</Btn>
            </div>
          </section>

          {activeLease && <section style={{ marginBottom: 16, padding: 13, borderRadius: 10, background: 'rgba(61,126,166,.08)', border: '1px solid rgba(61,126,166,.25)', textAlign: 'left' }}>
            <b>Аренда с выкупом</b>
            <p style={{ margin: '7px 0', fontSize: 12 }}>Внесено: {Number(activeLease.lease_down_payment).toLocaleString('ru-RU')} ₽ · выкуплено с продаж: {Number(activeLease.lease_paid_from_sales).toLocaleString('ru-RU')} ₽</p>
            <div style={{ height: 7, overflow: 'hidden', borderRadius: 99, background: 'rgba(61,126,166,.18)' }}><div style={{ width: `${Math.min(100, Math.max(0, (Number(activeLease.lease_price) - Number(activeLease.lease_remaining)) / Number(activeLease.lease_price) * 100))}%`, height: '100%', background: '#3d9b72' }} /></div>
            <b style={{ display: 'block', marginTop: 7 }}>Осталось выкупить {Number(activeLease.lease_remaining).toLocaleString('ru-RU')} ₽</b>
            <small style={{ display: 'block', marginTop: 4, color: '#6b5f45' }}>50% учитываемой выручки автоматически идёт в выкуп; в кассе остаётся вторая половина.</small>
            <small style={{ display: 'block', marginTop: 5, color: '#6b5f45' }}>До полного выкупа бизнес нельзя продать государству, выставить на торги или заложить.</small>
            <Btn variant="secondary" disabled={app.proc || app.money < Number(activeLease.lease_remaining)} onClick={() => {
              if (!window.confirm(`Полностью выкупить бизнес за ${Number(activeLease.lease_remaining).toLocaleString('ru-RU')} ₽?`)) return;
              app.finishBusinessLease(activeBiz.id);
            }} style={{ marginTop: 10, width: '100%' }}>Выкупить остаток · {Number(activeLease.lease_remaining).toLocaleString('ru-RU')} ₽</Btn>
          </section>}

          {activeBiz.biz_type !== 'casino' && <section style={{ marginBottom: 16, padding: 13, borderRadius: 10, background: 'rgba(63,157,85,.07)', border: '1px solid rgba(63,157,85,.18)', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <b>История продаж</b>
              {!salesHistoryLoading && salesHistory && <small style={{ color: '#2c7a3c' }}>{Number(salesHistory.sales_count || 0)} продаж</small>}
            </div>
            {salesHistoryLoading ? <p style={{ margin: '9px 0 0', color: '#6b5f45', fontSize: 12 }}>Загружаю историю…</p>
              : salesHistoryError ? <p style={{ margin: '9px 0 0', color: '#b83229', fontSize: 12 }}>{salesHistoryError}</p>
                : <>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: '#2c7a3c' }}>{Number(salesHistory?.total_sales || 0).toLocaleString('ru-RU')} ₽ <small style={{ fontSize: 11, fontWeight: 500, color: '#6b5f45' }}>выручка всего</small></div>
                  <small style={{ display: 'block', marginTop: 3, color: '#6b5f45' }}>Записи ведутся с момента установки истории продаж.</small>
                  {salesHistory?.sales?.length ? <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                    {salesHistory.sales.slice(0, 10).map((sale: any) => <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid rgba(47,122,60,.12)' }}>
                      <div><b style={{ display: 'block', fontSize: 12 }}>{({ coffee_sale: 'Продажа кофе', retail_sale: 'Продажа товара', vehicle_sale: 'Продажа автомобиля', repair_sale: 'Ремонт автомобиля', taxi_sale: 'Поездка такси', taxi_fleet_income: 'Доход автопарка', business_sale: 'Продажа' } as Record<string,string>)[sale.event_type] || 'Продажа'}</b><small style={{ color: '#6b5f45', fontSize: 10 }}>{new Date(sale.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>
                      <b style={{ color: '#2c7a3c', whiteSpace: 'nowrap' }}>+{Number(sale.amount).toLocaleString('ru-RU')} ₽</b>
                    </div>)}
                  </div> : <p style={{ margin: '9px 0 0', color: '#6b5f45', fontSize: 12 }}>Продаж пока нет — записи появятся после первых поступлений от клиентов.</p>}
                </>}
          </section>}

          {activeBiz.biz_type === 'casino' && (() => {
            const casino = app.businessOffers?.casinoBusiness || { level: 1, share_percent: 5, next_cost: 20000000 };
            return <section style={{ marginBottom: 16, padding: 13, borderRadius: 10, background: 'linear-gradient(135deg, rgba(145,45,74,.13), rgba(255,170,40,.12))', border: '1px solid rgba(145,45,74,.25)', textAlign: 'left' }}>
              <b>Доход казино · уровень {casino.level}/3</b>
              <p style={{ margin: '6px 0 10px', color: '#6b5f45', fontSize: 13 }}>Получаешь {casino.share_percent}% с каждой принятой ставки. Твои собственные ставки комиссией не облагаются.</p>
              {casino.next_cost != null
                ? <button type="button" disabled={app.proc || Number(activeBiz.cash_balance || 0) < Number(casino.next_cost)} onClick={() => app.upgradeCasinoBusiness(activeBiz.id)} style={{ width: '100%', border: 0, borderRadius: 8, padding: 10, background: '#ff9824', fontWeight: 700 }}>Улучшить · {Number(casino.next_cost).toLocaleString('ru-RU')} ₽ из кассы</button>
                : <b style={{ color: '#3f9d55' }}>Максимальный уровень</b>}
            </section>;
          })()}

          {app.activeBizType === 'salon' && (<>
              <p style={{ color: '#6b5f45', fontSize: 13, margin: '5px 0 12px' }}>Класс автосалона: <b>{salonClass === 'low' ? 'низкий' : salonClass === 'mid' ? 'средний' : 'высокий'}</b>. Заказы списываются из кассы бизнеса.</p>
              {app.carOrderEnd > 0 ? (<div style={{ background: 'rgba(61,126,166,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(61,126,166,0.25)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#3d7ea6' }}>Едут: <b>{vehicleName(currentStock.current_model || '')} ×{currentStock.order_amount || 1}</b></p><p style={{ margin: 0, fontSize: 22, color: '#3d7ea6', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.carTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'grid', gap: 8, marginBottom: 15 }}>
                  {salonModels.map((model: any) => {
                    const amount = Number(currentStock[model.model_id] || 0);
                    const orderMinutes = Math.round(Number(model.order_ms) / 60000);
                    return <div key={model.model_id} className="business-car-stock-row" style={{ padding: 10, borderRadius: 10, background: 'rgba(90,70,40,.06)', textAlign: 'left' }}>
                      <VehicleArtwork modelId={model.model_id} />
                      <div className="business-car-stock-info"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{model.model_name}</b><span>На складе: {amount}</span></div>
                      <small style={{ color: '#6b5f45' }}>Закупка {Number(model.base_price).toLocaleString('ru-RU')} ₽ · поставка {orderMinutes} мин.</small></div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{[1, 5, 10].map(n => <Btn key={n} variant="secondary" onClick={() => app.orderCar(model.model_id, n)} disabled={app.proc || Number(activeBiz.cash_balance || 0) < carOrderTotal(Number(model.base_price), n)} style={{ flex: 1, padding: 7, fontSize: 11 }}>×{n} · {carOrderTotal(Number(model.base_price), n).toLocaleString('ru-RU')} ₽</Btn>)}</div>
                      {amount > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('car'); app.setSellItemData(model.model_id); app.setSellPrice(String(Number(model.base_price))); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginTop: 7, width: '100%' }}><Car size={16}/> Выставить на рынок</Btn>}
                    </div>;
                  })}
                </div>)}
          </>)}
          
          {app.activeBizType === 'construction' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Склад квартир: <b>{currentStock.apartments || 0} шт.</b></p>
              {app.buildEnd > 0 ? (<div style={{ background: 'rgba(224,138,46,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(249, 115, 22, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#b06a15' }}>Строится дом...</p><p style={{ margin: 0, fontSize: 22, color: '#b06a15', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.buildTimeLeft} сек.</p></div>)
              : (<Btn variant="secondary" onClick={app.startBuild} disabled={app.proc || app.money < BUILDING_PRICE} style={{ background: 'rgba(224,138,46,0.10)', color: '#b06a15', border: '1px solid #b06a15', marginBottom: 15 }}><Hammer size={20}/> Построить дом ({BUILDING_PRICE.toLocaleString('ru-RU')})</Btn>)}
              {currentStock.apartments > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('house'); app.setSellItemData('apartment'); app.setSellPrice(String(DEFAULT_SELL_APARTMENT)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Building size={18}/> Продать квартиру</Btn>}
          </>)}

          {app.activeBizType === 'phone_factory' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Склад: <b>Кнопочные ({currentStock.button || 0}) | Смартфоны ({currentStock.smartphone || 0})</b></p>
              {app.phoneProdEnd > 0 ? (<div style={{ background: 'rgba(122,92,184,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(139, 92, 246, 0.2)', textAlign: 'center' }}><p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#5f43a0' }}>Производится партия...</p><p style={{ margin: 0, fontSize: 22, color: '#5f43a0', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.phoneProdTimeLeft} сек.</p></div>)
              : (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}><Btn variant="secondary" onClick={() => app.orderPhones('button')} disabled={app.proc || app.money < BUTTON_BATCH_COST} style={{ background: 'rgba(90,70,40,0.08)', color: '#6b5f45', border: '1px solid rgba(90,70,40,0.3)', display: 'flex', justifyContent: 'space-between' }}><span>Кнопочные ({BUTTON_BATCH_SIZE} шт.)</span><span>{BUTTON_BATCH_COST.toLocaleString('ru-RU')}</span></Btn><Btn variant="secondary" onClick={() => app.orderPhones('smartphone')} disabled={app.proc || app.money < SMARTPHONE_BATCH_COST} style={{ background: 'rgba(90,70,40,0.08)', color: '#6b5f45', border: '1px solid rgba(90,70,40,0.3)', display: 'flex', justifyContent: 'space-between' }}><span>Смартфоны ({SMARTPHONE_BATCH_SIZE} шт.)</span><span>{SMARTPHONE_BATCH_COST.toLocaleString('ru-RU')}</span></Btn></div>)}
              {currentStock.button > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('button'); app.setSellPrice(String(DEFAULT_SELL_BUTTON)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Phone size={18}/> Продать кнопочный</Btn>}
              {currentStock.smartphone > 0 && <Btn variant="primary" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('smartphone'); app.setSellPrice(String(DEFAULT_SELL_SMARTPHONE)); app.setSellSource('stock'); app.setSellOpen(true); }} style={{ marginBottom: 10 }}><Smartphone size={18}/> Продать смартфон</Btn>}
          </>)}

          {app.activeBizType === 'taxi' && (<>
              <p style={{ color: '#6b5f45', fontSize: 15, margin: '5px 0 15px 0' }}>Машин в парке: <b>{currentStock.taxi_cars?.length || 0}</b> · водителей: <b>{app.allWorkers?.filter((w: any) => w.business_id === activeBiz.id && w.role === 'Водитель').length || 0}</b><small style={{ display: 'block', marginTop: 4, fontSize: 12 }}>Одна машина на одного водителя — найми водителей, чтобы расширить парк.</small></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
                {currentStock.taxi_cars?.map((car: any, i: number) => (
                  <div key={i} className="taxi-fleet-car" style={{ background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12 }}>
                    <VehicleArtwork modelId={car.model} />
                    <div className="taxi-fleet-info"><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontWeight: 'bold' }}>{car.model_name || vehicleName(car.model)}</span><span style={{ color: car.health > 50 ? '#3f9d55' : car.health > 0 ? '#b06a15' : '#c0453a' }}>{car.health}%</span></div>{car.plate && <CarPlate plate={car.plate} compact />}
                    {car.health < 100 && <div style={{ marginTop: 7, display: 'grid', gap: 5 }}>
                      {(app.businessOffers?.repair_shops || []).map((shop: any) => <button key={shop.business_id} type="button" disabled={app.proc || shop.status !== 'open' || Number(activeBiz.cash_balance || 0) < vehicleRepairPrice(car.model)} onClick={() => app.repairTaxiCarAtShop(shop.business_id, activeBiz.id, i)} style={{ border: '1px solid #3d7ea6', borderRadius: 8, padding: 8, background: 'rgba(61,126,166,.08)', color: '#2f6a94', textAlign: 'left' }}>В {shop.business_name} · ремонт {vehicleRepairPrice(car.model).toLocaleString('ru-RU')} ₽ {shop.status !== 'open' ? '· закрыта' : `· касса ${Number(activeBiz.cash_balance || 0).toLocaleString('ru-RU')} ₽`}</button>)}
                      {!(app.businessOffers?.repair_shops || []).length && <small style={{ color: '#6b5f45' }}>Для ремонта нужна автомастерская с механиком.</small>}
                    </div>}
                    </div>
                  </div>
                ))}
              </div>
              <Btn variant="primary" onClick={app.collectTaxi} disabled={app.proc || !currentStock.taxi_cars?.length || !app.allWorkers?.some((w: any) => w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id && w.role === 'Водитель')} style={{ marginBottom: 10 }}>{!currentStock.taxi_cars?.length ? 'Нет машин' : !app.allWorkers?.some((w: any) => w.role === 'Водитель' && w.business_id === app.myBizs.find((b: any) => b.biz_type === 'taxi')?.id) ? 'Нужен водитель' : 'Собрать доход'}</Btn>
              <p style={{ fontSize: 12, color: '#6b5f45', marginBottom: 5 }}>Покупка машины у автосалона · оплачивается из кассы парка:</p>
              {(app.vehicleState?.dealers || []).map((dealer: any) => {
                const offers = (dealer.models || []).filter((model: any) => model.quantity > 0);
                if (!offers.length) return null;
                return <section key={dealer.business_id} style={{ padding: 10, marginBottom: 8, borderRadius: 10, background: 'rgba(90,70,40,.06)', textAlign: 'left' }}>
                  <b>{dealer.business_name}</b><small style={{ display: 'block', color: '#6b5f45' }}>Владелец: {dealer.owner_name || 'игрок'} · класс {dealer.salon_class === 'low' ? 'низкий' : dealer.salon_class === 'mid' ? 'средний' : 'высокий'}</small>
                  {offers.map((model: any) => <button key={model.model_id} type="button" disabled={app.proc || (currentStock.taxi_cars?.length || 0) >= (app.allWorkers?.filter((w: any) => w.business_id === activeBiz.id && w.role === 'Водитель').length || 0) || Number(activeBiz.cash_balance || 0) < Number(model.base_price) || String(dealer.owner_id) === String(app.pid)} onClick={() => app.buyTaxiVehicle(dealer.business_id, model.model_id)} className="taxi-dealer-offer" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, padding: 8, border: '1px solid #3d7ea6', borderRadius: 8, background: '#fffaf0', color: '#2f2a1d', textAlign: 'left' }}><VehicleArtwork modelId={model.model_id} /><span>{model.model_name} · {model.quantity} шт.</span><b>{Number(model.base_price).toLocaleString('ru-RU')} ₽</b></button>)}
                </section>;
              })}
              {(app.vehicleState?.dealers || []).length === 0 && <small style={{ color: '#6b5f45' }}>Нет автосалонов с машинами в наличии.</small>}
          </>)}
          
          {app.activeBizType === 'coffee' && (
            <div style={{ marginTop: 15 }}>
              <p style={{ fontSize: 14, color: '#6b5f45', marginBottom: 10 }}>Касса кафе: <b style={{ color: '#3f9d55', fontSize: 18, fontFamily: 'Russo One' }}>{activeBiz.coffee_balance || 0}</b> монет</p>
              <Btn variant="primary" onClick={app.collect} disabled={app.proc || !activeBiz.coffee_balance} style={{ marginBottom: 15 }}>Собрать кассу</Btn>
            </div>
          )}

          {['coffee','minimarket'].includes(activeBiz.biz_type) && (() => {
            const products = (app.businessOffers?.shops || []).find((shop: any) => shop.business_id === activeBiz.id)?.products || [];
            const autostock = (app.businessOffers?.autostock || []).find((item: any) => item.business_id === activeBiz.id) || { slots: 0, rules: [] };
            const rules = autostock.rules || [];
            const enabledRules = rules.filter((rule: any) => rule.enabled).length;
            return <section style={{ marginTop: 18, textAlign: 'left' }}>
              <h3 style={{ margin: '0 0 8px' }}>Товары и склад</h3>
              <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 10px' }}>Закупка списывается из кассы. Цена для игроков — от 75% до 125% базовой.</p>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,153,36,.10)', border: '1px solid rgba(255,153,36,.35)', marginBottom: 12 }}>
                <b>Автопополнение · {autostock.slots}/3 слота куплено</b>
                <p style={{ margin: '5px 0 9px', color: '#6b5f45', fontSize: 12 }}>Раз в минуту проверяет остатки и закупает товар из кассы бизнеса, когда он опустится до порога. Слоты и правила привязаны к бизнесу: при продаже на торгах они сохранятся у нового владельца.</p>
                {autostock.slots < 3 && <button type="button" disabled={app.proc || app.premiumBalance < 99} onClick={() => app.donateAction('purchase_autostock', { business_id: activeBiz.id })} style={{ border: 0, borderRadius: 8, padding: '9px 12px', background: '#ff9824', fontWeight: 700 }}>Купить слот · 99 жетонов</button>}
                {autostock.slots === 0 && <small style={{ display: 'block', marginTop: 6, color: '#6b5f45' }}>Один слот включает автопополнение одного товара. До трёх слотов на бизнес.</small>}
              </div>
              {products.map((product: any) => {
                const draft = shopPriceDrafts[product.product_id] ?? String(product.retail_price);
                const rule = rules.find((item: any) => item.product_id === product.product_id && item.enabled);
                const autoDraft = autostockDrafts[product.product_id] || { threshold: String(rule?.threshold ?? 200), refill: String(rule?.refill_quantity ?? 600) };
                const restockDraft = restockDrafts[product.product_id] ?? '50';
                const restockQuantity = Number(restockDraft);
                const validRestockQuantity = Number.isSafeInteger(restockQuantity) && restockQuantity >= 1 && restockQuantity <= 500;
                const restockQuote = (quantity: number) => {
                  const baseCost = Number(product.wholesale_price) * quantity;
                  const discountPercent = bulkRestockDiscountPercent(quantity);
                  const discountAmount = Math.floor(baseCost * discountPercent / 100);
                  return { baseCost, discountPercent, discountAmount, cost: baseCost - discountAmount };
                };
                const customRestock = restockQuote(validRestockQuantity ? restockQuantity : 0);
                const autoRefill = restockQuote(Number(autoDraft.refill) || 0);
                const quickRestockAmounts = [50, 100, 250, 500];
                return <div key={product.product_id} style={{ padding: 11, borderRadius: 10, background: 'rgba(90,70,40,.06)', marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{product.product_name}</b><span>На складе: {product.quantity}</span></div>
                  <small style={{ color: '#6b5f45' }}>Опт {Number(product.wholesale_price).toLocaleString('ru-RU')} ₽/шт.</small>
                  <label style={{ display: 'block', fontSize: 12, margin: '8px 0 4px' }}>Цена игроку · {product.min_price}–{product.max_price} ₽</label>
                  <input aria-label={`Цена ${product.product_name}`} type="range" min={product.min_price} max={product.max_price} value={Math.max(Number(product.min_price), Math.min(Number(product.max_price), Number(draft) || Number(product.retail_price)))} onChange={event => setShopPriceDrafts(current => ({ ...current, [product.product_id]: event.target.value }))} style={{ width: '100%', accentColor: '#3d7ea6' }} />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input type="number" min={product.min_price} max={product.max_price} value={draft} onChange={event => setShopPriceDrafts(current => ({ ...current, [product.product_id]: event.target.value }))} style={{ ...S.input, flex: 1, margin: 0, padding: 9, fontSize: 15 }} />
                    <button type="button" disabled={app.proc || Number(draft) === Number(product.retail_price)} onClick={() => app.setBusinessProductPrice(activeBiz.id, product.product_id, Number(draft))} style={{ border: 0, borderRadius: 8, padding: '0 12px', color: '#fff', background: '#3d7ea6', fontWeight: 700 }}>Сохранить</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 8 }}>
                    {quickRestockAmounts.map(quantity => {
                      const quote = restockQuote(quantity);
                      return <button key={quantity} type="button" disabled={app.proc || Number(activeBiz.cash_balance || 0) < quote.cost} onClick={() => app.restockBusinessProduct(activeBiz.id, product.product_id, quantity)} style={{ border: '1px solid #3d7ea6', borderRadius: 8, padding: 8, color: '#2f6a94', background: 'rgba(61,126,166,.08)', fontSize: 11 }}>+{quantity} · {quote.cost.toLocaleString('ru-RU')} ₽{quote.discountPercent > 0 ? ` (−${quote.discountPercent}%)` : ''}</button>;
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 7, alignItems: 'end', marginTop: 8 }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Своё количество · 1–500
                      <input aria-label={`Количество закупки: ${product.product_name}`} type="number" inputMode="numeric" min={1} max={500} step={1} value={restockDraft} onChange={event => setRestockDrafts(current => ({ ...current, [product.product_id]: event.target.value }))} style={{ ...S.input, margin: 0, padding: 9, fontSize: 15 }} />
                    </label>
                    <button type="button" disabled={app.proc || !validRestockQuantity || Number(activeBiz.cash_balance || 0) < customRestock.cost} onClick={() => app.restockBusinessProduct(activeBiz.id, product.product_id, restockQuantity)} style={{ border: 0, borderRadius: 8, padding: '10px 12px', color: '#fff', background: '#3d7ea6', fontWeight: 700 }}>Закупить</button>
                    <small style={{ gridColumn: '1 / -1', color: Number(activeBiz.cash_balance || 0) < customRestock.cost ? '#b33a32' : '#6b5f45' }}>{validRestockQuantity ? `Итого: ${customRestock.cost.toLocaleString('ru-RU')} ₽ из кассы${customRestock.discountPercent ? ` · скидка ${customRestock.discountPercent}% (−${customRestock.discountAmount.toLocaleString('ru-RU')} ₽)` : ''}` : 'Введи целое количество от 1 до 500.'}{validRestockQuantity && Number(activeBiz.cash_balance || 0) < customRestock.cost ? ' · Не хватает денег в кассе.' : ''}</small>
                  </div>
                  <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(90,70,40,.12)' }}>
                    <b style={{ fontSize: 13 }}>Автопополнение {rule ? '· включено' : ''}</b>
                    <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                      <label style={{ flex: 1, fontSize: 11 }}>Порог
                        <input type="number" min="0" value={autoDraft.threshold} onChange={event => setAutostockDrafts(current => ({ ...current, [product.product_id]: { ...autoDraft, threshold: event.target.value } }))} style={{ ...S.input, margin: '3px 0 0', padding: 8, fontSize: 14 }} />
                      </label>
                      <label style={{ flex: 1, fontSize: 11 }}>Закупить
                        <input type="number" min="1" value={autoDraft.refill} onChange={event => setAutostockDrafts(current => ({ ...current, [product.product_id]: { ...autoDraft, refill: event.target.value } }))} style={{ ...S.input, margin: '3px 0 0', padding: 8, fontSize: 14 }} />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                      <button type="button" disabled={app.proc || (!rule && enabledRules >= autostock.slots) || !Number.isSafeInteger(Number(autoDraft.threshold)) || !Number.isSafeInteger(Number(autoDraft.refill)) || Number(autoDraft.refill) <= Number(autoDraft.threshold)} onClick={() => app.configureBusinessAutostock(activeBiz.id, product.product_id, Number(autoDraft.threshold), Number(autoDraft.refill), true)} style={{ flex: 1, border: 0, borderRadius: 7, padding: 8, background: '#ff9824', fontWeight: 700 }}>{rule ? 'Сохранить' : 'Включить'}</button>
                      {rule && <button type="button" disabled={app.proc} onClick={() => app.configureBusinessAutostock(activeBiz.id, product.product_id, 0, 1, false)} style={{ border: '1px solid #aaa', borderRadius: 7, padding: '8px 10px', background: 'transparent' }}>Отключить</button>}
                    </div>
                    {rule && <small style={{ display: 'block', marginTop: 5, color: '#6b5f45' }}>Автозакупка из кассы: {autoRefill.cost.toLocaleString('ru-RU')} ₽{autoRefill.discountPercent ? ` · скидка ${autoRefill.discountPercent}%` : ''}</small>}
                  </div>
                </div>;
              })}
            </section>;
          })()}

          {passiveTiers && (
            <div style={{ marginTop: 20, padding: 15, borderRadius: 12, background: 'linear-gradient(145deg, rgba(40,32,20,0.96), rgba(24,24,28,0.94))', border: '1px solid rgba(214,177,103,0.35)', color: '#f8f0df', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#f1d28f' }}>Пассивный доход</h3>
                <span style={{ fontSize: 12, color: '#d2c5a7' }}>{passiveLevel < 0 ? 'Закрыт' : `Уровень ${passiveLevel} / 3`}</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d2c5a7' }}>
                {passiveLevel < 0
                  ? 'Открой пассивный доход и получай деньги, пока играешь или отдыхаешь.'
                  : `${(passiveRate * passiveCarCount).toLocaleString('ru-RU')} ₽ в минуту${activeBiz.biz_type === 'taxi' ? ` · ${passiveRate} ₽ за машину` : ''}`}
              </p>
              {passiveLevel >= 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#d2c5a7', fontSize: 13 }}>{passiveHasStaff ? 'Накоплено' : 'Для дохода найми сотрудника'}</span>
                    <b style={{ color: '#9ee6a9', fontSize: 16 }}>{passivePending.toLocaleString('ru-RU')} ₽</b>
                  </div>
                  {activeBiz.biz_type === 'taxi' && passiveCarCount === 0 && <p style={{ margin: '0 0 10px', color: '#e5be72', fontSize: 12 }}>Добавь машины в таксопарк, чтобы получать доход.</p>}
                  <Btn variant="primary" onClick={() => app.collectBusinessPassive(activeBiz.id)} disabled={app.proc || passivePending <= 0} style={{ marginBottom: 8, background: 'linear-gradient(135deg, #3f9d55, #26713a)' }}>Собрать пассивный доход</Btn>
                </>
              )}
              {nextPassiveTier ? (
                <Btn variant="secondary" onClick={() => app.upgradeBusinessPassive(activeBiz.id)} disabled={app.proc || passiveUpgradeFunds < nextPassiveTier.cost} style={{ background: 'rgba(214,177,103,0.14)', border: '1px solid rgba(214,177,103,0.55)', color: '#f1d28f' }}>
                  {passiveLevel < 0 ? 'Открыть' : `Улучшить до уровня ${passiveLevel + 1}`} · {nextPassiveTier.cost.toLocaleString('ru-RU')} ₽{activeLease ? ' из кассы' : ''}
                </Btn>
              ) : (
                <p style={{ margin: '8px 0 0', color: '#9ee6a9', fontSize: 13, textAlign: 'center' }}>Максимальный уровень</p>
              )}
              {activeBiz.biz_type === 'coffee' && <small style={{ display: 'block', marginTop: 8, color: '#d2c5a7', lineHeight: 1.4 }}>Это улучшение пассивного дохода кофейни. Временный бонус +10% даёт покупка напитка в магазинах игроков.</small>}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid rgba(90,70,40,0.22)' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#6b5f45' }}>Сотрудники ({bizWorkers.length})</h4>
            {bizWorkers.length === 0 && <p style={{ fontSize: 12, color: '#b06a15', margin: 0 }}>Нет сотрудников. Биржа труда ждет!</p>}
            {bizWorkers.map((w: any) => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 13, textAlign: 'left' }}><b>{w.player_name}</b><br/><span style={{ color: '#6b5f45', fontSize: 11 }}>{w.role} (ЗП: {activeBiz.biz_type === 'salon' ? (w.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : activeBiz.biz_type === 'minimarket' ? '5% с продаж' : activeBiz.biz_type === 'auto_repair' ? '3% с ремонта' : `${w.salary} ₽`})</span></div>
                <Btn variant="danger" onClick={() => app.fire(w.id)} disabled={app.proc} style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>Уволить</Btn>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(90,70,40,0.22)' }}>
            <Btn variant="danger" onClick={() => app.sellBusiness(activeBiz)} disabled={app.proc || !!activeLease} style={{ background: 'transparent', border: '1px solid #c0453a', color: '#c0453a', marginBottom: 8 }}>Продать государству · 50%</Btn>
            <Btn variant="purple" onClick={() => { const point = app.businessCatalog?.locations?.find((location: any) => location.business_id === activeBiz.id); setAuctionPrice(String(Math.floor(Number(point?.price || 0) * 0.5))); setAuctionOpen(true); }} disabled={app.proc || !!activeLease || !!app.businessCatalog?.locations?.some((location: any) => location.business_id === activeBiz.id && location.status === 'auction')}>Выставить на торги · 24 часа</Btn>
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <Store size={48} color="#5f43a0" style={{ marginBottom: 15 }} />
          <h3>Выбери точку бизнеса</h3>
          <p style={{ color: '#6b5f45' }}>Покупка у государства доступна в каталоге выше. Свободные места ограничены.</p>
        </div>
      ))}
    </div>
  );
};

const formatLogTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return iso; }
};

const LogEntry = ({ log }: { log: any }) => {
  const [open, setOpen] = useState(false);
  const isMoney = log.action_type === 'money_change';
  const delta = log.money_delta || 0;
  const details = log.details || {};
  
  let summary = '';
  if (isMoney) {
    summary = `💰 ${delta > 0 ? '+' : ''}${delta} → ${log.money_after ?? '?'}`;
    if (details.reason) summary += ` · ${details.reason}`;
    if (details.actor_nickname) summary += ` · выдал: ${details.actor_nickname}`;
  } else {
    summary = log.action_type.replace(/_/g, ' ');
    if (details.code) summary += ` · ${details.code}`;
    if (details.amount) summary += ` · ${details.amount}`;
    if (details.reason) summary += ` · ${details.reason}`;
  }

  return (
    <div 
      onClick={() => setOpen(o => !o)} 
      style={{ 
        backgroundColor: '#fbf4e4', padding: 10, borderRadius: 12, marginBottom: 6, 
        border: `1px solid ${isMoney ? (delta > 0 ? 'rgba(63,157,85,0.35)' : 'rgba(192,69,58,0.35)') : 'rgba(90,70,40,0.08)'}`,
        cursor: 'pointer', textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#6b5f45', minWidth: 90 }}>{formatLogTime(log.created_at)}</div>
        <div style={{ flex: 1, fontSize: 12 }}>
          <b style={{ color: isMoney ? (delta > 0 ? '#3f9d55' : '#c0453a') : '#2f6a94' }}>{summary}</b>
          {log.nickname && <span style={{ color: '#6b5f45' }}> · {log.nickname}</span>}
        </div>
      </div>
      {open && (
        <pre style={{ 
          marginTop: 8, padding: 8, background: '#e7d9b8', borderRadius: 8, 
          fontSize: 10, color: '#6b5f45', overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>{JSON.stringify({ player_id: log.player_id, telegram_id: log.telegram_id, ...details }, null, 2)}</pre>
      )}
    </div>
  );
};

export const AdminTab = ({ app }: { app: any }) => {
  const [searchQ, setSearchQ] = useState('');
  const [foundPlayers, setFoundPlayers] = useState<any[]>([]);
  const [activeSearchQ, setActiveSearchQ] = useState('');
  const [adminPlayersPage, setAdminPlayersPage] = useState(1);
  const [adminPlayersPages, setAdminPlayersPages] = useState(1);
  const [adminPlayersTotal, setAdminPlayersTotal] = useState(0);
  const [adminPlayersLoading, setAdminPlayersLoading] = useState(false);
  const playersRequestId = useRef(0);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerBizs, setPlayerBizs] = useState<any[]>([]);
  const [playerDetailsLoading, setPlayerDetailsLoading] = useState(false);
  const [playerResetting, setPlayerResetting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoAmount, setPromoAmount] = useState('');
  const [promoLimit, setPromoLimit] = useState('100');
  const [grantCosmeticId, setGrantCosmeticId] = useState('frame_test');
  
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState<string>('all');
  const [logsPlayerQuery, setLogsPlayerQuery] = useState('');
  const [activeLogsPlayerQuery, setActiveLogsPlayerQuery] = useState('');

  const logClientEvent = async (actionType: string, details: any = {}) => {
    try { await app.supabase.rpc('log_action_rpc', { p_player_id: app.pid, p_action_type: actionType, p_details: details }); }
    catch (e) { /* ignore */ }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await app.supabase.rpc('get_logs_rpc', {
      p_admin_id: app.pid,
      p_limit: 200,
      p_action_type: logsFilter === 'all' ? null : logsFilter,
      p_player_query: activeLogsPlayerQuery.trim() || null,
    });
    setLogsLoading(false);
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    setLogs(data?.logs || []);
  };

  const cleanupLogs = async () => {
    if (!window.confirm('Удалить логи старше 30 дней?')) return;
    const { data, error } = await app.supabase.rpc('cleanup_logs_rpc', { p_admin_id: app.pid, p_keep_days: 30 });
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    app.showMsg(`Удалено ${data?.deleted || 0} записей`);
    loadLogs();
  };

  useEffect(() => {
    if (app.adminTab === 'logs') loadLogs();
  }, [app.adminTab, logsFilter, activeLogsPlayerQuery]);

  useEffect(() => {
    if (app.adminTab === 'market') void app.loadMarket(false, false);
  }, [app.adminTab]);

  const loadAdminPlayers = async (page = adminPlayersPage, query = activeSearchQ) => {
    const requestId = ++playersRequestId.current;
    setAdminPlayersLoading(true);
    try {
      const response = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin_list', page, query, init_data: (window as any).Telegram?.WebApp?.initData || '' }),
      });
      const result = await response.json();
      if (requestId !== playersRequestId.current) return;
      if (!response.ok) return app.showMsg(result.error || 'Не удалось загрузить игроков', true);
      const pages = Math.max(1, Number(result.total_pages) || 1);
      if (page > pages) {
        setAdminPlayersPages(pages);
        setAdminPlayersPage(pages);
        return;
      }
      setFoundPlayers(result.players || []);
      setAdminPlayersTotal(Number(result.total) || 0);
      setAdminPlayersPages(pages);
    } catch {
      if (requestId !== playersRequestId.current) return;
      app.showMsg('Не удалось загрузить игроков', true);
    } finally {
      if (requestId === playersRequestId.current) setAdminPlayersLoading(false);
    }
  };

  useEffect(() => {
    if (app.adminTab === 'players' && !selectedPlayer) loadAdminPlayers();
  }, [app.adminTab, adminPlayersPage, activeSearchQ, selectedPlayer]);

  const handleSearch = () => {
    const query = searchQ.trim();
    if (adminPlayersPage !== 1) setAdminPlayersPage(1);
    if (activeSearchQ === query && adminPlayersPage === 1) loadAdminPlayers(1, query);
    else setActiveSearchQ(query);
  };
  
  const loadPlayerDetails = async (p: any) => { 
    const requestId = ++playersRequestId.current;
    setSelectedPlayer(p);
    setPlayerDetailsLoading(true);
    try {
      const { data, error } = await app.supabase.from('businesses').select('*').eq('owner_id', p.id);
      if (error) throw error;
      if (requestId !== playersRequestId.current) return;
      setPlayerBizs(data || []);
    } catch (error: any) {
      if (requestId !== playersRequestId.current) return;
      setPlayerBizs([]);
      app.showMsg(error?.message || 'Не удалось загрузить бизнесы игрока', true);
    } finally {
      if (requestId === playersRequestId.current) setPlayerDetailsLoading(false);
    }
  };
  
  const handleGiveMoney = async (amount: number) => { 
    if (!selectedPlayer) return; 
    // выдача денег — только через админ-RPC (роль проверяется на сервере, лог пишется там же)
    const { data, error } = await app.supabase.rpc('admin_give_money_rpc', { p_admin_id: app.pid, p_target_player_id: selectedPlayer.id, p_amount: amount });
    if (error) return app.showMsg(error.message, true);
    if (data?.error) return app.showMsg(data.error, true);
    const newMoney = Math.max(0, Number(data?.money ?? selectedPlayer.money + amount));
    setSelectedPlayer({ ...selectedPlayer, money: newMoney });
    app.showMsg(`Выдано ${amount}`); 
    if (app.loadData) app.loadData(true); 
  };
  
  const handleGrantCosmetic = async () => {
    if (!selectedPlayer) return;
    try {
      const response = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_grant_cosmetic',
          target_player_id: selectedPlayer.id,
          item_id: grantCosmeticId,
          init_data: (window as any).Telegram?.WebApp?.initData || '',
        }),
      });
      const result = await response.json();
      if (!response.ok) return app.showMsg(result.error || 'Не удалось выдать косметику', true);
      setSelectedPlayer((current: any) => current ? { ...current, owned_cosmetics: result.owned_cosmetics || [] } : current);
      app.showMsg(result.already_owned ? 'У игрока уже есть этот предмет' : 'Косметика выдана');
      if (selectedPlayer.id === app.pid && app.loadData) await app.loadData(true);
    } catch {
      app.showMsg('Не удалось выдать косметику', true);
    }
  };

  const handleBan = async () => { 
    if (!selectedPlayer) return; 
    const newStatus = !selectedPlayer.is_banned; 
    // RLS запрещает прямой UPDATE — только через админ-RPC (проверка роли на сервере)
    const { error: banErr } = await app.supabase.rpc('admin_set_ban_rpc', { p_admin_id: app.pid, p_target_player_id: selectedPlayer.id, p_val: newStatus });
    if (banErr) return app.showMsg(banErr.message || 'Ошибка бана', true); 
    setSelectedPlayer({ ...selectedPlayer, is_banned: newStatus }); 
    await logClientEvent(newStatus ? 'admin_ban' : 'admin_unban', { target_nick: selectedPlayer.nickname, target_id: selectedPlayer.id });
    app.showMsg(newStatus ? "Забанен" : "Разбанен"); 
    if (app.loadData) app.loadData(true); 
  };

  const handleResetPlayer = async () => {
    if (!selectedPlayer || playerResetting) return;
    const nickname = String(selectedPlayer.nickname || 'игрок');
    const confirmed = window.confirm(
      `Сделать игрока «${nickname}» новичком?\n\n` +
      'Сбросятся ₽ и жетоны, банк, транспорт и жильё, косметика, бизнесы, уровень/XP, инвентарь и прогресс пропуска. ' +
      'Семья и роль в ней, реферальные связи/начисления, VIP-статус, аккаунт, история платежей и аудита сохранятся.'
    );
    if (!confirmed) return;

    setPlayerResetting(true);
    try {
      const { data, error } = await app.supabase.rpc('admin_reset_player_rpc', {
        p_admin_id: app.pid,
        p_target_player_id: selectedPlayer.id,
      });
      if (error) return app.showMsg(error.message || 'Не удалось сбросить игрока', true);
      if (data?.error) return app.showMsg(data.error, true);

      setSelectedPlayer((current: any) => current ? { ...current, money: 3500 } : current);
      setPlayerBizs([]);
      app.showMsg(`Игрок «${nickname}» сброшен до новичка; семья и рефералы сохранены`);
      if (selectedPlayer.id === app.pid && app.loadData) await app.loadData(true);
    } catch (error: any) {
      app.showMsg(error?.message || 'Не удалось сбросить игрока', true);
    } finally {
      setPlayerResetting(false);
    }
  };
  
  const handleDeleteBiz = async (bizId: string) => { 
    if (!window.confirm("Удалить этот бизнес?")) return; 
    const bizName = playerBizs.find(b => b.id === bizId)?.business_name;
    const { error: delErr } = await app.supabase.rpc('admin_delete_biz_rpc', { p_admin_id: app.pid, p_biz_id: bizId });
    if (delErr) return app.showMsg(delErr.message || 'Ошибка удаления', true); 
    setPlayerBizs(prev => prev.filter(b => b.id !== bizId)); 
    await logClientEvent('admin_delete_biz', { target_nick: selectedPlayer?.nickname, target_id: selectedPlayer?.id, biz_id: bizId, biz_name: bizName });
    app.showMsg("Бизнес удален"); 
    if (app.loadData) app.loadData(true); 
  };
  
  const handleCreatePromo = async () => { 
    if (!promoCode || !promoAmount) return app.showMsg("Заполни все поля", true);
    const amount = parseInt(promoAmount);
    const limit = parseInt(promoLimit);
    if (isNaN(amount) || amount <= 0) return app.showMsg("Неверная сумма", true);
    if (isNaN(limit) || limit <= 0) return app.showMsg("Неверный лимит", true);
    
    const { data, error } = await app.supabase.rpc('create_promo_rpc', {
      p_admin_id: app.pid,
      p_code: promoCode.toUpperCase().trim(),
      p_amount: amount,
      p_max_uses: limit
    });
    if (error) return app.showMsg(error.message, true);
    if (data && data.error) return app.showMsg(data.error, true);
    
    await logClientEvent('admin_create_promo', { code: promoCode.toUpperCase().trim(), amount, max_uses: limit });
    app.showMsg("Промокод создан!"); 
    setPromoCode(''); 
    setPromoAmount('');
  };

  const logFilters = ['all', 'money_change', 'admin_give_money', 'admin_ban', 'admin_unban', 'admin_delete_biz', 'admin_reset_player', 'admin_create_promo', 'admin_grant_cosmetic', 'promo_used'];

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: 10 }}>
        <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 'none', color: '#6b5f45', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, color: '#c0453a', display: 'flex', alignItems: 'center', gap: 5 }}><ShieldAlert size={20}/> Админка</h2>
      </div>
      
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <Btn variant={app.adminTab === 'players' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('players')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'players' ? '#c0453a' : '#fbf4e4' }}>Игроки</Btn>
        <Btn variant={app.adminTab === 'promos' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('promos')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'promos' ? '#c0453a' : '#fbf4e4' }}>Промо</Btn>
        <Btn variant={app.adminTab === 'logs' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('logs')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'logs' ? '#c0453a' : '#fbf4e4' }}>Логи</Btn>
        <Btn variant={app.adminTab === 'market' ? 'danger' : 'secondary'} onClick={() => app.setAdminTab('market')} style={{ padding: 8, fontSize: 12, background: app.adminTab === 'market' ? '#c0453a' : '#fbf4e4' }}>Рынок</Btn>
      </div>

      {app.adminTab === 'players' && (
        <div>
          {!selectedPlayer ? (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input type="text" placeholder="Поиск по нику..." value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} style={{ ...S.input, marginBottom: 0, flex: 1 }} />
                <Btn variant="primary" onClick={handleSearch} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '0 15px' }}><Search size={20}/></Btn>
                {activeSearchQ && <Btn variant="secondary" onClick={() => { setSearchQ(''); setActiveSearchQ(''); setAdminPlayersPage(1); }} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '0 10px' }}>Сбросить</Btn>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12, color: '#6b5f45' }}>
                <span>{activeSearchQ ? `Результаты поиска: ${adminPlayersTotal}` : `Игроков: ${adminPlayersTotal}`}</span>
                <Btn variant="secondary" onClick={() => loadAdminPlayers()} disabled={adminPlayersLoading} style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}>Обновить</Btn>
              </div>
              {adminPlayersLoading && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Загружаю игроков...</p>}
              {foundPlayers.map(p => (
                <div key={p.id} onClick={() => loadPlayerDetails(p)} style={{ background: '#fbf4e4', padding: 15, borderRadius: 8, marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  <span style={{ color: '#2c7a3c' }}>{p.money} <Coins size={12}/></span>
                </div>
              ))}
              {!adminPlayersLoading && foundPlayers.length === 0 && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Игроки не найдены.</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                <Btn variant="secondary" onClick={() => setAdminPlayersPage(page => Math.max(1, page - 1))} disabled={adminPlayersLoading || adminPlayersPage <= 1} style={{ width: 'auto', padding: '8px 12px' }}>← Назад</Btn>
                <span style={{ color: '#6b5f45', fontSize: 12 }}>Страница {adminPlayersPage} из {adminPlayersPages}</span>
                <Btn variant="secondary" onClick={() => setAdminPlayersPage(page => Math.min(adminPlayersPages, page + 1))} disabled={adminPlayersLoading || adminPlayersPage >= adminPlayersPages} style={{ width: 'auto', padding: '8px 12px' }}>Дальше →</Btn>
              </div>
              
              <div style={{ marginTop: 40, padding: 20, border: '1px solid #c0453a', borderRadius: 8, background: 'rgba(192,69,58,0.08)' }}>
                <h3 style={{ color: '#c0453a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={20}/> Опасная зона</h3>
                <p style={{ fontSize: 13, color: '#6b5f45', marginBottom: 15, textAlign: 'left' }}>Это действие удалит все бизнесы, лоты, уволит рабочих и обнулит деньги ВСЕХ игроков. Отменить это будет невозможно!</p>
                <Btn variant="danger" onClick={app.resetGame} disabled={app.proc}>ПОЛНЫЙ СБРОС ИГРЫ</Btn>
              </div>
            </>
          ) : (
            <div style={S.card}>
              <button onClick={() => setSelectedPlayer(null)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 10, cursor: 'pointer' }}>← К поиску</button>
              <h3 style={{ margin: '0 0 5px 0' }}>{selectedPlayer.nickname}</h3>
              <p style={{ color: '#6b5f45', fontSize: 12, margin: '0 0 15px 0' }}>ID: {selectedPlayer.telegram_id}</p>
              
              <div style={{ background: '#e7d9b8', padding: 10, borderRadius: 12, marginBottom: 15 }}>
                <p style={{ margin: '0 0 5px 0' }}>Баланс: <b style={{ color: '#2c7a3c' }}>{selectedPlayer.money}</b></p>
                <p style={{ margin: 0 }}>Статус: <b style={{ color: selectedPlayer.is_banned ? '#c0453a' : '#2c7a3c' }}>{selectedPlayer.is_banned ? 'ЗАБАНЕН' : 'Активен'}</b></p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <Btn variant="primary" onClick={() => handleGiveMoney(10000)} style={{ padding: 10, fontSize: 13 }}>+10k</Btn>
                <Btn variant="danger" onClick={() => handleGiveMoney(-10000)} style={{ padding: 10, fontSize: 13 }}>-10k</Btn>
                <Btn variant={selectedPlayer.is_banned ? 'secondary' : 'danger'} onClick={handleBan} style={{ padding: 10, fontSize: 13 }}><Ban size={16}/> {selectedPlayer.is_banned ? 'Разбан' : 'Бан'}</Btn>
              </div>

              <div style={{ borderTop: '1px solid rgba(90,70,40,.3)', paddingTop: 15, marginBottom: 15 }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Выдать косметику</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select aria-label="Косметика для выдачи" value={grantCosmeticId} onChange={e => setGrantCosmeticId(e.target.value)} style={{ ...S.input, marginBottom: 0, flex: 1 }}>
                    <option value="frame_test">Мятная рамка</option>
                    <option value="frame_amber">Янтарная рамка</option>
                    <option value="background_concrete">Фон «Бетон»</option>
                    <option value="background_brick">Фон «Кирпич»</option>
                    <option value="background_panelka">Фон «Панелька»</option>
                  </select>
                  <Btn variant="purple" onClick={handleGrantCosmetic} style={{ width: 'auto', padding: '8px 12px' }}>Выдать</Btn>
                </div>
              </div>

              <h4 style={{ margin: '15px 0 10px 0', borderTop: '1px solid rgba(90,70,40,0.3)', paddingTop: 15 }}>Бизнесы ({playerBizs.length})</h4>
              {playerDetailsLoading && <p role="status" style={{ color: '#6b5f45', fontSize: 12 }}>Загружаем бизнесы игрока…</p>}

              {playerBizs.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(90,70,40,0.08)', padding: 10, borderRadius: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{b.business_name} ({b.biz_type})</span>
                  <button onClick={() => handleDeleteBiz(b.id)} style={{ background: 'none', border: 'none', color: '#c0453a', cursor: 'pointer' }}><Trash2 size={16}/></button>
                </div>
              ))}
              {playerBizs.length === 0 && <p style={{ color: '#6b5f45', fontSize: 12 }}>Нет бизнесов.</p>}

              <div style={{ border: '1px solid rgba(239,68,68,.5)', borderRadius: 12, padding: 12, marginTop: 18, background: 'rgba(192,69,58,.08)' }}>
                <h4 style={{ margin: '0 0 6px', color: '#c0453a' }}>Сброс прогресса игрока</h4>
                <p style={{ margin: '0 0 10px', color: '#6b5f45', fontSize: 12, lineHeight: 1.45 }}>
                  Сбросит только выбранный аккаунт. Семья и роль в ней, а также реферальные связи и начисления сохранятся.
                </p>
                <Btn variant="danger" onClick={handleResetPlayer} disabled={app.proc || playerDetailsLoading || playerResetting}>
                  <AlertTriangle size={16} /> {playerResetting ? 'Сбрасываем…' : 'Сделать новичком'}
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {app.adminTab === 'promos' && (
        <div style={S.card}>
          <h3>Создать промокод</h3>
          <input type="text" placeholder="КОД (Англ. буквы)" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} style={S.input} />
          <input type="number" placeholder="Сумма монет" value={promoAmount} onChange={e => setPromoAmount(e.target.value)} style={S.input} />
          <input type="number" placeholder="Лимит активаций" value={promoLimit} onChange={e => setPromoLimit(e.target.value)} style={S.input} />
          <Btn variant="primary" onClick={handleCreatePromo} disabled={app.proc}>Создать</Btn>
        </div>
      )}

      {app.adminTab === 'market' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, textAlign: 'left' }}>
            <div><b>Лоты на рынке</b><div style={{ color: '#6b5f45', fontSize: 12 }}>Товар вернётся на склад; если бизнес закрыт, появится предупреждение</div></div>
            <Btn variant="secondary" onClick={() => void app.loadMarket(true, false)} disabled={app.proc} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}><RefreshCw size={14} /></Btn>
          </div>
          {app.market.length === 0 && <p style={{ color: '#6b5f45' }}>Активных лотов нет.</p>}
          {app.market.map((lot: any) => {
            const kind = lot.item_type === 'car' ? 'Автомобиль' : lot.item_type === 'house' ? 'Жильё' : 'Предмет';
            const itemName = String(lot.item_data || '').split(':').pop();
            return <div key={lot.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, textAlign: 'left' }}>
              <div style={{ minWidth: 0 }}><b>{kind}: {itemName}</b><div style={{ color: '#6b5f45', fontSize: 12, overflowWrap: 'anywhere' }}>{lot.seller_name || 'Без имени'} · {Number(lot.price || 0).toLocaleString('ru-RU')} ₽</div></div>
              <Btn variant="danger" onClick={() => app.adminDeleteMarketLot(lot)} disabled={app.proc} style={{ width: 'auto', padding: '7px 10px', fontSize: 12 }}><Trash2 size={15} /> Удалить</Btn>
            </div>;
          })}
        </div>
      )}

      {app.adminTab === 'logs' && (
        <div>
          <form onSubmit={event => { event.preventDefault(); const query = logsPlayerQuery.trim(); if (query === activeLogsPlayerQuery) void loadLogs(); else setActiveLogsPlayerQuery(query); }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={logsPlayerQuery}
              onChange={event => setLogsPlayerQuery(event.target.value)}
              placeholder="Точный ник, Telegram ID или UUID"
              aria-label="Найти логи игрока"
              style={{ ...S.input, minWidth: 0, flex: 1, margin: 0 }}
            />
            <Btn variant="primary" type="submit" disabled={logsLoading} style={{ width: 'auto', padding: '9px 12px', fontSize: 12 }}>Найти</Btn>
            {activeLogsPlayerQuery && <button type="button" onClick={() => { setLogsPlayerQuery(''); setActiveLogsPlayerQuery(''); }} style={{ border: 0, borderRadius: 9, padding: '9px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: '#292033', color: '#ddd2e7' }}>Сбросить</button>}
          </form>
          {activeLogsPlayerQuery && <div style={{ fontSize: 11, color: '#6b5f45', margin: '-4px 0 10px' }}>Логи игрока: {activeLogsPlayerQuery}</div>}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Btn variant="secondary" onClick={loadLogs} disabled={logsLoading} style={{ padding: 10, fontSize: 12, flex: 1 }}>
              <RefreshCw size={14} style={{ marginRight: 4 }}/> {logsLoading ? 'Загрузка...' : 'Обновить'}
            </Btn>
            <Btn variant="danger" onClick={cleanupLogs} disabled={app.proc} style={{ padding: 10, fontSize: 12, flex: 1, background: 'rgba(192,69,58,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#c0453a' }}>
              <Trash2 size={14} style={{ marginRight: 4 }}/> Очистить 30д+
            </Btn>
          </div>
          
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {logFilters.map(f => (
              <button 
                key={f} 
                onClick={() => setLogsFilter(f)} 
                style={{ 
                  padding: '6px 10px', fontSize: 10, borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: logsFilter === f ? '#3d7ea6' : '#fbf4e4', 
                  color: logsFilter === f ? '#f0f7fb' : '#6b5f45',
                  border: 'none'
                }}
              >{f === 'all' ? 'Все' : f.replace(/_/g, ' ')}</button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#6b5f45', marginBottom: 8 }}>
            <ScrollText size={12} style={{ display: 'inline', marginRight: 4 }}/> {logs.length} записей
          </div>
          
          {logsLoading && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Загрузка...</p>}
          {!logsLoading && logs.length === 0 && <p style={{ color: '#6b5f45', textAlign: 'center' }}>Пусто</p>}
          {!logsLoading && logs.map(log => <LogEntry key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
};

export const CafeTab = ({ app }: { app: any }) => {
  const districtName = app.currentDistrict === 'residential' ? 'Спальный район' : app.currentDistrict === 'factory' ? 'Заводской район' : 'Центр';
  return (
    <div className="cafe-page" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <h2>Кофейни</h2>
      <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, marginBottom: 12 }}><span style={{ textAlign: 'left', fontSize: 13 }}>Твой район: <b>{districtName}</b><small style={{ display: 'block', color: '#aaa0b5', marginTop: 3 }}>Кофе доступен только здесь</small></span><button type="button" onClick={() => app.setTab('district_map')} style={{ border: 0, borderRadius: 9, padding: '9px 11px', background: '#ff9827', color: '#20142a', fontWeight: 800 }}>Карта</button></div>
      <section className="business-scene-banner cafe-scene-banner" aria-label="Уютная кофейня вечером"><div><span>ПАУЗА В ГОРОДСКОМ РИТМЕ</span><b>Кофе с собой</b></div></section>
      <div style={{ ...S.card, textAlign: 'center' }}><Coffee size={42} color="#b06a15" /><h3>Кофе с бонусом</h3><p style={{ color: '#6b5f45' }}>Каждый напиток даёт +10% к заработку профессий: эспрессо на 5 минут, капучино на 7, большой латте на 9. Время разных чашек суммируется.</p><Btn variant="primary" onClick={() => { app.setMarketTab('shops'); app.setTab('market'); }}>Открыть кофейни в магазинах</Btn></div>
    </div>
  );
};

export const JobsTab = ({ app }: { app: any }) => {
  const [boardLoading, setBoardLoading] = useState(false);
  useEffect(() => {
    if (!app.boardOpen) return;
    let cancelled = false;
    setBoardLoading(true);
    Promise.all([
      app.supabase.from('businesses').select('id, owner_id, owner_name, biz_type, business_name, worker_id, worker_name, coffee_balance, last_collected'),
      app.supabase.from('business_workers').select('id, business_id, player_id, player_name, role, salary'),
    ]).then(([businesses, workers]: any[]) => {
      if (cancelled) return;
      if (businesses.error || workers.error) {
        app.showMsg(businesses.error?.message || workers.error?.message || 'Не удалось обновить вакансии', true);
        return;
      }
      app.setAllBiz(businesses.data || []);
      app.setAllWorkers(workers.data || []);
    }).catch((error: any) => {
      if (!cancelled) app.showMsg(error?.message || 'Не удалось обновить вакансии', true);
    }).finally(() => {
      if (!cancelled) setBoardLoading(false);
    });
    return () => { cancelled = true; };
  }, [app.boardOpen]);

  if (app.boardOpen) {
    const availableJobs: any[] = [];
    app.allBiz.forEach((biz: any) => {
      if (biz.owner_id === app.pid) return;
      const roles = BIZ_JOBS[biz.biz_type] || [];
      roles.forEach((roleInfo: any) => {
        const hiredCount = app.allWorkers.filter((w: any) => w.business_id === biz.id && w.role === roleInfo.role).length;
        if (hiredCount < roleInfo.max) {
          availableJobs.push({ biz, role: roleInfo.role, salary: roleInfo.salary });
        }
      });
    });

    return (
      <div className="game-tab game-tab-jobs" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <button onClick={() => app.setBoardOpen(false)} style={{ background: 'none', border: 'none', color: '#6b5f45', marginBottom: 20, marginTop: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>← Назад</button>
        <h2>Вакансии</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {boardLoading && availableJobs.length === 0 && <p role="status" style={{ color: '#6b5f45' }}>Обновляем список вакансий...</p>}
          {!boardLoading && availableJobs.length === 0 && <p style={{ color: '#6b5f45' }}>Пока нет свободных мест...</p>}
          {availableJobs.map((job, idx) => (
            <div key={idx} className="job-vacancy-card" style={{ backgroundColor: '#fbf4e4', padding: 15, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(90,70,40,0.08)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>{job.role}</div>
                <div style={{ fontSize: 12, color: '#6b5f45', marginTop: 4 }}>{job.biz.business_name} ({job.biz.owner_name})</div>
                <div style={{ fontSize: 12, color: '#3d7ea6', marginTop: 2 }}>ЗП: {job.biz.biz_type === 'salon' ? (job.role === 'Механик' ? '3% с продажи авто' : '5% с продажи авто') : job.biz.biz_type === 'minimarket' ? '5% с продаж' : job.biz.biz_type === 'auto_repair' ? '3% с ремонта' : `${job.salary} ₽`}</div>
              </div>
              <Btn variant="secondary" onClick={() => app.hire(job.biz.id, job.role, job.salary)} disabled={app.proc || app.myJob !== null} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{app.myJob ? 'Уже работаете' : 'Устроиться'}</Btn>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (app.myJob) {
    const biz = app.allBiz.find((b:any) => b.id === app.myJob.business_id);
    const isCoffee = biz?.biz_type === 'coffee';
    const isSalon = biz?.biz_type === 'salon';
    const salonPayPercent = app.myJob.role === 'Механик' ? 3 : 5;
    
    return (
      <div className="game-tab game-tab-jobs" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
        <h2>Моя работа</h2>
        <div className="job-current-card" style={{ backgroundColor: '#fbf4e4', padding: 20, borderRadius: 10, border: '1px solid rgba(90,70,40,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
            <span style={{ fontSize: 18, fontWeight: 'bold' }}>{app.myJob.role}</span>
          </div>
          <p style={{ margin: '0 0 5px 0', fontSize: 14, color: '#6b5f45' }}>Бизнес: <b style={{ color: '#2f2a1d' }}>{biz?.business_name || 'Неизвестно'}</b></p>
          
          {isCoffee ? (
            <>
              <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Ты получаешь <b style={{ color: '#3f9d55' }}>{app.myJob.salary}₽</b> с каждой проданной чашки.</p>
              <div style={{ background: 'rgba(63,157,85,0.10)', padding: 15, borderRadius: 8, marginBottom: 15, border: '1px solid rgba(63,157,85,0.25)' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: 13, color: '#3f9d55' }}>Накопленные чаевые:</p>
                <p style={{ margin: 0, fontSize: 24, color: '#3f9d55', fontWeight: 'bold', fontFamily: 'Russo One' }}>{app.tipBalance || 0} <Coins size={18} style={{ display: 'inline' }} /></p>
                <Btn variant="primary" onClick={app.collectTips} disabled={app.proc || !app.tipBalance} style={{ marginTop: 10, padding: 8, fontSize: 13 }}><Wallet size={16} style={{ display: 'inline', marginRight: 5 }}/> Забрать чаевые</Btn>
              </div>
            </>
          ) : isSalon ? (
            <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Получаешь <b style={{ color: '#3f9d55' }}>{salonPayPercent}%</b> от цены продажи автомобиля после его продажи.</p>
          ) : (
            <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#6b5f45' }}>Зарплата: <b style={{ color: '#3f9d55' }}>{app.myJob.salary} 💰</b></p>
          )}
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => app.setBoardOpen(true)} style={{ flex: 1, fontSize: 14, padding: 12, cursor: 'pointer', backgroundColor: '#3d7ea6', color: '#f0f7fb', borderRadius: 8, fontWeight: 'bold', border: 'none' }}>Вакансии</button>
            <Btn variant="danger" onClick={() => app.setQuitOpen(true)} disabled={app.proc} style={{ flex: 1, fontSize: 14, padding: 12, background: 'rgba(192,69,58,0.08)', border: '1px solid rgba(192,69,58,0.35)' }}>Уволиться</Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-tab game-tab-jobs" style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <h2>Работа</h2>
      <div style={{ ...S.card, textAlign: 'center', marginTop: 50 }}>
        <div style={{ fontSize: 50, marginBottom: 10 }}>📉</div><h3>Вы безработный</h3><p style={{ color: '#6b5f45', fontSize: 14, marginBottom: 20 }}>Пора найти работу!</p>
        <Btn variant="secondary" onClick={() => app.setBoardOpen(true)}><Briefcase size={20} /> Биржа труда</Btn>
      </div>
    </div>
  );
};

const SEASON_BADGES: Record<string, { name: string; icon: string }> = {
  season_local: { name: 'Свой район', icon: '☕' },
  season_district: { name: 'Знаток города', icon: '🧭' },
  season_route_master: { name: 'Мастер маршрутов', icon: '🏆' },
};

const formatSeasonCountdown = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${days} дн. ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const PassBadge = ({ id, selected, onClick }: { id: string; selected?: boolean; onClick?: () => void }) => {
  const badge = SEASON_BADGES[id];
  if (!badge) return null;
  return <button type="button" onClick={onClick} className={`season-badge-chip${selected ? ' is-selected' : ''}`} title={badge.name}>
    <span>{badge.icon}</span><b>{badge.name}</b>
  </button>;
};

export const SeasonPassTab = ({ app }: { app: any }) => {
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [now, setNow] = useState(Date.now());
  const loadState = async () => {
    if (!app.pid) return;
    const { data, error } = await app.supabase.rpc('season_pass_state_rpc', { p_player_id: app.pid });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setState(data);
  };
  useEffect(() => {
    let active = true;
    setBusy(true);
    void loadState().catch(error => app.showMsg(error.message || 'Не удалось загрузить пропуск', true))
      .finally(() => { if (active) setBusy(false); });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [app.pid]);

  const run = (rpcName: string, args: Record<string, unknown>, successText: string) => app.action(async () => {
    const { data, error } = await app.supabase.rpc(rpcName, { p_player_id: app.pid, ...args });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (typeof data?.money === 'number') app.setMoney(data.money);
    await loadState();
    await app.loadData(true);
    app.showMsg(successText, false, 'reward');
  });

  const totalXp = Number(state?.xp || 0);
  const tier = Math.min(30, Math.floor(totalXp / 45));
  const xpInTier = tier >= 30 ? 0 : totalXp % 45;
  const secondsLeft = Math.max(0, Math.floor((Date.parse(state?.season?.ends_at || '') - now) / 1000));
  const daysLeft = Math.ceil(secondsLeft / 86400);
  const startsAt = Date.parse(state?.season?.starts_at || '');
  const secondsUntilOpen = Number.isFinite(startsAt) ? Math.max(0, Math.floor((startsAt - now) / 1000)) : 0;
  const passOpen = !!state && secondsUntilOpen === 0;
  const earned = Array.isArray(state?.earned_badges) ? state.earned_badges as string[] : [];
  const showcase = Array.isArray(state?.showcase) ? state.showcase as string[] : [];
  const tiers = Array.isArray(state?.tiers) ? state.tiers : [];
  const dailyQuests = Array.isArray(state?.daily_quests) ? state.daily_quests : [];
  const toggleBadge = (badgeId: string) => app.action(async () => {
    const next = showcase.includes(badgeId) ? showcase.filter(id => id !== badgeId) : [...showcase, badgeId];
    if (next.length > 3) throw new Error('В витрине может быть не больше трёх значков');
    const { data, error } = await app.supabase.rpc('season_pass_select_badges_rpc', { p_player_id: app.pid, p_badges: next });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    await loadState();
  });

  return <div className="game-tab season-pass-page">
    <button type="button" onClick={() => app.setTab('home')} className="season-pass-back">← На главную</button>
    <div className="season-pass-hero">
      <div className="season-pass-kicker"><Ticket size={16} /> СЕЗОННЫЙ ПРОПУСК</div>
      <h2>{state?.season?.name || 'Городские маршруты'}</h2>
      <p>Играй в своём районе, выполняй дела и забирай награды по пути.</p>
      <div className="season-pass-time">{busy ? 'Загружаем сезон…' : !passOpen ? `До открытия · ${formatSeasonCountdown(secondsUntilOpen)}` : daysLeft ? `До конца сезона · ${daysLeft} дн.` : 'Сезон завершён'}</div>
      <div className="season-pass-progress-label"><b>Уровень {tier} / 30</b><span>{tier >= 30 ? 'Все уровни открыты' : `${xpInTier} / 45 XP`}</span></div>
      <div className="season-pass-progress"><span style={{ width: `${tier >= 30 ? 100 : xpInTier / 45 * 100}%` }} /></div>
    </div>

    {!passOpen && !busy && <div className="season-pass-locked-banner"><LockKeyhole size={18} /><div><b>Пропуск пока закрыт</b><span>Он откроется одновременно с завершением текущего семейного сезона. До этого прогресс и награды недоступны.</span></div></div>}

    {state && !state.premium_unlocked && <div className="season-pass-premium-card">
      <div><b><Crown size={17} /> Премиум-дорожка</b><span>Уникальные значки и косметика сезона</span></div>
      <button type="button" disabled={!passOpen || app.proc || Number(state.premium_balance) < Number(state.season?.premium_cost)} onClick={() => run('season_pass_unlock_premium_rpc', {}, 'Премиум-дорожка открыта')}>{passOpen ? `Открыть · ${Number(state.season?.premium_cost || 99)} жет.` : 'Откроется позже'}</button>
    </div>}
    {state?.premium_unlocked && <div className="season-pass-unlocked"><Crown size={16} /> Премиум-дорожка открыта</div>}

    <div className="season-pass-howto">
      <b>Как получать XP</b>
      <span>Работа — до 5 раз в день, +3 XP за смену. Продажа и профессия дают по +5 XP в день. Ежедневные задания приносят ещё по 12 XP.</span>
    </div>

    {passOpen && daysLeft > 0 && <section className="season-pass-quests">
      <div className="season-pass-quests-heading">
        <div><h3>Задания дня</h3><span>Каждый день новые цели · награда начисляется автоматически</span></div>
        <b>{dailyQuests.filter((quest: any) => quest.completed).length}/{dailyQuests.length}</b>
      </div>
      {dailyQuests.map((quest: any) => {
        const progress = Math.min(Number(quest.progress || 0), Number(quest.target || 1));
        const target = Math.max(1, Number(quest.target || 1));
        return <article className={`season-pass-quest${quest.completed ? ' is-complete' : ''}`} key={quest.id}>
          <div className="season-pass-quest-title"><b>{quest.title}</b><strong>+{Number(quest.xp_reward || 0)} XP</strong></div>
          <div className="season-pass-quest-progress"><i style={{ width: `${progress / target * 100}%` }} /></div>
          <small>{quest.completed ? 'Выполнено · XP начислены' : `${progress} / ${target}`}</small>
        </article>;
      })}
      <p>Работа помогает продвигаться, но для быстрого прогресса выполняй и другие задания.</p>
    </section>}

    <h3 className="season-pass-section-title">Награды сезона</h3>
    {busy && <div className="season-pass-empty">Подтягиваем прогресс…</div>}
    {!busy && tiers.map((item: any) => {
      const level = Number(item.level);
      const unlocked = totalXp >= Number(item.required_xp);
      const freeClaimed = (state.claimed_free || []).includes(level);
      const premiumClaimed = (state.claimed_premium || []).includes(level);
      const freeReward = item.free;
      const premiumReward = item.premium;
      const oneRewardLabel = (reward: any) => {
        if (reward?.type === 'badge' || reward?.type === 'cosmetic') return `${reward.icon || '✦'} ${reward.name}`;
        if (reward?.type === 'premium') return `${Number(reward.amount || 0).toLocaleString('ru-RU')} жет.`;
        return `${Number(reward?.amount || 0).toLocaleString('ru-RU')} ₽`;
      };
      const rewardLabel = (reward: any) => reward?.type === 'bundle' && Array.isArray(reward.items)
        ? reward.items.map(oneRewardLabel).join(' + ') : oneRewardLabel(reward);
      return <article className={`season-pass-level${unlocked ? ' is-open' : ''}`} key={level}>
        <div className="season-pass-level-number"><span>{level}</span><small>ур.</small></div>
        <div className="season-pass-track-reward">
          <small>БЕСПЛАТНО</small><b>{rewardLabel(freeReward)}</b>
          <button type="button" disabled={!passOpen || app.proc || !unlocked || freeClaimed || daysLeft === 0} onClick={() => run('season_pass_claim_rpc', { p_level: level, p_track: 'free' }, `Награда уровня ${level} получена`)}>
            {freeClaimed ? <><Check size={14} /> Получено</> : unlocked ? 'Забрать' : <><LockKeyhole size={13} /> Открыто на уровне {level}</>}
          </button>
        </div>
        <div className="season-pass-track-reward premium">
          <small>ПРЕМИУМ</small><b>{rewardLabel(premiumReward)}</b>
          <button type="button" disabled={!passOpen || app.proc || !unlocked || !state.premium_unlocked || premiumClaimed || daysLeft === 0} onClick={() => run('season_pass_claim_rpc', { p_level: level, p_track: 'premium' }, `Премиум-награда уровня ${level} получена`)}>
            {premiumClaimed ? <><Check size={14} /> Получено</> : !state.premium_unlocked ? <><LockKeyhole size={13} /> Закрыто</> : unlocked ? 'Забрать' : `Уровень ${level}`}
          </button>
        </div>
      </article>;
    })}

    <section className="season-pass-badge-collection">
      <div className="season-pass-section-heading"><h3><Medal size={18} /> Коллекция значков</h3><span>{earned.length} собрано · в витрине {showcase.length}/3</span></div>
      {earned.length ? <div className="season-badge-grid">{earned.map(id => <PassBadge key={id} id={id} selected={showcase.includes(id)} onClick={() => void toggleBadge(id)} />)}</div>
        : <p>Значки открываются на 15-м и 30-м уровнях бесплатной дорожки и на 30-м уровне премиальной.</p>}
      <small>Нажми на значок, чтобы добавить его в витрину профиля. Корона VIP отображается отдельно рядом с ником.</small>
    </section>
  </div>;
};

const PREMIUM_ITEMS = [
  { id: 'frame_test', name: 'Мятная рамка', price: 120, icon: '🟢', description: 'Мятный контур вокруг аватара в профиле' },
  { id: 'frame_amber', name: 'Янтарная рамка', price: 60, icon: '🟠', description: 'Тёплый янтарный ободок вокруг аватара' },
  { id: 'background_concrete', name: 'Фон игры «Бетон»', price: 90, icon: '🏙️', description: 'Меняет фон всей игровой страницы' },
  { id: 'background_brick', name: 'Фон «Кирпичный дом»', price: 40, icon: '🧱', description: 'Тёплая кирпичная кладка на фоне всей игры' },
  { id: 'background_panelka', name: 'Фон «Панелька»', price: 80, icon: '🏢', description: 'Фасад панельного дома на фоне всей игры' },
  { id: 'market_slots_2', name: '+2 слота рынка', price: 80, icon: '🛒', description: 'Постоянно увеличивает число объявлений; максимум 9 слотов' },
];

const frameStyle = (frame: string) => frame === 'frame_test'
  ? { border: '0 solid transparent', boxShadow: 'none' }
  : frame === 'frame_route'
    ? { border: '2px solid #e5a846', boxShadow: '0 0 0 3px rgba(40,133,145,.38), 0 0 16px rgba(229,168,70,.36)' }
  : frame === 'frame_amber'
    ? { border: '3px solid #e69a32', boxShadow: '0 0 0 2px #6f3d0d, 0 0 14px rgba(230,154,50,.45)' }
    : { border: '3px solid rgba(90,70,40,.28)' };

const PublicProfileModal = ({ profile, loading, vehicleState, onClose }: { profile: any, loading: boolean, vehicleState?: any, onClose: () => void }) => {
  const frameNames: Record<string, string> = { frame_test: 'Мятная рамка', frame_amber: 'Янтарная рамка', frame_route: 'Рамка «Маршрут»' };
  const backgroundNames: Record<string, string> = PROFILE_BACKGROUND_NAMES;
  const businessNames: Record<string, string> = {
    coffee: 'Кофейня', salon: 'Автосалон', taxi: 'Таксопарк',
    construction: 'Стройтрест', phone_factory: 'Телефонный цех',
  };
  const avatar = getAvatar(profile ? Number(profile.avatar_id) || 1 : 1);

  return (
    <Modal open={loading || !!profile} onClose={onClose} contentStyle={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      {loading ? <p style={{ color: '#6b5f45' }}>Загружаю профиль…</p> : profile && <>
        <div className="profile-hero-card" style={{ ...S.card, textAlign: 'center', padding: 18, marginBottom: 12 }}>
          <div className={`profile-avatar-frame${profile.profile_frame === 'frame_test' ? ' has-exclamation-frame' : ''}${profile.profile_frame === 'frame_route' ? ' has-route-frame' : ''}`} style={{ width: 76, height: 76, margin: '0 auto 10px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 40, background: avatar.bg, ...frameStyle(profile.profile_frame) }}>{profile.profile_frame === 'frame_test' && <img className="avatar-exclamation-ring" src="/images/frame-mint-exclamation.svg" alt="" aria-hidden="true" />}{avatar.emoji}</div>
          <h3 style={{ margin: 0, fontFamily: 'Russo One', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7 }}>{profile.nickname}{profile.premium_active && <Crown size={18} aria-label="VIP" style={{ color: '#d49b2a', fill: 'rgba(212,155,42,.22)' }} />}</h3>
          {(profile.family_awards || []).map((award: any) => <span key={`${award.season_no}-${award.place}`} className="family-profile-badge">{award.place === 1 ? `🏅 Семейный топ ${Number(award.season_no) + 1} сезон` : `🏆 Семья #${award.place} · сезон ${Number(award.season_no) + 1}`}</span>)}
          {!!profile.season_badge_showcase?.length && <div className="season-profile-badges">{profile.season_badge_showcase.slice(0, 3).map((id: string) => <PassBadge key={id} id={id} />)}</div>}
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 10px' }}>Показатели</h4>
          <div>💰 Баланс: <b>{Number(profile.money || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>Уровень: <b>{Number(profile.player_level || 1)}</b></div>
          <div>Профессия: <b>{PLAYER_PROFESSIONS.find(item => item.id === profile.active_profession)?.name || 'Шахтёр'}</b></div>
          <div>Семья: <b>{profile.family ? `[${profile.family.tag}] ${profile.family.name}` : 'Не состоит в семье'}</b></div>
          <div>👥 Приглашено: <b>{Number(profile.referral_count || 0)}</b></div>
          <div>🎁 Реферальный баланс: <b>{Number(profile.referral_balance || 0).toLocaleString('ru-RU')} ₽</b></div>
          <div>📱 Телефоны: <b>{Number(profile.phone_count || 0)}</b></div>
          <div>🚗 Машина: <b>{profile.has_car ? (vehicleState?.models?.find((model: any) => model.model_id === profile.car_model)?.model_name || (profile.car_model === 'lada' ? 'Ока' : 'Тойота')) : 'Нет'}</b></div>
          <div>🏠 Жильё: <b>{profile.has_house ? (profile.house_type || 'Квартира') : 'Нет'}</b></div>
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 8px' }}>Бизнесы</h4>
          {profile.businesses?.length
            ? profile.businesses.map((business: any) => <div key={`${business.biz_type}-${business.business_name}`} style={{ marginBottom: 5 }}>🏢 {business.business_name} · {businessNames[business.biz_type] || 'Бизнес'}</div>)
            : <span style={{ color: '#6b5f45' }}>Пока нет бизнесов</span>}
        </div>
        <div style={{ ...S.card, padding: 15, textAlign: 'left' }}>
          <h4 style={{ margin: '0 0 8px' }}>Надето</h4>
          <div>🖼 Рамка: <b>{frameNames[profile.profile_frame] || 'Стандартная'}</b></div>
          <div>🎨 Фон: <b>{backgroundNames[profile.profile_background] || 'Стандартный'}</b></div>
        </div>
        <Btn variant="secondary" onClick={onClose} style={{ background: '#e7d9b8', boxShadow: 'none', color: '#2f2a1d' }}>Закрыть</Btn>
      </>}
    </Modal>
  );
};

export const ProfileTab = ({ app }: { app: any }) => {
  const [section, setSection] = useState<'stats' | 'businesses' | 'cosmetics'>('stats');
  const [familyProfile, setFamilyProfile] = useState<any>(null);
  const [familyAwards, setFamilyAwards] = useState<any[]>([]);
  const [passState, setPassState] = useState<any>(null);
  const avatar = getAvatar(app.avatarId);
  useEffect(() => {
    let cancelled = false;
    if (!app.pid) return;
    void app.supabase.rpcBatch([
      { name: 'family_state_rpc' },
      { name: 'season_pass_state_rpc' },
    ]).then(({ data: results, error }: any) => {
      if (cancelled || error || !Array.isArray(results)) return;
      const [familyResult, seasonResult] = results;
      if (!familyResult?.error && !familyResult?.data?.error) {
        setFamilyProfile(familyResult.data?.family || null);
        setFamilyAwards(familyResult.data?.awards || []);
      }
      if (!seasonResult?.error && !seasonResult?.data?.error) setPassState(seasonResult.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [app.pid, app.supabase]);
  return <div className="game-tab game-tab-profile" style={{ maxWidth: 420, margin: '0 auto', animation: 'fadeIn .3s' }}>
    <button onClick={() => app.setTab('home')} style={{ background: 'none', border: 0, color: '#6b5f45', cursor: 'pointer', margin: '8px 0 16px' }}>← На главную</button>
    <h2>Профиль</h2>
    <div className="profile-hero-card" style={{ ...S.card, textAlign: 'center', padding: 24 }}>
      <div className={`profile-avatar-frame${app.profileFrame === 'frame_test' ? ' has-exclamation-frame' : ''}${app.profileFrame === 'frame_route' ? ' has-route-frame' : ''}`} style={{ width: 92, height: 92, margin: '0 auto 12px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 48, background: avatar.bg, ...frameStyle(app.profileFrame) }}>{app.profileFrame === 'frame_test' && <img className="avatar-exclamation-ring" src="/images/frame-mint-exclamation.svg" alt="" aria-hidden="true" />}{avatar.emoji}</div>
      <div style={{ fontSize: 23, fontFamily: 'Russo One', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>{app.nick}{Date.parse(app.premiumUntil || '') > Date.now() && <Crown size={20} aria-label="VIP" style={{ color: '#d49b2a', fill: 'rgba(212,155,42,.22)' }} />}</div>
      {familyProfile && <div style={{ marginTop: 6, color: '#3f9d65', fontWeight: 700 }}>[{familyProfile.tag}] {familyProfile.name}</div>}
      {familyAwards.map((award: any) => <span key={`${award.season_no}-${award.place}`} className="family-profile-badge">{award.place === 1 ? `🏅 Семейный топ ${Number(award.season_no) + 1} сезон` : `🏆 Семья #${award.place} · сезон ${Number(award.season_no) + 1}`}</span>)}
      {!!passState?.showcase?.length && <div className="season-profile-badges">{passState.showcase.slice(0, 3).map((id: string) => <PassBadge key={id} id={id} />)}</div>}
      <div style={{ color: '#6b5f45', marginTop: 6 }}>ID: {app.tgId.slice(0, 6)}</div>
      <NicknameSettings app={app} />
      <div style={{ marginTop: 12, fontWeight: 700 }}>💰 {Number(app.money || 0).toLocaleString('ru-RU')} ₽</div>
      <div style={{ marginTop: 12, textAlign: 'left' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><b>Уровень {app.career?.level || 1} · {PLAYER_PROFESSIONS.find(item => item.id === app.career?.profession)?.name || 'Шахтёр'}</b><span>{Number(app.career?.xp || 0)} / {Number(app.career?.xp_to_next || 100)} XP</span></div><div className="profession-xp-track"><span style={{ width: `${Math.min(100, Number(app.career?.xp || 0) / Math.max(1, Number(app.career?.xp_to_next || 100)) * 100)}%` }} /></div></div>
      <div style={{ marginTop: 5, color: '#6b5f45' }}>🎨 {PROFILE_BACKGROUND_NAMES[app.profileBackground] || 'Стандартный фон'}</div>
      <div style={{ marginTop: 12, fontWeight: 700, color: '#7656a8' }}>◆ {app.premiumBalance} жетонов</div>
      <button type="button" onClick={() => app.setTab('season_pass')} style={{ ...S.btnSecondary, width: '100%', marginTop: 10 }}>Открыть сезонный пропуск</button>
    </div>
    <div className="profile-section-tabs" role="tablist" aria-label="\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043F\u0440\u043E\u0444\u0438\u043B\u044F">
      <button type="button" role="tab" aria-selected={section === 'stats'} className={section === 'stats' ? 'active' : ''} onClick={() => setSection('stats')}>{'\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430'}</button>
      <button type="button" role="tab" aria-selected={section === 'businesses'} className={section === 'businesses' ? 'active' : ''} onClick={() => setSection('businesses')}>{'\u0411\u0438\u0437\u043D\u0435\u0441\u044B'}</button>
      <button type="button" role="tab" aria-selected={section === 'cosmetics'} className={section === 'cosmetics' ? 'active' : ''} onClick={() => setSection('cosmetics')}>{'\u041A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430'}</button>
    </div>
    {section === 'stats' && <div className="profile-section-card" style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u041C\u043E\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430'}</h3>
      <p>{'\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u043E'}: <b>{app.myRefCount}</b></p>
      <p>{'\u0420\u0435\u0444\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441'}: <b>{Number(app.refBalance || 0).toLocaleString('ru-RU')} {'\u20BD'}</b></p>
      <p>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u0439'}: <b>{(app.career?.unlocked || ['miner']).length}</b> / {PLAYER_PROFESSIONS.length}</p>
      <button onClick={() => app.setTab('inventory')} style={{ ...S.btnSecondary, width: '100%' }}>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C'}</button>
    </div>}
    {section === 'businesses' && <div className="profile-section-card" style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u041C\u043E\u0438 \u0431\u0438\u0437\u043D\u0435\u0441\u044B'} {'\u00B7'} {app.myBizs.length}/3</h3>
      {app.myBizs.length ? app.myBizs.map((business: any) => <div key={business.id} className="profile-business-row">
        <b>{'\uD83C\uDFE2'} {business.business_name}</b>
        <button onClick={() => { app.setActiveBizType(business.biz_type); app.setActiveBizId(business.id); app.setTab('business'); }}>{'\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C'}</button>
      </div>) : <p style={{ color: '#6b5f45' }}>{'\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0431\u0438\u0437\u043D\u0435\u0441\u043E\u0432'}</p>}
      <button onClick={() => { app.loadBusinessCatalog(); app.setTab('business'); }} style={{ ...S.btnSecondary, width: '100%', marginTop: 12 }}>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0442\u043E\u0447\u0435\u043A'}</button>
    </div>}
    {section === 'cosmetics' && <>
      <div className="profile-section-card" style={S.card}>
        <h3 style={{ marginTop: 0 }}>{'\u041F\u0440\u0438\u043C\u0435\u043D\u0451\u043D\u043D\u0430\u044F \u043A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0430'}</h3>
        <p>{'\u0420\u0430\u043C\u043A\u0430'}: <b>{app.profileFrame === 'frame_test' ? 'Мятная' : app.profileFrame === 'frame_amber' ? '\u042F\u043D\u0442\u0430\u0440\u043D\u0430\u044F' : '\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F'}</b></p>
        <p>{'Фон'}: <b>{PROFILE_BACKGROUND_NAMES[app.profileBackground] || 'Стандартный'}</b></p>
        {['frame_test', 'frame_amber', 'frame_route'].filter(id => app.ownedCosmetics.includes(id)).map(id => <button key={id} onClick={() => app.donateAction('equip', { item_id: id })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8, ...frameStyle(id) }}>{id === 'frame_test' ? '🟢 Мятная рамка' : id === 'frame_route' ? '🚦 Рамка «Маршрут»' : '🟠 Янтарная рамка'}</button>)}
        {['background_concrete', 'background_brick', 'background_panelka', 'background_night_route', 'background_family_timenewromans'].filter(id => app.ownedCosmetics.includes(id)).map(id => <button key={id} onClick={() => app.donateAction('equip', { item_id: id })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8, ...getProfileBackground(id) }}>Установить: {PROFILE_BACKGROUND_NAMES[id]}</button>)}
        <button onClick={() => app.donateAction('equip', { item_id: 'default' })} disabled={app.proc} style={{ ...S.btnSecondary, width: '100%' }}>{'\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439 \u0432\u0438\u0434'}</button>
      </div>
      <div className="profile-section-card" style={S.card}>
        <div className="season-pass-section-heading"><h3><Medal size={18} /> Значки сезона</h3><span>{passState?.earned_badges?.length || 0} собрано · витрина {passState?.showcase?.length || 0}/3</span></div>
        {passState?.earned_badges?.length
          ? <div className="season-badge-grid">{passState.earned_badges.map((id: string) => {
            const selected = (passState.showcase || []).includes(id);
            return <PassBadge key={id} id={id} selected={selected} onClick={() => app.action(async () => {
              const current = passState.showcase || [];
              const next = selected ? current.filter((item: string) => item !== id) : [...current, id];
              if (next.length > 3) throw new Error('В витрине может быть не больше трёх значков');
              const { data, error } = await app.supabase.rpc('season_pass_select_badges_rpc', { p_player_id: app.pid, p_badges: next });
              if (error) throw new Error(error.message);
              if (data?.error) throw new Error(data.error);
              const updated = await app.supabase.rpc('season_pass_state_rpc', { p_player_id: app.pid });
              if (!updated.error && !updated.data?.error) setPassState(updated.data);
            })} />;
          })}</div>
          : <p className="season-pass-muted-copy">Открывай значки в пропуске, затем выбери до трёх для витрины профиля.</p>}
        <button type="button" onClick={() => app.setTab('season_pass')} style={{ ...S.btnSecondary, width: '100%', marginTop: 10 }}>Перейти к наградам</button>
      </div>
      <div className="profile-section-card" style={S.card}>
        <h3 style={{ marginTop: 0 }}>{'\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043A\u043E\u0441\u043C\u0435\u0442\u0438\u043A\u0438'}</h3>
        {PREMIUM_ITEMS.filter(item => item.id !== 'market_slots_2').map(item => {
          const owned = app.ownedCosmetics.includes(item.id);
          return <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid rgba(90,70,40,.12)', textAlign: 'left' }}>
            <span style={item.id.startsWith('background_') ? { width: 48, height: 40, borderRadius: 8, border: '1px solid rgba(90,70,40,.3)', ...getProfileBackground(item.id) } : { fontSize: 27, textAlign: 'center' }}>{item.id.startsWith('background_') ? null : item.icon}</span><div style={{ minWidth: 0 }}><b>{item.name}</b><div style={{ color: '#6b5f45', fontSize: 12 }}>{item.description}</div></div>
            <button onClick={() => app.donateAction('purchase', { item_id: item.id })} disabled={app.proc || owned || app.premiumBalance < item.price} style={{ ...S.btnPurple, gridColumn: '1 / -1', padding: '10px 12px', opacity: owned ? .55 : 1 }}>{owned ? '\u041A\u0443\u043F\u043B\u0435\u043D\u043E' : `${item.price} жет.`}</button>
          </div>;
        })}
      </div>
    </>}

  </div>;
};

export const ShopTab = ({ app }: { app: any }) => {
  const [moneyAmount, setMoneyAmount] = useState('2500');
  const [premiumAmount, setPremiumAmount] = useState('1');
  const premiumActive = Date.parse(app.premiumUntil || '') > Date.now();
  const premiumExpiry = premiumActive ? new Date(app.premiumUntil).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return (
  <div style={{ maxWidth: '400px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Донат</h2><button onClick={() => app.setTab('home')} style={{ ...S.btnSecondary, width: 'auto', padding: '8px 12px', fontSize: 12 }}>На главную</button></div>
    <div style={{ ...S.card, border: '2px solid #8a6ac0' }}>
      <h3 style={{ marginTop: 0, color: '#7656a8' }}>◆ Донат-жетоны</h3>
      <p style={{ color: '#6b5f45', fontSize: 13 }}>Покупай жетоны за Telegram Stars. Все пакеты доступны в Telegram Mini App.</p>
      {[{ id: 'starter', stars: 15, gems: 50 }, { id: 'popular', stars: 50, gems: 250 }, { id: 'big', stars: 100, gems: 500 }].map(pack => <button key={pack.id} onClick={() => app.buyStars(pack.id)} disabled={app.proc} style={{ ...S.btnPurple, width: '100%', marginTop: 8 }}>⭐ {pack.stars} Stars → {pack.gems} жетонов</button>)}
      <div style={{ borderTop: '1px solid rgba(90,70,40,.15)', marginTop: 14, paddingTop: 12 }}>
        <b>Обмен игровой валюты</b>
        <p style={{ color: '#6b5f45', fontSize: 12, margin: '6px 0' }}>2 500 монет → 1 жетон · 1 жетон → 1 500 монет</p>
        <input aria-label="Количество игровых монет для обмена" type="number" min="2500" max="200000" step="2500" value={moneyAmount} onChange={e => setMoneyAmount(e.target.value)} style={S.input} />
        <button onClick={() => app.donateAction('exchange', { direction: 'money_to_premium', amount: Number(moneyAmount) })} disabled={app.proc || Number(moneyAmount) < 2500 || Number(moneyAmount) > 200000 || Number(moneyAmount) % 2500 !== 0 || Number(moneyAmount) > app.money} style={{ ...S.btnSecondary, width: '100%', marginBottom: 8 }}>Обменять монеты на жетоны</button>
        <input aria-label="Количество жетонов для обмена на игровые монеты" type="number" min="1" max="100" step="1" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} style={S.input} />
        <button onClick={() => app.donateAction('exchange', { direction: 'premium_to_money', amount: Number(premiumAmount) })} disabled={app.proc || !Number.isSafeInteger(Number(premiumAmount)) || Number(premiumAmount) < 1 || Number(premiumAmount) > 100 || Number(premiumAmount) > app.premiumBalance} style={{ ...S.btnSecondary, width: '100%' }}>Обменять на {Math.max(0, Number(premiumAmount) || 0) * 1500} монет</button>
      </div>
    </div>
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>{'\u0423\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430'}</h3>
      <div style={{ margin: '0 0 9px', color: '#7656a8', fontWeight: 700 }}>Баланс: {app.premiumBalance} жетонов</div>
      <div className="premium-pass-card" style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', alignItems: 'center', gap: '8px 11px', padding: 14, marginBottom: 14, border: '1px solid rgba(212,155,42,.48)', borderRadius: 14, textAlign: 'left' }}>
        <Crown size={29} aria-hidden="true" style={{ color: '#bd8420', gridRow: '1 / span 2' }} />
        <b style={{ fontSize: 17, lineHeight: 1.25 }}>VIP Premium · 14 дней</b>
        <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.4 }}>×2 шанс редкой и эпической находки. Бонус складывается с удачей семьи. Покупка продлевает срок на 14 дней.{premiumActive && <small style={{ display: 'block', marginTop: 5, color: '#328357' }}>Активен до {premiumExpiry}</small>}</div>
        <button onClick={() => app.donateAction('purchase', { item_id: 'premium_14d' })} disabled={app.proc || app.premiumBalance < 499} style={{ ...S.btnPurple, gridColumn: '1 / -1', padding: '11px 12px' }}>499 жет.</button>
      </div>
      {PREMIUM_ITEMS.filter(item => item.id === 'market_slots_2').map(item => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', alignItems: 'center', gap: '8px 11px', textAlign: 'left' }}>
        <span style={{ fontSize: 26, textAlign: 'center' }}>{item.icon}</span><div style={{ minWidth: 0 }}><b>{item.name}</b><div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.4 }}>{item.description}</div></div>
        <button onClick={() => app.donateAction('purchase', { item_id: item.id })} disabled={app.proc || app.marketSlots >= 9 || app.premiumBalance < item.price} style={{ ...S.btnPurple, gridColumn: '1 / -1', padding: '11px 12px' }}>{app.marketSlots >= 9 ? '\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C' : `${item.price} жет.`}</button>
      </div>)}
    </div>
  </div>
  );
};

export const GibddTab = ({ app }: { app: any }) => (
  <div className="game-tab game-tab-gibdd">
    <button type="button" className="gibdd-back" onClick={() => app.setTab('home')}>← На главную</button>
    <header className="gibdd-header"><span className="gibdd-badge"><CarFront size={23} /></span><div><div className="gibdd-kicker">ГОСАВТОИНСПЕКЦИЯ</div><h1>ГИБДД</h1></div></header>
    {app.currentDistrict === 'center' ? <>
      <p className="gibdd-intro">Крути красивые автомобильные номера в центре. Своя машина не нужна: сохраняй номер в коллекцию, продавай государству или поставь на авто позже.</p>
      <section className="gibdd-spin-card"><div><b>Случайный госномер</b><small>Формат · А 000 АА 77</small></div><button type="button" disabled={app.proc || app.money < 3000} onClick={app.spinCarPlate}>Крутить · 3 000 ₽</button><p>Номер после каждой попытки можно сохранить, продать или установить на свою машину.</p></section>
      <div className="gibdd-collection-heading"><div><span>ТВОЯ КОЛЛЕКЦИЯ</span><small>{(app.numberCollection?.car_numbers || []).length} номеров</small></div><CarFront size={18} /></div>
      <CarNumberCollection app={app} />
    </> : <section className="gibdd-away-card"><b>ГИБДД находится в центре</b><p>Вернись в центральный район, чтобы крутить номера.</p><button type="button" onClick={() => app.setTab('district_map')}>Открыть карту районов</button></section>}
  </div>
);

export const InventoryTab = ({ app }: { app: any }) => {
  const [selected, setSelected] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [confirmRareSale, setConfirmRareSale] = useState(false);
  const [numberToList, setNumberToList] = useState<any>(null);
  const [numberListingPrice, setNumberListingPrice] = useState('');
  const openNumberListing = (number: any, type: 'phone_number' | 'car_number') => {
    setNumberToList({ ...number, type });
    setNumberListingPrice(String(Math.max(1, Number(number.estimated_value) || 1)));
  };
  const closeNumberListing = () => setNumberToList(null);
  const submitNumberListing = () => {
    if (!numberToList) return;
    const price = Number(numberListingPrice);
    if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) { app.showMsg('\u0423\u043a\u0430\u0436\u0438 \u0446\u0435\u043d\u0443 \u043e\u0442 1 \u0434\u043e 100 000 000 \u20bd', true); return; }
    const listing = numberToList;
    closeNumberListing();
    app.listNumberMarketLot(listing.type, listing.id, price);
  };
  useEffect(() => {
    try { localStorage.removeItem('zhituha_inventory_new'); } catch {}
    window.dispatchEvent(new Event('zhituha:inventory-seen'));
  }, []);
  const inventory = Array.isArray(app.career?.inventory) ? app.career.inventory : [];
  const rarityRank: Record<string, number> = { epic: 4, rare: 3, uncommon: 2, common: 1 };
  const sorted = [...inventory].sort((a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0) || a.item_name.localeCompare(b.item_name, 'ru'));
  const openStack = (item: any) => { setSelected(item); setQuantity(1); setConfirmRareSale(false); };
  const closeStack = () => { setSelected(null); setConfirmRareSale(false); };
  const proceedSale = () => {
    if (!selected) return;
    if (['rare','epic'].includes(selected.rarity) && !confirmRareSale) { setConfirmRareSale(true); return; }
    const amount = Math.max(1, Math.min(Number(selected.quantity) || 1, Math.floor(Number(quantity) || 1)));
    app.sellInventory(selected.item_id, amount);
    closeStack();
  };
  return <div style={{ maxWidth: 440, margin: '0 auto', animation: 'fadeIn 0.3s' }}>
    <h2>Инвентарь</h2>
    <div className="inventory-capacity-card"><Backpack size={19} /><div><b>Материалы и находки</b><span>{Number(app.career?.inventory_slots || 0)} / 200 слотов</span></div><div className="inventory-capacity-track"><i style={{ width: `${Math.min(100, Number(app.career?.inventory_slots || 0) / 2)}%` }} /></div></div>
    {sorted.length ? <div className="inventory-stack-grid">{sorted.map(item => {
      const rarity = PROFESSION_RARITIES[item.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common;
      return <button type="button" className="inventory-stack" key={item.item_id} onClick={() => openStack(item)} style={{ '--rarity-color': rarity.color } as React.CSSProperties}>
        <span className="inventory-stack-icon"><ItemArtwork item={item} size={54} /></span><b>{item.item_name}</b><span className="inventory-stack-count">×{item.quantity}</span><small>{rarity.name}</small>
      </button>;
    })}</div> : <div className="inventory-empty"><Backpack size={38} /><b>Пока пусто</b><span>Предметы из профессий будут появляться здесь.</span></div>}
    {app.phone ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Смартфон</div></div><Btn variant="purple" onClick={() => { app.setSellItemType('phone'); app.setSellItemData('phone'); app.setSellPrice(String(DEFAULT_SELL_PHONE)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить</Btn><Btn variant="primary" onClick={() => app.buyPhone(false)} disabled={app.proc}>Сдать (+1400)</Btn></div> : null}
    {!!(app.numberCollection?.numbers || []).length && <section style={{ ...S.card, maxWidth: 'none', display: 'grid', gap: 10 }}><div style={{ textAlign: 'left' }}><b>Коллекция номеров</b><small style={{ display: 'block', color: '#6b5f45', marginTop: 3 }}>Номера можно собирать без смартфона и продавать государству по примерной цене.</small></div>{app.numberCollection.numbers.map((number: any) => <div key={number.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10, borderRadius: 10, background: 'rgba(90,70,40,.06)', textAlign: 'left' }}><div><b style={{ fontVariantNumeric: 'tabular-nums' }}>{number.number}</b><small style={{ display: 'block', color: '#6b5f45' }}>Оценка · {Number(number.estimated_value).toLocaleString('ru-RU')} ₽{number.is_active ? ' · установлен' : ''}</small></div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'end' }}>{app.phone && !number.is_active && <button type="button" disabled={app.proc} onClick={() => app.activatePhoneNumber(number.id)} style={{ border: 0, borderRadius: 8, padding: '7px 9px', background: '#3d7ea6', color: 'white' }}>Установить</button>}<button type="button" disabled={app.proc || number.is_active} onClick={() => openNumberListing(number, 'phone_number')} style={{ border: 0, borderRadius: 8, padding: '7px 9px', background: '#3d7ea6', color: 'white' }}>{'\u041d\u0430 \u0440\u044b\u043d\u043e\u043a'}</button><button type="button" disabled={app.proc} onClick={() => app.sellPhoneNumber(number.id)} style={{ border: 0, borderRadius: 8, padding: '7px 9px', background: '#e6dfd2', color: '#372e24' }}>Продать</button></div></div>)}</section>}
    <section className="gibdd-inventory-section"><div className="gibdd-collection-heading"><div><span>АВТОМОБИЛЬНЫЕ НОМЕРА</span><small>{(app.numberCollection?.car_numbers || []).length} номеров</small></div><CarFront size={18} /></div><CarNumberCollection app={app} /></section>
    {app.hasCar ? <div className="inventory-personal-vehicle" style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><VehicleArtwork modelId={app.carModel} className="inventory-vehicle-art" /><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>{app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.model_name || (app.carModel === 'lada' ? 'Ока' : app.carModel === 'toyota' ? 'Тойота' : 'Автомобиль')}</div><div style={{ fontSize: 12, color: '#3f9d55', marginTop: 4 }}>Состояние: {app.carHealth}%</div></div></div><div><small className="plate-caption">ГОСУДАРСТВЕННЫЙ НОМЕР</small>{app.numberCollection?.car_plate ? <CarPlate plate={app.numberCollection.car_plate} /> : <small>Номер назначается…</small>}</div><Btn variant="secondary" disabled={app.proc || app.money < 3000} onClick={app.spinCarPlate}>Перебросить номер · 3 000 ₽</Btn>{app.carHealth < 100 && <Btn variant="secondary" onClick={() => { app.setMarketTab('shops'); app.setTab('market'); }}>Найти автомастерскую</Btn>}<Btn variant="purple" onClick={() => { const base = Number(app.vehicleState?.models?.find((model: any) => model.model_id === app.carModel)?.base_price || 0); app.setSellItemType('car'); app.setSellItemData(app.carModel); app.setSellPrice(String(base || (app.carModel === 'lada' ? DEFAULT_SELL_LADA : DEFAULT_SELL_TOYOTA))); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    {app.hasHouse ? <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 15 }}><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><Building size={32} color="#b06a15" /><div style={{ textAlign: 'left' }}><div style={{ fontWeight: 'bold', fontSize: 18 }}>Квартира</div></div></div><Btn variant="purple" onClick={() => { app.setSellItemType('house'); app.setSellItemData(app.houseType); app.setSellPrice(String(DEFAULT_SELL_APARTMENT)); app.setSellSource('personal'); app.setSellOpen(true); }} disabled={app.proc}>Выставить на рынок</Btn></div> : null}
    <Modal open={!!numberToList} onClose={closeNumberListing} contentStyle={{ maxWidth: 360 }}>
      {numberToList && <div style={{ display: 'grid', gap: 12, textAlign: 'left' }}>
        <h3 style={{ margin: 0 }}>{'\u0412\u044b\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043d\u043e\u043c\u0435\u0440 \u043d\u0430 \u0440\u044b\u043d\u043e\u043a'}</h3>
        {numberToList.type === 'car_number' ? <CarPlate plate={numberToList.number} /> : <b style={{ fontSize: 20, letterSpacing: 1 }}>{numberToList.number}</b>}
        <small>{'\u041e\u0446\u0435\u043d\u043a\u0430 \u0433\u043e\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0430'} {'\u00b7'} {Number(numberToList.estimated_value).toLocaleString('ru-RU')} {'\u20bd'}</small>
        <label htmlFor="number-market-price">{'\u0426\u0435\u043d\u0430 \u043f\u0440\u043e\u0434\u0430\u0436\u0438'}, {'\u20bd'}</label>
        <input id="number-market-price" type="number" min={1} max={100000000} step={1} value={numberListingPrice} onChange={event => setNumberListingPrice(event.target.value)} style={S.input} />
        <div style={{ display: 'flex', gap: 8 }}><Btn variant="secondary" onClick={closeNumberListing}>{'\u041e\u0442\u043c\u0435\u043d\u0430'}</Btn><Btn variant="primary" disabled={app.proc || !Number.isSafeInteger(Number(numberListingPrice)) || Number(numberListingPrice) < 1 || Number(numberListingPrice) > 100000000} onClick={submitNumberListing}>{'\u0412\u044b\u0441\u0442\u0430\u0432\u0438\u0442\u044c'}</Btn></div>
      </div>}
    </Modal>
    <Modal open={!!selected} onClose={closeStack} contentStyle={{ maxWidth: 360 }}>
      {selected && (() => { const rarity = PROFESSION_RARITIES[selected.rarity as keyof typeof PROFESSION_RARITIES] || PROFESSION_RARITIES.common; const amount = Math.max(1, Math.min(Number(selected.quantity) || 1, Number(quantity) || 1)); return <div className="inventory-item-detail">
        <div className="inventory-item-model" style={{ '--rarity-color': rarity.color } as React.CSSProperties}><ItemArtwork item={selected} size={140} /></div>
        <div className="inventory-item-rarity" style={{ color: rarity.color }}>{rarity.name}</div><h3>{selected.item_name}</h3>
        <div className="inventory-item-quantity">В наличии: ×{selected.quantity}</div>
        <label htmlFor="inventory-sell-quantity">Количество для продажи</label>
        <input id="inventory-sell-quantity" type="number" min={1} max={selected.quantity} value={quantity} onChange={event => { setQuantity(Math.max(1, Math.min(Number(selected.quantity), Number(event.target.value) || 1))); setConfirmRareSale(false); }} />
        <div className="inventory-item-total">Государство заплатит · {(amount * Number(selected.sell_price)).toLocaleString('ru-RU')} ₽</div>
        {confirmRareSale && <p className="inventory-rare-confirm">Подтверди продажу редкой находки. Её нельзя будет вернуть.</p>}
        <div className="inventory-detail-actions"><Btn variant={confirmRareSale ? 'danger' : 'primary'} disabled={app.proc} onClick={proceedSale}>{confirmRareSale ? 'Подтвердить продажу' : 'Продать государству'}</Btn><Btn variant="secondary" disabled={app.proc} onClick={closeStack}>Назад</Btn></div>
      </div>; })()}
    </Modal>
  </div>;
};

const NicknameSettings = ({ app }: { app: any }) => {
  const [draft, setDraft] = useState(app.nick || '');
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!app.pid) return;
    void fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'profile_refresh', init_data: (window as any).Telegram?.WebApp?.initData || '' }),
    }).then(response => response.json()).then(result => {
      if (active && result.player) setChangedAt(result.player.nickname_changed_at || null);
    }).catch(() => {}).finally(() => { if (active) setStatusLoaded(true); });
    return () => { active = false; };
  }, [app.pid]);

  const availableAt = changedAt ? Date.parse(changedAt) + 14 * 24 * 60 * 60 * 1000 : 0;
  const onCooldown = availableAt > Date.now();
  const nextDate = onCooldown ? new Date(availableAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';

  const submit = () => app.action(async () => {
    const response = await fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'change_nickname', nickname: draft, init_data: (window as any).Telegram?.WebApp?.initData || '' }),
    });
    const result = await response.json();
    if (!response.ok || result?.error) {
      if (result?.next_change_at) setChangedAt(new Date(Date.parse(result.next_change_at) - 14 * 24 * 60 * 60 * 1000).toISOString());
      throw new Error(result?.error || 'Не удалось сменить ник');
    }
    setChangedAt(result.nickname_changed_at);
    setDraft(result.nickname);
    await app.loadData(true);
    app.showMsg(`Ник изменён на ${result.nickname}`);
  });

  return <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.04)', textAlign: 'left' }}>
    <label htmlFor="profile-nickname" style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 7 }}>Игровой ник</label>
    <div style={{ display: 'flex', gap: 8 }}>
      <input id="profile-nickname" value={draft} maxLength={20} autoComplete="off" onChange={event => setDraft(event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 20))} placeholder="Только A–Z" style={{ ...S.input, minWidth: 0, margin: 0, flex: 1 }} />
      <button type="button" disabled={app.proc || !statusLoaded || onCooldown || draft.length < 3 || draft.toLowerCase() === String(app.nick || '').toLowerCase()} onClick={submit} style={{ ...S.btnPrimary, width: 'auto', padding: '9px 12px', whiteSpace: 'nowrap' }}>Сменить</button>
    </div>
    <small style={{ display: 'block', marginTop: 7, color: '#aaa0b5', lineHeight: 1.4 }}>{!statusLoaded ? 'Проверяем доступность смены…' : onCooldown ? `Следующая смена ника: ${nextDate}` : 'Ник можно менять раз в 14 дней. Только английские буквы, от 3 до 20.'}</small>
  </div>;
};
