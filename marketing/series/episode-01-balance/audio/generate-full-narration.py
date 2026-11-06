"""Generate the complete pilot narration by cloning the approved V3 sample."""
from pathlib import Path
import json

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


HERE = Path(__file__).parent
REFERENCE = HERE / "narrator-test-softer.wav"
LINES = [
    ("narration-01.wav", "Антон устал. Каждый день одно и то же. Работа, дом, работа."),
    ("narration-02.wav", "На карте оставалось всего пятнадцать тысяч рублей."),
    ("narration-03.wav", "И он даже не представлял, что скоро рискнёт почти всеми своими деньгами."),
    ("narration-04.wav", "Однажды он заметил рабочих, которые каждое утро спешили на смену."),
    ("narration-05.wav", "Многие даже не успевали купить горячий кофе."),
    ("narration-06.wav", "На следующий день Антон купил старый термос, складной стол, тележку и всё необходимое."),
    ("narration-07.wav", "На старт он выделил восемь с половиной тысяч рублей."),
    ("narration-08.wav", "У него осталось всего шесть с половиной."),
    ("narration-09.wav", "В половине шестого утра Антон уже стоял возле заводской проходной."),
    ("narration-10.wav", "Люди проходили мимо."),
    ("narration-11.wav", "Десять человек. Двадцать. Тридцать."),
    ("narration-12.wav", "Никто не останавливался."),
    ("narration-13.wav", "Наконец первая продажа. Сто рублей."),
    ("narration-14.wav", "Но примерно тридцать из них — себестоимость самого кофе."),
    ("narration-15.wav", "Антон смотрел на термос и думал только об одном."),
    ("narration-16.wav", "Что он будет делать, если остальной кофе так никто и не купит?"),
]


def main() -> None:
    if not REFERENCE.is_file():
        raise FileNotFoundError(f"Approved V3 reference is missing: {REFERENCE}")
    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    output = []
    for filename, text in LINES:
        wavs, sample_rate = model.generate_voice_clone(
            text=text,
            language="Russian",
            ref_audio=str(REFERENCE),
            x_vector_only_mode=True,
        )
        target = HERE / filename
        sf.write(target, wavs[0], sample_rate)
        duration = len(wavs[0]) / sample_rate
        output.append({"file": filename, "text": text, "duration": round(duration, 3)})
        print(f"{filename}: {duration:.2f}s")
    (HERE / "narration-source-lines.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Generated {len(output)} narrator clips from V3 reference.")


if __name__ == "__main__":
    main()
