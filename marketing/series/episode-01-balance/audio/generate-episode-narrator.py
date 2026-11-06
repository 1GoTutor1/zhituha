"""Synthesize the pilot's final narrator line from the approved voice sample."""
from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


HERE = Path(__file__).parent
TEXT = "Первый стакан он продал. Но что делать с остальным кофе?"
REFERENCE = HERE / "narrator-test-softer.wav"
OUTPUT = HERE / "narrator-01-qwen.wav"


def main() -> None:
    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    wavs, sample_rate = model.generate_voice_clone(
        text=TEXT,
        language="Russian",
        ref_audio=str(REFERENCE),
        x_vector_only_mode=True,
    )
    sf.write(OUTPUT, wavs[0], sample_rate)
    print(f"Saved {OUTPUT}; {len(wavs[0]) / sample_rate:.2f}s at {sample_rate}Hz")


if __name__ == "__main__":
    main()
