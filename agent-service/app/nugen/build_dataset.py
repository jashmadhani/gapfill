"""Build the Nugen training corpus and benchmark from TourCraft's mood data.

    python -m app.nugen.build_dataset      # from backend/

train.jsonl     one {"instruction", "response"} row per traveler message, response = {"moods": [...]}
benchmark.json  held-out natural sentences (mood_data.NATURAL_TEST) as {"question", "answer"} for Nugen evaluation
"""
import json
import os

from ..ml import mood_data
from .mood import TEMPLATE

OUT = os.path.join(os.path.dirname(__file__), "data")
N_TRAIN = 3000


def answer(moods: list) -> str:
    return json.dumps({"moods": sorted(moods)})


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    X, Y = mood_data.corpus(N_TRAIN)
    with open(os.path.join(OUT, "train.jsonl"), "w") as f:
        for x, y in zip(X, Y):
            f.write(json.dumps({"instruction": TEMPLATE.format(text=x), "response": answer(y)}) + "\n")
    bench = [{"question": TEMPLATE.format(text=t), "answer": answer(y)} for t, y in mood_data.NATURAL_TEST]
    json.dump(bench, open(os.path.join(OUT, "benchmark.json"), "w"), indent=2)
    print(f"train.jsonl: {len(X)} rows · benchmark.json: {len(bench)} questions -> {OUT}")


if __name__ == "__main__":
    main()
