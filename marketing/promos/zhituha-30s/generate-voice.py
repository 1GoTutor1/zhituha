from pathlib import Path
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

HERE = Path(__file__).parent
TEXT = "В Житухе можно начать с обычной работы — и постепенно вырасти. Выбирай профессию, выполняй заказы, закрывай ежедневные задания. Открой бизнес: следи за товарами, продажами и кассой. А когда приезжает торговец чёрного рынка, собирай семью. Рассаду выращивай между визитами. Успешное семейное событие принесёт пятнадцать очков. Житуха. Твоя история — в твоих руках."
REFERENCE = HERE / 'narrator-reference.wav'
OUTPUT = HERE / 'voiceover.wav'
STYLE = "Спокойный, естественный, тёплый мужской голос, как живой человек рассказывает знакомому об интересной игре. Разговорная манера, мягкие связные фразы, нормальный темп, лёгкая доброжелательность. Не диктор и не рекламный голос. Чётко произноси названия и ключевые детали без театральных ударений."

model = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-Base', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
wavs, rate = model.generate_voice_clone(text=TEXT, language='Russian', ref_audio=str(REFERENCE), x_vector_only_mode=True, instruct=STYLE)
sf.write(OUTPUT, wavs[0], rate)
print(f'voiceover: {len(wavs[0]) / rate:.2f}s, {rate}Hz')
