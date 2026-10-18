# Hindi Vakya (हिंदी वाक्य)

A standalone, mobile-first web app and linguistic corpus of **1,200 grammatically structured Hindi phrases and sentences** with English translations, covering **4,800 vocabulary words** from [`data/vocab.json`](data/vocab.json).

---

## 1. Corpus Structure & Rules

- **Data Division**: 1,200 phrases organized into 3 files of 400 phrases each:
  - [`data/phrases01.json`](data/phrases01.json): IDs `1` to `400` (covering vocabulary words 1–1600)
  - [`data/phrases02.json`](data/phrases02.json): IDs `401` to `800` (covering vocabulary words 1601–3200)
  - [`data/phrases03.json`](data/phrases03.json): IDs `801` to `1200` (covering vocabulary words 3201–4800)
- **JSON Schema**:
  ```json
  {
    "id": 1,
    "hi": "मैं जानता हूँ कि इस मामले के पीछे कोई रहस्य नहीं है",
    "en": "I know that there is no secret behind this matter"
  }
  ```
- **Word Limits**: Each Hindi sentence strictly contains between **4 and 12 words**.
- **Vocab Coverage**: Sentence $N$ mandatorily embeds words $(4N-3)$ through $(4N)$ from `vocab.json` (as direct root headwords or grammatical inflections).
- **Punctuation**: **No purna viram (`।`)** is used in any sentence.
- **Grammar & Idioms**: Comprehensive coverage across Hindi tenses, moods, aspects, ergative cases, dative constructions, and idioms (*मुहावरे*).

---

## 2. Web Application & Game Engine

The repository includes a responsive, lightweight web application (`index.html`, `styles.css`, `app.js`) designed for mobile, tablet, and desktop.

### Features
1. **Word Bridge Game**:
   - Reconstruct Hindi sentences by selecting shuffled word chips.
   - Word chips move from the word bank to the sentence slot upon tap/click and return when tapped again.
   - **Distractor Words**: Shuffled word bank includes 3 carefully chosen distractor words selected from other sections of `vocab.json` to challenge vocabulary comprehension.
   - **Hint Mode (`✶`)**: Shows English translations and word-by-word glosses:
     - Full English sentence translation appears at the top.
     - Individual English meanings appear directly beneath Hindi words on chips.
   - **Audio Pronunciation (`🔊`)**: Native Web Speech synthesis for the sentence in Hindi (`hi-IN`).
   - **Visual Feedback**:
     - Correct submission triggers a celebratory green flash and auto-advances to the next sentence.
     - Incorrect submission triggers a gentle shake animation.
   - **Progress & History**:
     - LocalStorage saves the current phrase index, theme preference, and per-sentence completion state.
     - Clean, minimalist titlebar progress counter showing zero-padded completed count (e.g., `0000`, `0001`, `0042`) alongside the completion progress bar.
     - Compact word bank typography (chips scaled to 3/4th size) for comfortable fit and clear hint glosses across mobile screens.
     - Skip (`↷`) and Back (`↶`) buttons for navigation.

2. **Vocabulary & Stats View**:
   - Displays all 4,800 vocabulary words with word indices, Hindi script, transliteration, and English meanings.
   - Filter words by status (Completed vs. Remaining) and search by English or Hindi terms.
   - Quick jump to the specific sentence where any vocabulary word is practiced.

3. **Dark / Light Theme**:
   - High-contrast, clean theme toggled with the `☀️` / `🌙` icon, persisted in `localStorage`.

---

## 3. Key Design Decisions & Architectural Rules

### A. Dictionary & Vocabulary Coverage (`vocab.json` + `dict.json`)
- **Root Vocabulary (`data/vocab.json`) — IMMUTABLE & BATTLE-TESTED**:
  - Contains exactly 4,800 headwords mapped to word index, Hindi root, transliteration, and English definition.
  - **CRITICAL RULE**: `vocab.json` is 100% battle-tested and **MUST NOT BE MODIFIED AT ANY COST**. Any required additions or nuances for sentence words must exclusively go into `data/dict.json`.
