"""Recreate the approved, warmer v3 narrator test with the same Qwen model."""
from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


HERE = Path(__file__).parent
TEXT = (
    "Антон устал. Каждый день одно и то же… Работа, дом, работа. "
    "На карте оставалось всего пятнадцать тысяч рублей. "
    "И он даже не представлял, что скоро рискнёт почти всеми своими деньгами."
)
STYLE = (
    "A warm, gentle Russian-speaking man in his late twenties. Preserve the same medium "
    "natural pitch, soft timbre, light natural grain, and conversational character of "
    "the established narrator. Make the delivery only a little warmer and more relaxed, "
    "with a subtle friendly smile in the voice. Use smooth, gentle phrase endings and "
    "connected natural speech at a comfortable, normal conversational pace, only slightly "
    "relaxed, with brief pauses. Keep it near 17 seconds, not slow or drawn out. He remains "
    "attentive and confident, not "
    "sad, sleepy, breathy, or whispering. Avoid announcer formality, theatrical pauses, "
    "strong emphasis on ordinary words, exaggerated pitch changes, and drawn-out endings."
)
OUTPUT = HERE / "narrator-test-softer.wav"


def main() -> None:
    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    wavs, sample_rate = model.generate_voice_design(
        text=TEXT,
        language="Russian",
        instruct=STYLE,
    )
    sf.write(OUTPUT, wavs[0], sample_rate)
    print(f"Saved {OUTPUT}; {len(wavs[0]) / sample_rate:.2f}s at {sample_rate}Hz")


if __name__ == "__main__":
    main()
