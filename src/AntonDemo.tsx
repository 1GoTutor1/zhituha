import { useState } from 'react';
import AntonCharacter, { type AntonState } from './AntonCharacter';
import './AntonDemo.css';

const states: { id: AntonState; label: string }[] = [
  { id: 'idle', label: 'Стоит' },
  { id: 'talking', label: 'Говорит' },
  { id: 'happy', label: 'Радуется' },
  { id: 'sad', label: 'Грустит' },
  { id: 'surprised', label: 'Удивляется' },
];

export default function AntonDemo() {
  const [state, setState] = useState<AntonState>('idle');

  return (
    <main className="anton-demo">
      <h1>Антон</h1>
      <AntonCharacter state={state} className="anton-demo-character" />
      <nav className="anton-demo-states" aria-label="Состояние Антона">
        {states.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={state === id}
            className={state === id ? 'is-active' : ''}
            onClick={() => setState(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
