# Hindi Vakya (हिंदी वाक्य)

A corpus of **1,200 grammatically structured Hindi phrases and sentences** with English translations, covering **4,800 vocabulary words** from [`data/vocab.json`](data/vocab.json).

## Structure & Rules

- **Data Division**: 1,200 phrases organized into 3 files of 400 phrases each:
  - `data/phrases01.json`: IDs `1` to `400` (covering words 1–1600)
  - `data/phrases02.json`: IDs `401` to `800` (covering words 1601–3200)
  - `data/phrases03.json`: IDs `801` to `1200` (covering words 3201–4800)
- **JSON Schema**:
  ```json
  {
    "id": 1,
    "hi": "मैं जानता हूँ कि इस मामले के पीछे कोई रहस्य नहीं है",
    "en": "I know that there is no secret behind this matter"
  }
  ```
- **Word Limits**: Each Hindi sentence contains between **4 and 12 words**.
- **Vocab Coverage**: Sentence $N$ mandatorily embeds words $(4N-3)$ through $(4N)$ from `vocab.json` (root or grammatical inflection).
- **Punctuation**: **No purna viram (`।`)** is used in any sentence.
- **Grammar & Idioms**: Comprehensive coverage across Hindi tenses, moods, aspects, ergative cases, dative constructions, and idioms (*मुहावरे*).

## Project Scripts

| Script | Purpose |
|---|---|
| `scripts/validate_phrases.py` | Validates ID sequence, 4–12 word limit, 4-word vocab coverage, and absence of `।` |
| `scripts/inspect_idioms.py` | Detects occurrences of Hindi idioms/muhavare in the dataset |
| `scripts/authoring_pipeline.py` | Batches vocabulary into 4-word clusters for iterative authoring |

## Validation & Status Check

Run validation checks:
```bash
python3 scripts/validate_phrases.py
python3 scripts/inspect_idioms.py
```
