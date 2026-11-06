import { useEffect, useRef, useState, type SVGProps } from 'react';
import './AntonCharacter.css';

export type AntonState = 'idle' | 'talking' | 'happy' | 'sad' | 'surprised';

export interface AntonProps extends SVGProps<SVGSVGElement> {
  state?: AntonState;
}

type MouthShape = { width: number; opening: number; curve: number };

const neutralMouth: MouthShape = { width: 22, opening: 2.8, curve: 6.75 };
const surprisedMouth: MouthShape = { width: 10, opening: 12, curve: 0 };
const speechSequence: { to: MouthShape; transition: number; pause: number }[] = [
  { to: { width: 14, opening: 5.5, curve: 0 }, transition: 135, pause: 90 },
  { to: neutralMouth, transition: 145, pause: 290 },
  { to: { width: 21, opening: 9, curve: 0 }, transition: 160, pause: 95 },
  { to: { width: 15, opening: 5, curve: 0.5 }, transition: 125, pause: 115 },
  { to: neutralMouth, transition: 150, pause: 470 },
  { to: { width: 13, opening: 9.5, curve: 0 }, transition: 155, pause: 120 },
  { to: neutralMouth, transition: 135, pause: 235 },
  { to: { width: 20, opening: 6.5, curve: 0 }, transition: 145, pause: 80 },
  { to: neutralMouth, transition: 155, pause: 510 },
  { to: { width: 21, opening: 8, curve: 0 }, transition: 160, pause: 125 },
  { to: neutralMouth, transition: 135, pause: 190 },
  { to: { width: 13, opening: 5.5, curve: 0 }, transition: 125, pause: 100 },
  { to: neutralMouth, transition: 170, pause: 650 },
];

function mouthPath({ width, opening, curve }: MouthShape) {
  const cx = 250;
  const cy = 133;
  const left = cx - width / 2;
  const right = cx + width / 2;
  return `M ${left} ${cy} Q ${cx} ${cy + curve - opening} ${right} ${cy} Q ${cx} ${cy + curve + opening} ${left} ${cy} Z`;
}

function mouthForState(state: AntonState): MouthShape {
  if (state === 'happy') return { width: 22, opening: 1.5, curve: 11 };
  if (state === 'sad') return { width: 22, opening: 5, curve: 1 };
  return neutralMouth;
}

