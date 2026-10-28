let audioContext: AudioContext | null = null;

export type UiSound = 'tap' | 'success' | 'error' | 'reward' | 'casinoBet' | 'casinoSpin' | 'casinoWin' | 'casinoLose';

export function isUiSoundEnabled() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('zhituha_sound') !== 'off';
  } catch {
    return true;
  }
}

export function toggleUiSound() {
  const enabled = !isUiSoundEnabled();
  setUiSoundEnabled(enabled);
  return enabled;
}

export function setUiSoundEnabled(enabled: boolean) {
  try { localStorage.setItem('zhituha_sound', enabled ? 'on' : 'off'); } catch { /* Sound still works for this session. */ }
  if (enabled) playUiSound();
}

const SOUND_NOTES: Record<UiSound, { frequency: number; delay: number; duration: number; volume: number; wave?: OscillatorType }[]> = {
  tap: [{ frequency: 520, delay: 0, duration: 0.045, volume: 0.035 }],
  success: [
    { frequency: 660, delay: 0, duration: 0.09, volume: 0.055 },
    { frequency: 880, delay: 0.075, duration: 0.13, volume: 0.05 },
  ],
  error: [
    { frequency: 270, delay: 0, duration: 0.11, volume: 0.055, wave: 'triangle' },
    { frequency: 196, delay: 0.085, duration: 0.15, volume: 0.045, wave: 'triangle' },
  ],
  reward: [
    { frequency: 784, delay: 0, duration: 0.12, volume: 0.055 },
    { frequency: 988, delay: 0.075, duration: 0.12, volume: 0.05 },
    { frequency: 1175, delay: 0.15, duration: 0.18, volume: 0.045 },
  ],
  casinoBet: [
    { frequency: 440, delay: 0, duration: 0.07, volume: 0.045 },
    { frequency: 660, delay: 0.06, duration: 0.1, volume: 0.045 },
  ],
  casinoSpin: [
    { frequency: 392, delay: 0, duration: 0.09, volume: 0.04 },
    { frequency: 523, delay: 0.07, duration: 0.09, volume: 0.04 },
    { frequency: 659, delay: 0.14, duration: 0.13, volume: 0.035 },
  ],
  casinoWin: [
    { frequency: 523, delay: 0, duration: 0.15, volume: 0.06 },
    { frequency: 659, delay: 0.09, duration: 0.15, volume: 0.055 },
    { frequency: 784, delay: 0.18, duration: 0.15, volume: 0.05 },
    { frequency: 1047, delay: 0.27, duration: 0.22, volume: 0.045 },
  ],
  casinoLose: [
    { frequency: 330, delay: 0, duration: 0.12, volume: 0.05, wave: 'triangle' },
    { frequency: 247, delay: 0.1, duration: 0.18, volume: 0.045, wave: 'triangle' },
  ],
};

export function playUiSound(kind: UiSound | boolean = 'success') {
  if (!isUiSoundEnabled() || typeof window === 'undefined') return;

  const sound = typeof kind === 'boolean' ? (kind ? 'error' : 'success') : kind;
  try {
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const now = audioContext.currentTime;
    for (const note of SOUND_NOTES[sound]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + note.delay;
      oscillator.type = note.wave || 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.01);
    }
  } catch {
    // Sound is optional; audio restrictions must not interrupt gameplay.
  }
}
