import { useState, useEffect, useRef } from 'react';

// Анимированное число: плавно «докручивает» от старого значения к новому,
// чтобы цифры (деньги/энергия) менялись на глазах — приятнее смотреть.
export const AnimatedNumber = ({ value, format }: { value: number; format?: (n: number) => string }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    const dur = 450; const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{format ? format(display) : display.toLocaleString('ru-RU')}</span>;
};
