# Player Business Origin

Свежий 27-секундный вертикальный проморолик о пути игрока от первой работы до собственной кофейни.

## Готовые файлы

- `player-business-origin.mp4` — финальный ролик с озвучкой.
- `player-business-origin.srt` — фразы диктора с таймингом по фактической длительности TTS-фрагментов.
- `player-business-origin-silent.mp4` — видеоряд без звука.
- `voiceover.mp3` и `voice-segments/` — сводная дорожка и отдельные реплики.
- `preview-keyframes.png` — контактный лист сцен.

## Сцены

Игрок входит в ночной город, выполняет первую работу и получает деньги, открывает кофейню, пополняет запас и обслуживает клиента. В финале появляется карта районов и призыв зайти в игру через `@zhituha_bot`.

## Пересборка

Для рендера видеоряда нужны Playwright, Chromium/Chrome и ffmpeg. Запусти `node render.mjs`.

Для озвучки нужен Python-пакет `edge-tts`: `py -m pip install edge-tts`, затем `py generate-voice.py`. После генерации реплик запусти `node assemble.mjs`.

Озвучка создана голосом Microsoft Edge TTS `ru-RU-DmitryNeural`. Музыка и звуковые эффекты в эту версию не добавлялись.
