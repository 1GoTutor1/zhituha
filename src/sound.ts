let audioContext: AudioContext | null = null;

export function isUiSoundEnabled() {
  return typeof window !== 'undefined' && localStorage.getItem('zhituha_sound') !== 'off';
}

export function toggleUiSound() {
  const enabled = !isUiSoundEnabled();
  localStorage.setItem('zhituha_sound', enabled ? 'on' : 'off');
  if (enabled) playUiSound();
  return enabled;
}

export function playUiSound(isError = false) {
  if (!isUiSoundEnabled() || typeof window === 'undefined') return;
  try {
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(isError ? 220 : 660, now);
    if (!isError) oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isError ? 0.16 : 0.2));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.21);
  } catch {
    // Sound is optional; audio restrictions must not interrupt gameplay.
  }
}
