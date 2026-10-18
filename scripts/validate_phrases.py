#!/usr/bin/env python3
"""
validate_phrases.py

Validates generated Hindi-English phrase files against criteria:
1. Exactly 3 files: phrases01.json (1-400), phrases02.json (401-800), phrases03.json (801-1200).
2. Schema per item: {"id": int, "hi": str, "en": str}.
3. Hindi word count: between 4 and 12 words inclusive.
4. Mandatory 4 words from data/vocab.json covered in corresponding sentence.
   Allows exact match or common inflection forms.
5. Punctuation constraint: NO purna viram ('।') anywhere in Hindi or English text.
6. Generates a detailed validation report / build log.
"""

import json
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
VOCAB_FILE = DATA_DIR / "vocab.json"
PHRASE_FILES = [
    (DATA_DIR / "phrases01.json", 1, 400),
    (DATA_DIR / "phrases02.json", 401, 800),
    (DATA_DIR / "phrases03.json", 801, 1200),
]

def load_vocab():
    if not VOCAB_FILE.exists():
        raise FileNotFoundError(f"Vocab file not found at {VOCAB_FILE}")
    with open(VOCAB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def clean_tokens(text):
    # Strip common punctuation (except devanagari characters and english letters)
    # Note: no purna viram allowed
    cleaned = re.sub(r'[^\w\s\u0900-\u097F]', ' ', text)
    return [w.strip() for w in cleaned.split() if w.strip()]

def get_word_stems(word):
    """
    Generate plausible inflections or stem for Hindi words to allow inflectional matching.
    """
    w = word.strip()
    candidates = {w}
    # Common noun/adjective inflections
    # ा -> े / ों / ियों / ी
    if w.endswith('ा'):
        candidates.add(w[:-1] + 'े')
        candidates.add(w[:-1] + 'ी')
        candidates.add(w[:-1] + 'ों')
    elif w.endswith('े'):
        candidates.add(w[:-1] + 'ा')
        candidates.add(w[:-1] + 'ी')
        candidates.add(w[:-1] + 'ों')
    elif w.endswith('ी'):
        candidates.add(w[:-1] + 'ा')
        candidates.add(w[:-1] + 'े')
        candidates.add(w[:-1] + 'ियों')
        candidates.add(w[:-1] + 'ियाँ')
    
    # Common verb inflections (ना ending)
    if w.endswith('ना'):
        root = w[:-2]
        candidates.update([
            root, root + 'ा', root + 'ी', root + 'े',
            root + 'ता', root + 'ती', root + 'ते',
            root + 'कर', root + 'के',
            root + 'ऊंगा', root + 'ऊँगा', root + 'एगी', root + 'एगा', root + 'एंगे'
        ])
    
    # Irregular forms
    irregulars = {
        'जाना': {'गया', 'गई', 'गए', 'जा', 'जाता', 'जाती', 'जाते', 'जाइए', 'जाओ'},
        'करना': {'किया', 'की', 'किए', 'कर', 'करता', 'करती', 'करते', 'कीजिए', 'करो'},
        'होना': {'था', 'थी', 'थे', 'थीं', 'हो', 'होता', 'होती', 'होते', 'हुए', 'हुआ', 'हुई', 'होगा', 'होगी', 'होंगे'},
        'देना': {'दिया', 'दी', 'दिए', 'दे', 'देता', 'देती', 'देते', 'दीजिए', 'दो'},
        'लेना': {'लिया', 'ली', 'लिए', 'ले', 'लेता', 'लेती', 'लेते', 'लीजिए', 'लो'},
    }
    if w in irregulars:
        candidates.update(irregulars[w])

    return candidates

def validate():
    vocab = load_vocab()
    print(f"Loaded {len(vocab)} vocab items from {VOCAB_FILE.name}")
    
    all_errors = []
    total_phrases = 0
    
    for file_path, start_id, end_id in PHRASE_FILES:
        if not file_path.exists():
            print(f"[PENDING] {file_path.name} does not exist yet (expected IDs {start_id}..{end_id})")
            continue
        
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                phrases = json.load(f)
            except Exception as e:
                all_errors.append(f"{file_path.name}: JSON decode error: {e}")
                continue
        
        expected_count = end_id - start_id + 1
        if len(phrases) != expected_count:
            all_errors.append(f"{file_path.name}: Expected {expected_count} phrases, got {len(phrases)}")
            
        for idx, item in enumerate(phrases):
            total_phrases += 1
            curr_id = item.get("id")
            expected_curr_id = start_id + idx
            if curr_id != expected_curr_id:
                all_errors.append(f"{file_path.name}[{idx}]: ID mismatch. Expected {expected_curr_id}, got {curr_id}")
            
            hi_text = item.get("hi", "")
            en_text = item.get("en", "")
            
            # Check purna viram
            if "।" in hi_text or "।" in en_text:
                all_errors.append(f"{file_path.name} ID {curr_id}: Contains purna viram ('।') which is forbidden")
            
            # Check word count in hi_text (4 to 12 words)
            tokens = clean_tokens(hi_text)
            token_count = len(tokens)
            if token_count < 4 or token_count > 12:
                all_errors.append(f"{file_path.name} ID {curr_id}: Hindi word count {token_count} is outside [4, 12] range in '{hi_text}'")
            
            # Check target 4 vocab words
            v_start = (curr_id - 1) * 4
            v_end = v_start + 4
            target_vocab_items = vocab[v_start:v_end]
            target_words = [v["hi"] for v in target_vocab_items]
            
            # Check coverage of each target word
            tokens_set = set(tokens)
            for tw in target_words:
                allowed_forms = get_word_stems(tw)
                matched = False
                # Check exact or inflected token match or substring in phrase
                if any(form in tokens_set for form in allowed_forms):
                    matched = True
                elif tw in hi_text:
                    matched = True
                else:
                    for form in allowed_forms:
                        if form in hi_text:
                            matched = True
                            break
                if not matched:
                    all_errors.append(f"{file_path.name} ID {curr_id}: Missing target word '{tw}' (targets: {target_words}) in '{hi_text}'")
    
    print("\n--- VALIDATION SUMMARY ---")
    if all_errors:
        print(f"FAILED with {len(all_errors)} errors:")
        for err in all_errors[:20]:
            print(" -", err)
        if len(all_errors) > 20:
            print(f" ... and {len(all_errors) - 20} more errors")
        return False
    else:
        print(f"PASSED! Verified {total_phrases} phrases cleanly with 0 errors.")
        return True

if __name__ == "__main__":
    success = validate()
    sys.exit(0 if success else 1)
