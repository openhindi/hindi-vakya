#!/usr/bin/env python3
"""
authoring_pipeline.py

Pipeline utility for authoring Hindi phrases:
1. Slices vocab.json into 4-word clusters per phrase.
2. Provides prompt templates and batch specs for authoring phrases with rich grammar variety.
3. Allows batch generation, validation, and serialization into data/phrases01.json, phrases02.json, phrases03.json.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
VOCAB_FILE = DATA_DIR / "vocab.json"

def get_clusters_for_batch(batch_num):
    """
    batch_num: 1 (1..400), 2 (401..800), 3 (801..1200)
    """
    with open(VOCAB_FILE, "r", encoding="utf-8") as f:
        vocab = json.load(f)
    
    start_phrase_idx = (batch_num - 1) * 400
    end_phrase_idx = batch_num * 400
    
    clusters = []
    for p_idx in range(start_phrase_idx, end_phrase_idx):
        p_id = p_idx + 1
        v_start = p_idx * 4
        v_end = v_start + 4
        words = vocab[v_start:v_end]
        clusters.append({
            "id": p_id,
            "words": [w["hi"] for w in words],
            "vocab_en": [w["en"] for w in words]
        })
    return clusters

def export_prompt_specs(batch_num, out_file=None):
    clusters = get_clusters_for_batch(batch_num)
    if not out_file:
        out_file = ROOT_DIR / f"scripts/batch_{batch_num}_specs.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(clusters, f, ensure_ascii=False, indent=2)
    print(f"Exported {len(clusters)} cluster specs to {out_file}")

if __name__ == "__main__":
    import sys
    b = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    export_prompt_specs(b)