/** Минималистичная SVG-модель Антона, высота — 500 условных единиц. */
export default function AntonCharacter({ state = 'idle', className = '', ...props }: AntonProps) {
  const [mouth, setMouth] = useState<MouthShape>(neutralMouth);
  const [mouthMode, setMouthMode] = useState<'static' | 'talking' | 'surprised' | 'returning'>(state === 'talking' ? 'talking' : state === 'surprised' ? 'surprised' : 'static');
  const mouthRef = useRef<MouthShape>(neutralMouth);
  const previousState = useRef(state);
  const wasTalking = previousState.current === 'talking' && state !== 'talking';
  const wasSurprised = previousState.current === 'surprised' && state !== 'surprised';
  const useAnimatedMouth = state === 'talking' || state === 'surprised' || mouthMode === 'returning' || wasTalking || wasSurprised;

  useEffect(() => {
    let frame = 0;
    let startTime = 0;
    const priorState = previousState.current;
    previousState.current = state;

    const commit = (shape: MouthShape) => {
      mouthRef.current = shape;
      setMouth(shape);
    };

    if (state === 'talking') {
      setMouthMode('talking');
      const duration = speechSequence.reduce((total, item) => total + item.transition + item.pause, 0);
      let sequenceStart = priorState === 'surprised' ? mouthRef.current : neutralMouth;
      const segments = speechSequence.map((item) => {
        const segment = { ...item, from: sequenceStart };
        sequenceStart = item.to;
        return segment;
      });

      const tick = (now: number) => {
        if (!startTime) startTime = now;
        let time = (now - startTime) % duration;
        let shape = neutralMouth;
        for (const segment of segments) {
          if (time <= segment.transition) {
            const progress = Math.max(0, time / segment.transition);
            const eased = progress * progress * (3 - 2 * progress);
            shape = {
              width: segment.from.width + (segment.to.width - segment.from.width) * eased,
              opening: segment.from.opening + (segment.to.opening - segment.from.opening) * eased,
              curve: segment.from.curve + (segment.to.curve - segment.from.curve) * eased,
            };
            break;
          }
          time -= segment.transition;
          if (time <= segment.pause) {
            shape = segment.to;
            break;
          }
          time -= segment.pause;
        }
        commit(shape);
        frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
    } else if (state === 'surprised') {
      setMouthMode('surprised');
      const from = priorState === 'talking' || priorState === 'surprised' ? mouthRef.current : mouthForState(priorState);
      mouthRef.current = from;
      setMouth(from);
      const start = performance.now();
      const duration = 260;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        const shape = {
          width: from.width + (surprisedMouth.width - from.width) * eased,
          opening: from.opening + (surprisedMouth.opening - from.opening) * eased,
          curve: from.curve + (surprisedMouth.curve - from.curve) * eased,
        };
        mouthRef.current = shape;
        setMouth(shape);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } else if (priorState === 'talking' || priorState === 'surprised') {
      setMouthMode('returning');
      const from = mouthRef.current;
      const target = mouthForState(state);
      const returnStart = performance.now();
      const returnDuration = priorState === 'surprised' ? 300 : 180;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - returnStart) / returnDuration);
        const eased = 1 - (1 - progress) * (1 - progress);
        const shape = {
          width: from.width + (target.width - from.width) * eased,
          opening: from.opening + (target.opening - from.opening) * eased,
          curve: from.curve + (target.curve - from.curve) * eased,
        };
        mouthRef.current = shape;
        setMouth(shape);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else setMouthMode('static');
      };
      frame = requestAnimationFrame(tick);
    } else {
      setMouthMode('static');
      mouthRef.current = mouthForState(state);
    }

    return () => cancelAnimationFrame(frame);
  }, [state]);

  return (
    <svg
      {...props}
      className={`anton-svg${className ? ` ${className}` : ''}`}
      viewBox="0 0 500 500"
      width="500"
      height="500"
      role={props.role ?? 'img'}
      aria-label={props['aria-label'] ?? `Антон: ${state}`}
      data-state={state}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="anton">
        <g id="legs">
          <g id="leftLeg" data-pivot="224 352">
            <path d="M222 345 L218 482" className="anton-leg" />
            <ellipse cx="215" cy="489" rx="22" ry="10" className="anton-foot" />
          </g>
          <g id="rightLeg" data-pivot="276 352">
            <path d="M278 345 L282 482" className="anton-leg" />
            <ellipse cx="285" cy="489" rx="22" ry="10" className="anton-foot" />
          </g>
        </g>

        <g id="hoodie" data-pivot="250 180">
          <path id="hood" d="M207 177 Q207 155 227 151 L273 151 Q293 155 293 177 L280 194 Q250 204 220 194Z" className="anton-hood" />
          <path id="body" d="M207 174 Q250 162 293 174 Q315 181 315 204 L321 326 Q322 352 300 355 L200 355 Q178 352 179 326 L185 204 Q185 181 207 174Z" className="anton-hoodie-body" />
          <g id="strings" className="anton-strings">
            <path d="M239 190 L238 210" />
            <path d="M261 190 L262 210" />
          </g>
          <path id="pocket" d="M218 292 Q250 300 282 292 L282 321 Q250 331 218 321Z" className="anton-pocket" />
        </g>

        <g id="arms">
          <g id="leftArm" data-pivot="190 194">
            <path d="M190 192 Q178 245 179 337" className="anton-arm-line" />
            <circle cx="179" cy="341" r="10" className="anton-hand" />
          </g>
          <g id="rightArm" data-pivot="310 194">
            <path d="M310 192 Q322 245 321 337" className="anton-arm-line" />
            <circle cx="321" cy="341" r="10" className="anton-hand" />
          </g>
        </g>

        <g id="head" data-pivot="250 105">
          <circle id="circle" cx="250" cy="105" r="72.5" className="anton-face" />
        <path id="hair" d="M180 91 C174 75 178 59 190 52 C194 43 204 40 214 44 C222 28 237 23 249 31 C261 22 278 26 284 40 C299 42 309 59 305 78 C304 85 300 90 296 93 C288 84 281 81 274 81 C263 88 253 86 247 80 C237 88 225 86 219 81 C205 91 192 88 180 91Z" className="anton-hair" />

          <g id="eyes">
            <circle cx="226" cy="106" r="4.2" className="anton-eye anton-eye-left" />
            <circle cx="274" cy="106" r="4.2" className="anton-eye anton-eye-right" />
            <path d="M219 106 Q226 101 233 106 M267 106 Q274 101 281 106" className="anton-happy-eyes" />
          </g>

          <g id="mouth">
            {useAnimatedMouth ? (
              <path d={mouthPath(mouth)} className="anton-mouth-animated" />
            ) : state === 'happy' ? (
              <path d="M239 132 Q250 145 261 132" className="anton-mouth-happy" />
            ) : state === 'sad' ? (
              <path d="M239 140 Q250 127 261 140" className="anton-mouth-sad" />
            ) : (
              <path d="M239 133 Q250 139 261 133" className="anton-mouth-neutral" />
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