- **Dedicated Non-Vocab Dictionary (`data/dict.json`)**:
  - Across the 1,200 sentences, non-headword words (inflected forms like `गया`, `बुरी`, `उपवन`, postpositions, auxiliary verbs, and pronouns) are mapped in `data/dict.json` with accurate English glosses (1,237 entries).
  - Both files are asynchronously loaded into `vocabMap` at startup, ensuring **100% of words across all 1,200 sentences have instant English definitions** in hint mode.
  - Root headwords from `vocab.json` always take precedence over `dict.json`.

### B. Orange Target Highlighting & Reference Chips
- **Unified Color Palette**:
  - No purple or violet highlights (`.inflected-vocab` was completely removed).
  - All target-related highlights use unified orange tones.
- **Exact Target Words**:
  - Sentence words that exactly match one of the 4 target headwords are highlighted in **vibrant orange** (`.target-vocab`).
- **Inflected Forms**:
  - Rule: Heuristic inflection guessing (`isInflectionOf`) was **deliberately removed** to prevent false positives and linguistic inaccuracy.
  - When a target vocabulary word appears in an inflected form in the sentence (e.g., target root `बुरा` appearing as `बुरी`), the inflected word in the sentence bank remains **unhighlighted** (normal chip style). It still receives its English meaning from `dict.json`.
- **Original Root Reference Chips (`.ref-vocab-chip`)**:
  - If any of the 4 target root words are missing from the sentence due to inflection (or variation), they appear in Hint mode as non-clickable reference chips styled in **grey-shaded orange**.
  - This informs learners of the original root word and its meaning without altering the playable word bank.

### C. Distractor Words
- Distractors are picked dynamically from `vocab.json` outside the current phrase's 4-word cluster.
- Every distractor is guaranteed to have its English meaning rendered in Hint mode.

---

## 4. Corpus & Vocabulary Coverage Analytics

A full audit matching all **4,800 headwords** from `data/vocab.json` against the **1,200 sentences** reveals:

| Metric | Measurement | Notes |
| :--- | :--- | :--- |
| **Total Headwords (`vocab.json`)** | **4,800** | 100% battle-tested root vocabulary |
| **Direct Verbatim Matches in Sentences** | **4,666 (97.21%)** | Root word appears exactly as spelled in `vocab.json` |
| **Words Present via Inflected / Grammatical Forms** | **134 (2.79%)** | Root word present in natural inflected forms (see breakdown below) |
| **Total Effective Vocabulary Coverage** | **100%** | All 4-word targets ($4N-3 \dots 4N$) embedded per sentence |
| **Total Running Hindi Words in Corpus** | **12,820 words** | Average 10.7 words per sentence (range: 7–12 words) |
| **Unique Wordforms in Sentences** | **5,845 tokens** | Includes conjugated verbs, case inflections, and plurals |
| **Dictionary Entries (`data/dict.json`)** | **1,237 entries** | Provides 100% gloss coverage for all inflected & auxiliary words |

### Breakdown of the 134 Inflected Vocabulary Items

The 134 words that do not appear in their verbatim dictionary citation form reflect natural Hindi syntax rather than missing vocabulary:
1. **Verb Citation Infinitives (`-ना` ending, 91 words)**:
   - Dictionary citation forms like *सकना*, *मिलना*, *चाहना*, *जानना*, *पढ़ना*, *लाना*, *उठाना*, *दिखाना* naturally conjugate into finite verbs in sentences (*सकता*, *मिले*, *चाहिए*, *जानते*, *पढ़कर*, *लाया*, *उठाया*, *दिखाया*).
2. **Marked Masculine Nouns & Adjectives (`-ा` ending, 32 words)**:
   - Base words like *बच्चा*, *रुपया*, *महीना*, *काला*, *हरा*, *बुरा*, *तीसरा* naturally take oblique or plural inflections in context (*बच्चे / बच्चों*, *रुपये*, *महीने*, *काले*, *बुरे*).
3. **Pluralized & Derivative Forms (11 words)**:
   - Words like *आँख* (appears as plural *आँखें*), *साँस* (*साँसें*), *होंठ* (*होंठों*), *अधिकार* (*अधिकारों*), *शिल्प* (*शिल्पकला / वास्तुशिल्प*), *लचक* (*लचकदार*).
   - In all such cases, Hint Mode provides the full meaning and displays the original root headword as a reference chip.

