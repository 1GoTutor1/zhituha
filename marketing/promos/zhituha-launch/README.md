# Житуха — игровой цикл

Новый вертикальный проморолик показывает путь от первой работы до управления кофейней. В сценах используются реальные названия и действия игры: профессия курьера, точки бизнеса, ассортимент, пополнение товара и история продаж. Финальный экран с `@zhituha_bot` держится после озвученной фразы.

## Файлы

- `zhituha-launch.mp4` — готовый ролик со звуком и встроенными субтитрами.
- `zhituha-launch-silent.mp4` — версия без звука.
- `zhituha-launch.srt` — субтитры с таймингами от Edge TTS speech marks.
- `promo.html` — сцены и SVG/CSS-анимация поверх игровых визуалов.
- `render.mjs` — сборка видео, звука и SRT.
- `narration.txt` и `voice/` — реплики и озвучка.

Озвучка: Microsoft Edge neural `ru-RU-DmitryNeural`, обычная скорость. Фоновая музыка приглушается под речь; использован один тихий звук наливаемого кофе без резких UI-пиков.

## Пересборка

```powershell
py -3.12 -m edge_tts --voice ru-RU-DmitryNeural --text "..." --write-media voice/line-01.mp3 --write-subtitles voice/line-01.srt
node render.mjs
```

Рендер использует локальные `playwright` и `ffmpeg-static` из `%TEMP%\zhituha-production-tools\node_modules`.
