# Zhituha main-loop promo

Vertical 26-second promo about the game's core progression: choose a profession, complete jobs, open and manage a business, then build toward the next goal.

## Files

- `zhituha-main-loop.mp4` — final video with voice, music, coffee-pour SFX, and burned-in captions.
- `zhituha-main-loop-silent.mp4` — animation-only export.
- `zhituha-main-loop.srt` — Russian captions timed from the generated speech cues.
- `voiceover.mp3` — Russian neural voice generated with Microsoft Edge TTS (`ru-RU-DmitryNeural`).
- `narration.txt` — exact spoken copy.
- `promo.html` — animated scene composition.
- `render-promo.mjs` — repeatable 1080×1920, 30 FPS render and audio mix.

No invented player balance or business earnings are shown. The TTS timing source is `voiceover.srt`; the final SRT combines its sentence-level cue timings into short readable captions.

## Re-render

```powershell
py -3.12 -m edge_tts --file marketing/promos/zhituha-main-loop/narration.txt --voice ru-RU-DmitryNeural --rate=+2% --pitch=+0Hz --write-media marketing/promos/zhituha-main-loop/voiceover.mp3 --write-subtitles marketing/promos/zhituha-main-loop/voiceover.srt --no-progress
node marketing/promos/zhituha-main-loop/render-promo.mjs
```