---

## 5. Project Scripts

| Script | Purpose |
|---|---|
| `scripts/validate_phrases.py` | Validates ID sequence, 4–12 word limit, 4-word vocab coverage, and absence of `।` |
| `scripts/inspect_idioms.py` | Detects occurrences of Hindi idioms/muhavare in the dataset |
| `scripts/authoring_pipeline.py` | Batches vocabulary into 4-word clusters for iterative authoring |

---

## 6. Validation & Local Development

Run validation checks:
```bash
python3 scripts/validate_phrases.py
python3 scripts/inspect_idioms.py
```

Serve the web app locally:
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000` in any web browser.

---

## 7. Phrase Refinement Plan & Guidelines

To ensure maximum linguistic effectiveness and instructional value across the 1,200 phrases, refinements are conducted in structured **batches of 50 phrases** (24 batches across 3 files):

- **Batch Structure**:
  - `data/phrases01.json`: Batches 1 to 8 (Phrases 1–400)
  - `data/phrases02.json`: Batches 9 to 16 (Phrases 401–800)
  - `data/phrases03.json`: Batches 17 to 24 (Phrases 801–1200)

- **Guiding Principles**:
  1. **Natural Grammar Over Rigid Exact Matching**: Always prioritize natural, idiomatic Hindi sentence structure first. Use exact root headwords wherever it sounds natural, but never force awkward phrasing solely to achieve an exact root match.
  2. **`vocab.json` Immutability**: All 4,800 headwords in `vocab.json` remain untouched.
  3. **`dict.json` Synchronization**: Any new word forms, inflections, or auxiliary tokens introduced in a batch must be verified against `data/dict.json`, ensuring 100% gloss coverage.
  4. **Strict Constraints**: Every refined sentence must adhere to 4–12 words, zero purna virams (`।`), and cover all 4 assigned target vocabulary words ($4N-3 \dots 4N$).
- **Refinement Progress**:
  - **Batch 1 (1–50)**: Refined IDs 5, 28, 29, 32, 38, 48, 49.
  - **Batch 2 (51–100)**: Refined ID 78.
  - **Batch 3 (101–150)**: Audited; verified all 50 phrases.
  - **Batch 4 (151–200)**: Refined IDs 181, 182, 189, 190.
  - **Batch 5 (201–250)**: Refined IDs 209, 241.
  - **Batch 6 (251–300)**: Refined IDs 258, 274, 277.
  - **Batch 7 (301–350)**: Audited; verified all 50 phrases.
  - **Batch 8 (351–400)**: Audited; verified all 50 phrases.
  - **Batch 9 (401–450)**: Audited; verified all 50 phrases.
  - **Batch 10 (451–500)**: Refined IDs 455, 469, 483, 485.
  - **Batch 11 (501–550)**: Audited; verified all 50 phrases.
  - **Batch 12 (551–600)**: Refined ID 597.
  - **Batch 13 (601–650)**: Refined ID 639.
  - **Batch 14 (651–700)**: Audited; verified all 50 phrases.
  - **Batch 15 (701–750)**: Audited; verified all 50 phrases.
  - **Batch 16 (751–800)**: Audited; verified all 50 phrases.
  - **Batch 17 (801–850)**: Refined ID 820.
  - **Batch 18 (851–900)**: Refined IDs 869, 882.
  - **Batch 19 (901–950)**: Audited; verified all 50 phrases.
  - **Batch 20 (951–1000)**: Audited; verified all 50 phrases.
  - **Batch 21 (1001–1050)**: Audited; verified all 50 phrases.
  - **Batch 22 (1051–1100)**: Refined IDs 1095, 1100.
  - **Batch 23 (1101–1150)**: Refined IDs 1120, 1133.
  - **Batch 24 (1151–1200)**: Audited; verified all 50 phrases.
  - **Status**: **100% Complete!** All 24 batches (1,200 phrases, 4,800 targets) fully audited, refined, and validated with 0 errors and 100% `dict.json` coverage.
