"""Base model -> Nugen alignment -> domain-specific mood model. Run once, from backend/:

    python -m app.nugen.build_dataset
    python -m app.nugen.align [--base llama-v3p2-3b-reasoning]     # or --list to see available base models

Steps: upload corpus -> upload benchmark -> create alignment -> poll until READY -> deploy -> save model id.
"""
import argparse
import json
import os
import sys
import time

from . import client

DATA = os.path.join(os.path.dirname(__file__), "data")


def wait(c, url: str, done: tuple, key: str = "status", every: int = 10):
    while True:
        r = c.get(url)
        r.raise_for_status()
        d = r.json()
        print(f"  {url.split('/api/v3/')[-1]}: {d.get(key)}")
        if d.get(key) in done:
            return d
        if str(d.get(key)).upper() == "FAILED":
            sys.exit(f"failed: {d}")
        time.sleep(every)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="llama-v3p2-3b-reasoning")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if not client.api_key():
        sys.exit("NUGEN_API_KEY missing: add it to backend/.env")
    with client.sync() as c:
        if a.list:
            for m in c.get("/api/v3/models/base", params={"limit": 100}).json()["models"]:
                print(m["model_id"], m["parameters"], m["type"], "alignment_ready" if m["alignment_ready"] else "-")
            return
        with open(os.path.join(DATA, "train.jsonl"), "rb") as f:
            r = c.post("/api/v3/documents/create", files={"files": ("tourcraft_mood_train_v2.jsonl", f, "application/json")},
                       data={"categories": "text/json"})
        if r.status_code == 409:  # same file already uploaded: reuse it
            doc_id = r.json()["detail"]["document_id"]
        else:
            r.raise_for_status()
            doc_id = r.json()["document_ids"][0]
        print("document:", doc_id)
        wait(c, f"/api/v3/documents/{doc_id}/status", ("READY",))
        with open(os.path.join(DATA, "benchmark.json"), "rb") as f:
            r = c.post("/api/v3/benchmarks/upload", files={"file": ("benchmark.json", f, "application/json")},
                       data={"name": "tourcraft mood benchmark v2", "document_id": [doc_id], "description": "Held-out natural traveler messages"})
        r.raise_for_status()
        bench_id = r.json()["benchmark_id"]
        print("benchmark:", bench_id)
        wait(c, f"/api/v3/benchmarks/{bench_id}/status", ("READY", "COMPLETED"))
        r = c.post("/api/v3/alignment-projects/create", json={
            "alignment_name": "TourCraft mood parser", "base_model_id": a.base, "document_ids": [doc_id], "benchmark_id": bench_id,
            "description": "Aligns a base LLM to read traveler messages into TourCraft mood labels."})
        r.raise_for_status()
        align_id = r.json()["alignment_id"]
        print("alignment:", align_id)
        wait(c, f"/api/v3/alignment-projects/{align_id}/status", ("READY",))
        models = c.get("/api/v3/models/aligned").json()["domain_aligned_models"]
        mid = next((m["model_id"] for m in models if align_id in m["model_id"]), models[0]["model_id"])
        c.post(f"/api/v3/models/{mid}/deployment").raise_for_status()
        wait(c, f"/api/v3/models/{mid}/deployment/status", ("READY", "DEPLOYED", "ACTIVE"))
        json.dump({"model_id": mid, "alignment_id": align_id, "base_model_id": a.base, "benchmark_id": bench_id,
                   "document_id": doc_id}, open(client.MODEL_FILE, "w"), indent=2)
        print("saved", client.MODEL_FILE, "->", mid)


if __name__ == "__main__":
    main()
