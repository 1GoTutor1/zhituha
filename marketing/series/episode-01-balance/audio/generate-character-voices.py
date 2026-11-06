"""Clone each character's own approved reference; never fall back to narrator V3."""
from argparse import ArgumentParser
from pathlib import Path
import json
import os

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


HERE = Path(__file__).parent
MANIFEST = HERE / "voice-lines.json"
OUTPUT = Path(os.environ.get("ZHITUHA_CHARACTER_VOICE_OUTPUT", str(HERE)))


def parse_args():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--anton-reference", required=True, type=Path, help="Approved Anton voice WAV")
    parser.add_argument("--buyer-reference", required=True, type=Path, help="Approved buyer voice WAV")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    references = {"anton": args.anton_reference, "buyer": args.buyer_reference}
    for speaker, reference in references.items():
        if not reference.is_file():
            raise FileNotFoundError(f"Approved {speaker} reference is missing: {reference}")
        if reference.resolve() == (HERE / "narrator-test-softer.wav").resolve():
            raise ValueError(f"{speaker} reference cannot be narrator V3 under the current production standard")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    lines = [(speaker, line) for speaker in references for line in manifest[speaker]]
    OUTPUT.mkdir(parents=True, exist_ok=True)

    model = Qwen3TTSModel.from_pretrained(
        "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    for speaker, line in lines:
        wavs, sample_rate = model.generate_voice_clone(
            text=line["text"],
            language="Russian",
            ref_audio=str(references[speaker]),
            x_vector_only_mode=True,
        )
        target = OUTPUT / line["file"]
        sf.write(target, wavs[0], sample_rate)
        print(f"{speaker}: {line['file']} ({len(wavs[0]) / sample_rate:.2f}s)", flush=True)


if __name__ == "__main__":
    main()
