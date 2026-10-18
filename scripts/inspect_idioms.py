#!/usr/bin/env python3
"""
inspect_idioms.py

Scans generated phrase files for presence of well-known Hindi idioms / muhavare.
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Common Hindi idiom patterns / keywords
KNOWN_IDIOMS = [
    ("आँखों का तारा", "apple of one's eye"),
    ("दिन रात एक करना", "work day and night"),
    ("ईद का चाँद", "rarely seen"),
    ("हाथ बंटाना", "lend a hand"),
    ("फुलाना न समाना", "overjoyed"),
    ("दाँत खट्टे करना", "defeat completely"),
    ("लोहे के चने चबाना", "struggle hard"),
    ("हवा से बातें करना", "move very fast"),
    ("चार चाँद लगाना", "enhance beauty/honor"),
    ("दाल में कुछ काला", "something fishy"),
    ("नौ दो ग्यारह", "flee away"),
    ("आँखें खुलना", "realize the truth"),
    ("कमर कसना", "gird up loins / prepare"),
    ("कान भरना", "poison someone's ears"),
    ("खून पसीना एक करना", "sweat and toil"),
    ("गागर में सागर", "brevity with deep meaning"),
    ("घी के दीये जलाना", "celebrate joyously"),
    ("चेहरे पर हवाइयां उड़ना", "turn pale with fear"),
    ("जान पर खेलना", "risk one's life"),
    ("बाल की खाल निकालना", "nitpick"),
    ("रंग में भंग पड़ना", "spoil the party"),
    ("सिर आँखों पर बैठाना", "respect deeply"),
    ("हाथ पांव फूलना", "panic"),
    ("अंगूठा दिखाना", "refuse bluntly")
]

def check_idioms():
    found = []
    files = ["phrases01.json", "phrases02.json", "phrases03.json"]
    for fname in files:
        fpath = DATA_DIR / fname
        if not fpath.exists():
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            phrases = json.load(f)
        for item in phrases:
            text = item.get("hi", "")
            for idiom, meaning in KNOWN_IDIOMS:
                # check simplified token presence
                idiom_words = idiom.split()
                if all(w in text for w in idiom_words[:2]):
                    found.append({
                        "file": fname,
                        "id": item.get("id"),
                        "idiom": idiom,
                        "meaning": meaning,
                        "hi": text,
                        "en": item.get("en")
                    })
    
    print(f"Detected {len(found)} phrase(s) with idiom/muhavare occurrences:")
    for f in found:
        print(f"[{f['file']} ID {f['id']}] Idiom: '{f['idiom']}' ({f['meaning']}) -> {f['hi']}")

if __name__ == "__main__":
    check_idioms()
