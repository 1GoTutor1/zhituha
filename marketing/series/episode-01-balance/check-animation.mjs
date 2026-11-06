import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tempModules = path.join(process.env.TEMP || process.env.TMPDIR || '', 'zhituha-production-tools', 'node_modules');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(tempModules, 'playwright'));
const timeline = JSON.parse(fs.readFileSync(path.join(here, 'audio', 'episode-timeline.json'), 'utf8'));
const alignedCues = JSON.parse(fs.readFileSync(path.join(here, 'audio', 'aligned-subtitles.json'), 'utf8')).cues;
const html = path.join(here, 'episode-01-production.html');
if (!fs.existsSync(html)) throw new Error('Build episode-01-production.html before checking motion.');

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!browserPath) throw new Error('Chrome/Edge was not found.');
const browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1994 } });
  page.on('pageerror', error => { throw error; });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: '.shot,.subtitle{transition:none!important}' });

  function check(condition, message) { if (!condition) throw new Error(message); }
  async function frame(t) {
    await page.evaluate(value => window.renderAt(value), t);
    return page.evaluate(() => {
      const parse = d => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const rootFor = id => document.getElementById(id + '-root');
      const sample = (id, side) => {
        const root = rootFor(id);
        if (!root) throw new Error(`Missing walker ${id}`);
        const transform = root.getAttribute('transform') || '';
        const [, tx, ty] = transform.match(/translate\((-?[\d.]+)\s+(-?[\d.]+)\)/) || [];
        const scale = +root.dataset.scale;
        const shoe = parse(document.getElementById(`${id}-${side}Shoe`).getAttribute('d'));
        const upper = parse(document.getElementById(`${id}-${side}Upper`).getAttribute('d'));
        const lower = parse(document.getElementById(`${id}-${side}Lower`).getAttribute('d'));
        const knee = [upper[2], upper[3]], ankle = [lower[2], lower[3]];
        return { footX: +tx + scale * (shoe[0] + 18), footY: +ty + scale * shoe[1], floorY: +root.dataset.y, upperLength: Math.hypot(knee[0] - upper[0], knee[1] - upper[1]), lowerLength: Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]), upper, lower };
      };
      const actor = rootFor('storyWorkerA');
      const cup = document.getElementById('saleCup');
      const buyer = rootFor('customer14');
      const armHand = document.querySelector('#customer14-leftArm circle');
      const buyerMatrix = buyer.getAttribute('transform').match(/translate\((-?[\d.]+)\s+(-?[\d.]+)\) scale\(([-\d.]+)\)/);
      const cupMatrix = cup.getAttribute('transform').match(/translate\((-?[\d.]+)\s+(-?[\d.]+)\)/);
      const cupBox = cup.getBBox();
      const buyerHandWorld = +buyerMatrix[1] + +buyerMatrix[3] * +armHand.getAttribute('cx');
      const cupWorldCenter = +cupMatrix[1] + cupBox.width / 2;
      const activeWalkerMetrics = [];
      for (const root of document.querySelectorAll('.episode-walker')) {
        const shot = root.closest('.shot');
        if (!shot || shot.style.visibility === 'hidden') continue;
        const id = root.dataset.id;
        for (const side of ['left', 'right']) {
          const upper = parse(document.getElementById(`${id}-${side}Upper`).getAttribute('d'));
          const lower = parse(document.getElementById(`${id}-${side}Lower`).getAttribute('d'));
          const shoe = parse(document.getElementById(`${id}-${side}Shoe`).getAttribute('d'));
          activeWalkerMetrics.push({ id, side, upperLength: Math.hypot(upper[2] - upper[0], upper[3] - upper[1]), lowerLength: Math.hypot(lower[2] - upper[2], lower[3] - upper[3]), footY: +root.getAttribute('transform').match(/translate\(-?[\d.]+\s+(-?[\d.]+)\)/)[1] + +root.dataset.scale * shoe[1], floorY: +root.dataset.y });
        }
      }
      return {
        worker: ['left', 'right'].map(side => sample('storyWorkerA', side)),
        reverseWalker: ['left', 'right'].map(side => sample('passer12b', side)),
        activeWalkerMetrics,
        buyerHandWorld, cupWorldCenter,
        cupGripOpacity: +document.getElementById('buyerCupGrip').getAttribute('opacity'),
        saleCupTransform: cup.getAttribute('transform'),
        walkerTransform: actor.getAttribute('transform'),
      };
    });
  }

  const start = timeline.shots.shot07.start;
  const end = timeline.shots.shot07.end;
  const duration = Math.min(3.2, Math.max(.7, (end - start) * .72));
  const travel = 290, scale = .42, cadence = .92;
  const eased = value => value * value * (3 - 2 * value);
  const inverseSmooth = target => {
    let low = 0, high = 1;
    for (let i = 0; i < 36; i++) { const mid = (low + high) / 2; if (eased(mid) < target) low = mid; else high = mid; }
    return (low + high) / 2;
  };
  const t1 = start + duration * inverseSmooth(5 / travel);
  const t2 = start + duration * inverseSmooth(15 / travel);
  const a = await frame(t1), b = await frame(t2);
  check(Math.abs(a.worker[0].footX - b.worker[0].footX) < .75, `Planted left foot slipped ${Math.abs(a.worker[0].footX - b.worker[0].footX).toFixed(2)} px.`);
  check(Math.abs(a.worker[0].footY - b.worker[0].footY) < .25, `Planted left foot changed floor height by ${Math.abs(a.worker[0].footY - b.worker[0].footY).toFixed(2)} px.`);
  check(Math.abs(a.worker[0].upperLength - 55) < .1 && Math.abs(a.worker[0].lowerLength - 55) < .1, 'Leg bone length changed during IK.');
  check(a.worker[0].upper.join(',') !== b.worker[0].upper.join(','), 'Hip/knee motion did not change during the walk.');
  check(a.worker[1].upper.join(',') !== a.worker[0].upper.join(','), 'Left and right legs are not in opposing phases.');
  const swingDistance = .8 * 112 * cadence * scale;
  const swingT = start + duration * inverseSmooth(swingDistance / travel);
  const swing = await frame(swingT);
  check(swing.worker[0].footY < swing.worker[0].floorY - 3, 'Swing foot never lifts from the ground.');

  const reverseStart = timeline.shots.shot12.start;
  const reverseDuration = Math.min(3.2, Math.max(.7, (timeline.shots.shot12.end - reverseStart) * .72));
  const reverseTravel = 580;
  const reverseT1 = reverseStart + reverseDuration * inverseSmooth(5 / reverseTravel);
  const reverseT2 = reverseStart + reverseDuration * inverseSmooth(15 / reverseTravel);
  const reverseA = await frame(reverseT1), reverseB = await frame(reverseT2);
  check(Math.abs(reverseA.reverseWalker[0].footX - reverseB.reverseWalker[0].footX) < .75, `Right-to-left planted foot slipped ${Math.abs(reverseA.reverseWalker[0].footX - reverseB.reverseWalker[0].footX).toFixed(2)} px.`);
  check(Math.abs(reverseA.reverseWalker[0].footY - reverseB.reverseWalker[0].footY) < .25, 'Right-to-left planted foot left the floor.');
  check(Math.abs(reverseA.reverseWalker[0].upperLength - 55) < .1 && Math.abs(reverseA.reverseWalker[0].lowerLength - 55) < .1, 'Reverse walk changed leg bone length.');

  const speechCue = file => {
    const words = alignedCues.filter(cue => cue.file === file);
    return words.length ? { start: Math.min(...words.map(cue => cue.start)), end: Math.max(...words.map(cue => cue.end)) } : timeline.speech.find(line => line.file === file);
  };
  const buyerCue = speechCue('buyer-01.wav'), antonCue = speechCue('anton-02.wav');
  const pourStart = Math.max(buyerCue.end + .12, antonCue.start);
  const handoutStart = pourStart + .82 + .16, handoutEnd = handoutStart + .52;
  const saleA = await frame(handoutStart + .08);
  const saleB = await frame(handoutStart + .38);
  check(saleA.cupGripOpacity === 1 && saleB.cupGripOpacity === 1, 'Buyer hand never takes the cup.');
  check(Math.abs(saleB.buyerHandWorld - saleB.cupWorldCenter) < 34, `Cup is not attached to buyer hand (${Math.abs(saleB.buyerHandWorld - saleB.cupWorldCenter).toFixed(1)} px gap).`);
  check(saleA.saleCupTransform !== saleB.saleCupTransform, 'Transferred cup did not move.');

  async function actionState(t) {
    await page.evaluate(value => window.renderAt(value), t);
    return page.evaluate(() => {
      const attr = id => document.getElementById(id)?.getAttribute('transform') || '';
      const d = id => document.getElementById(id)?.getAttribute('d') || '';
      const xy = value => (value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      return {
        phone: attr('pickupPhone'), phoneArm: d('pickupArm'), phoneHand: [document.getElementById('pickupHand')?.getAttribute('cx'), document.getElementById('pickupHand')?.getAttribute('cy')],
        cart: attr('arrivalCart'), anton12: attr('anton12'), leftLeg: attr('arrivalLeftLeg'), wheel: attr('arrivalWheelA'), arrivalArm: d('arrivalArmRight'),
        table: attr('setupTable'), thermos: attr('setupThermos13'), cup: attr('setupCup1'), prepArm: d('anton13RightArm'), prepHand: [document.getElementById('anton13RightHand')?.getAttribute('cx'), document.getElementById('anton13RightHand')?.getAttribute('cy')],
        owner: document.getElementById('saleCup')?.dataset.owner, saleCup: attr('saleCup'), paymentArm: d('anton14PaymentArm'), finalHead: attr('anton15Head'),
        xy
      };
    });
  }
  const phoneWindow = timeline.shots.shot04;
  const reachStart = await actionState(phoneWindow.start + .08), contact = await actionState(phoneWindow.start + .24), lifted = await actionState(phoneWindow.start + .80);
  check(reachStart.phoneArm !== contact.phoneArm && contact.phone !== lifted.phone, 'Phone reach/grab/lift has no intermediate motion.');
  check(contact.phoneHand.join(',') !== lifted.phoneHand.join(','), 'Phone hand does not follow the lifted phone.');
  const push = await actionState(48.1), pushLater = await actionState(48.55), parkedA = await actionState(50.2), parkedB = await actionState(50.45);
  check(push.cart !== pushLater.cart && push.anton12 !== pushLater.anton12, 'Anton and the cart do not travel together.');
  check(push.leftLeg !== pushLater.leftLeg && push.wheel !== pushLater.wheel, 'Cart approach has no stepping legs or rotating wheels.');
  check(parkedA.cart === parkedB.cart && parkedA.wheel === parkedB.wheel, 'Cart keeps moving after Anton stops.');
  const transformNumbers = value => (value.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const handAtPush = transformNumbers(push.anton12)[0] + 1.88 * 321, handleAtPush = transformNumbers(push.cart)[0] + 850;
  check(Math.abs(handAtPush - handleAtPush) < 3, 'Anton hand is detached from the cart handle during the push.');
  const tableEarly = await actionState(52.6), tablePlaced = await actionState(54.0), cupPlace = await actionState(55.65);
  check(tableEarly.table !== tablePlaced.table, 'Fold-out table never moves into its working position.');
  check(tableEarly.thermos !== tablePlaced.thermos && tablePlaced.cup !== cupPlace.cup, 'Thermos and cups do not move through setup.');
  check(tableEarly.prepArm !== tablePlaced.prepArm && tablePlaced.prepArm !== cupPlace.prepArm, 'Anton does not reach for the equipment while setting up.');
  const preSale = await actionState(timeline.shots.shot14.start + 1), heldCup = await actionState(pourStart + .45), handedCup = await actionState(handoutEnd + .1), paid = await actionState(handoutEnd + 1.0);
  check(preSale.owner === 'table' && heldCup.owner === 'anton_hand' && handedCup.owner === 'buyer_hand', `Coffee cup ownership does not change at the physical handoff (${preSale.owner} → ${heldCup.owner} → ${handedCup.owner}).`);
  check(heldCup.saleCup !== handedCup.saleCup && handedCup.paymentArm !== paid.paymentArm, 'Cup handoff or payment fails to animate.');
  const finalEarly = await actionState(81.0), finalLater = await actionState(86.0);
  check(finalEarly.finalHead !== finalLater.finalHead, 'Anton has no distinct reaction in the final scene.');

  let auditedWalkerParts = 0;
  const walkingWindows = [timeline.shots.shot07, timeline.shots.shot12, timeline.shots.shot13, timeline.shots.shot14];
  for (const window of walkingWindows) {
    for (let t = window.start + .12; t < window.end - .08; t += .41) {
      const sample = await frame(t);
      for (const part of sample.activeWalkerMetrics) {
        check(Math.abs(part.upperLength - 55) < .1 && Math.abs(part.lowerLength - 55) < .1, `${part.id} ${part.side} bone stretched at ${t.toFixed(2)}s.`);
        check(part.footY <= part.floorY + .15, `${part.id} ${part.side} foot sinks below floor at ${t.toFixed(2)}s.`);
        auditedWalkerParts += 1;
      }
    }
  }

  console.log(JSON.stringify({ ok: true, checks: ['gait contact and IK', 'phone reach, grip and lift', 'Anton and cart travel together; wheels turn and stop', 'Anton holds the handle', 'table unfold and equipment placement animate', 'dialogue-led sale staging with camera changes', 'cup ownership table → Anton hand → buyer hand', 'payment action and final reaction animate'], auditedWalkerParts, samples: { forwardWalk: [t1, t2], swing: swingT, reverseWalk: [reverseT1, reverseT2], phone: [reachStart, contact, lifted], arrival: [48.1, 48.55, 50.2, 50.45], setup: [52.6, 54, 55.65], sale: [timeline.shots.shot14.start, pourStart, handoutStart, handoutEnd, timeline.shots.shot14.end], final: [81, 86] } }, null, 2));
} finally {
  await browser.close();
}
