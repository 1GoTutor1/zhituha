import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';

const SLOT_ROW_HEIGHT = 34;
const LETTERS = Array.from('АВЕКМНОРСТУХ');

export const NumberSpinMachine = ({
  isCar,
  targetValue,
  stopping,
  onSettled,
}: {
  isCar: boolean;
  targetValue: string | null;
  stopping: boolean;
  onSettled: () => void;
}) => {
  const target = targetValue || (isCar ? 'А000АА 77' : '+7 900 000-00-00');
  const reels = useMemo(() => Array.from(target).map(char => {
    if (!/[0-9А-Я]/i.test(char)) return { char, symbols: null as string[] | null, targetIndex: -1 };
    const alphabet = /\d/.test(char) ? '0123456789' : LETTERS.join('');
    const cycle = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
    cycle[9] = char;
    return { char, symbols: [...cycle, ...cycle], targetIndex: 9 };
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
      return [track.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, ${-targetRow * SLOT_ROW_HEIGHT}px, 0)` },
      ], { duration: reducedMotion ? 0 : 760 + (index % 6) * 80, delay: reducedMotion ? 0 : index * 38, easing: 'cubic-bezier(.12,.72,.16,1)', fill: 'forwards' })];
    });
    if (!animations.length) { onSettledRef.current(); return; }
    Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(() => onSettledRef.current());
    return () => animations.forEach(animation => animation.cancel());
  }, [stopping, targetValue, reels]);

  return <div className={`number-spin-machine is-spinning${stopping ? ' is-stopping' : ''}${isCar ? ' plate-machine' : ' phone-machine'}`} role="img" aria-label={isCar ? 'Барабаны автомобильного номера' : 'Барабаны телефонного номера'}>
    <div className="number-spin-window" aria-hidden="true">{reels.map((reel, index) => reel.symbols ? <span className="number-slot-cell" key={index}><span ref={element => { trackRefs.current[index] = element; }} className="number-slot-track" style={{ '--slot-speed': `${1.05 + (index % 7) * .19}s`, '--slot-delay': `-${(index % 9) * .13}s` } as CSSProperties}>{reel.symbols.map((symbol, row) => <i key={row}>{symbol}</i>)}</span></span> : <span className="number-slot-separator" key={index}>{reel.char}</span>)}</div>
    <i className="number-spin-glow" />
    <span className="number-spin-indicator" aria-hidden="true" />
  </div>;
};
