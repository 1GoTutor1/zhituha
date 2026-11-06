import asyncio
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
VOICE = "ru-RU-DmitryNeural"
RATE = "+0%"
LINES = [
    (0.0, "В этом городе всё начинается с тебя."),
    (5.4, "Первая работа. Первые деньги — твои."),
    (10.8, "Открой свою кофейню. Собери команду."),
    (16.2, "Пополняй запас. Продавай. Расти."),
    (21.6, "Житуха. Заходи в игру."),
]


async def main():
    folder = ROOT / "voice-segments"
    folder.mkdir(exist_ok=True)
    for index, (_, text) in enumerate(LINES, start=1):
        communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
        await communicate.save(str(folder / f"scene-{index:02}.mp3"))
        print(f"Generated scene {index}: {text}")


asyncio.run(main())
