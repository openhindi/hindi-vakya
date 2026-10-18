"use strict";

/**
 * Hindi Vakya — Single Game: Word Bridge & Completed Vocabulary Stats
 * Minimal black and white theme, mobile-first design.
 */

(() => {
  const STORAGE_KEY = "hindi_vakya_state_v1";

  // State
  let vocab = []; // 4800 items: { id, hi, en }
  let vocabMap = new Map(); // hi -> en
  let sentences = []; // 1200 items: { id, hi, en, words }
  let activeSentenceIndex = 0; // 0-indexed (0 to 1199)
  let hintsEnabled = false;

  // Persisted state: { lastSentenceId: number, completedSentences: { [id]: number } }
  let userProgress = {
    lastSentenceId: 1,
    completedSentences: {}
  };

  // Word Bridge Game State
  let currentSentence = null;
  let placedIndices = []; // array of original indices in sentence.words
  let shuffledPool = []; // array of { word, origIndex, isDistractor, meaning }
  let roundCompleted = false;

  // Stats table state
  let renderedWordCount = 0;
  const WORDS_CHUNK_SIZE = 100;
  let completedWordsCache = [];

  // DOM Elements cache
  const dom = {};
  const $ = id => document.getElementById(id);

  function cacheDom() {
    [
      "tab-play-btn", "tab-stats-btn",
      "view-play", "view-stats",
      "titlebar-sentences-count",
      "btn-prev-sentence", "btn-next-sentence", "btn-reset-sentence",
      "sentence-index-label", "sentence-completed-badge",
      "btn-toggle-hint",
      "en-sentence-text", "bridge-slots", "bridge-chips",
      // Stats
      "stats-words-count", "stats-progress-bar",
      "words-table-body", "table-load-more", "table-status-text",
      "btn-reset-stats",
      // Dialog
      "app-dialog", "dialog-title", "dialog-message", "dialog-cancel-btn", "dialog-confirm-btn"
    ].forEach(id => {
      dom[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = $(id);
    });
  }

  /* ---------------------------------------------------------------------
   * LocalStorage & Persistence
   * ------------------------------------------------------------------- */
  function loadSavedProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          userProgress.lastSentenceId = Number(parsed.lastSentenceId) || 1;
          userProgress.completedSentences = parsed.completedSentences || {};
        }
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userProgress));
    } catch (e) {
      console.warn("Storage save error:", e);
    }
  }

  function isSentenceCompleted(sentenceId) {
    return (userProgress.completedSentences[sentenceId] || 0) > 0;
  }

  function isWordCompleted(wordId) {
    // Word ID N is marked completed when Sentence ceil(N / 4) is completed
    const sentenceId = Math.ceil(wordId / 4);
    return isSentenceCompleted(sentenceId);
  }

  function countUniqueSentencesCompleted() {
    let count = 0;
    for (let id = 1; id <= 1200; id++) {
      if (isSentenceCompleted(id)) count++;
    }
    return count;
  }

  function countUniqueWordsCompleted() {
    let count = 0;
    for (let id = 1; id <= 1200; id++) {
      if (isSentenceCompleted(id)) count += 4;
    }
    return Math.min(count, 4800);
  }

  /* ---------------------------------------------------------------------
   * Data Loading & Dictionary
   * ------------------------------------------------------------------- */
  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  async function initData() {
    const [vocabData, phrases1, phrases2, phrases3] = await Promise.all([
      fetchJson("data/vocab.json"),
      fetchJson("data/phrases01.json"),
      fetchJson("data/phrases02.json"),
      fetchJson("data/phrases03.json")
    ]);

    vocab = vocabData;
    vocab.forEach(v => {
      if (v.hi && v.en) {
        vocabMap.set(v.hi.trim(), v.en.trim());
      }
    });

    const allPhrases = [...phrases1, ...phrases2, ...phrases3];
    allPhrases.sort((a, b) => a.id - b.id);

    sentences = allPhrases.map(p => ({
      id: p.id,
      hi: p.hi.trim(),
      en: p.en.trim(),
      words: p.hi.trim().split(/\s+/)
    }));

    loadSavedProgress();

    const savedId = userProgress.lastSentenceId || 1;
    activeSentenceIndex = Math.max(0, Math.min(savedId - 1, sentences.length - 1));

    updateAllSummaries();
    loadSentence(activeSentenceIndex);
  }

  function getWordMeaning(hindiWord) {
    if (!hindiWord) return "";
    const clean = hindiWord.trim();
    if (vocabMap.has(clean)) return vocabMap.get(clean);

    // Stem match for inflected verb/adjective forms (e.g. गया -> जाना, गाती -> गाना, बड़े -> बड़ा)
    for (const [vHi, vEn] of vocabMap.entries()) {
      if (clean.startsWith(vHi.slice(0, Math.max(2, vHi.length - 1)))) {
        return vEn;
      }
    }
    return "";
  }

  /* ---------------------------------------------------------------------
   * Word Bridge Game Engine
   * ------------------------------------------------------------------- */
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function setHintsState(enabled) {
    hintsEnabled = enabled;
    if (dom.btnToggleHint) {
      dom.btnToggleHint.classList.toggle("active", hintsEnabled);
    }
    document.body.classList.toggle("show-hints", hintsEnabled);
  }

  function loadSentence(index) {
    if (index < 0 || index >= sentences.length) return;
    activeSentenceIndex = index;
    currentSentence = sentences[index];
    userProgress.lastSentenceId = currentSentence.id;
    saveProgress();

    roundCompleted = false;
    placedIndices = [];

    // Hint must go off automatically on sentence change
    setHintsState(false);

    // Navigation buttons
    dom.btnPrevSentence.disabled = (index === 0);
    dom.btnNextSentence.disabled = (index === sentences.length - 1);

    // Meta: simply "1 / 1200"
    dom.sentenceIndexLabel.textContent = `${currentSentence.id} / ${sentences.length}`;
    const times = userProgress.completedSentences[currentSentence.id] || 0;
    dom.sentenceCompletedBadge.textContent = `${times}x`;
    dom.sentenceCompletedBadge.classList.toggle("done", times > 0);

    // English text
    dom.enSentenceText.textContent = currentSentence.en;

    // Pick 1-2 distractor words directly from vocab.json (not present in current sentence or target vocab)
    const words = currentSentence.words;
    const currentWordsSet = new Set(words);
    const targetVocabIds = [4 * currentSentence.id - 3, 4 * currentSentence.id - 2, 4 * currentSentence.id - 1, 4 * currentSentence.id];
    const targetVocabWords = new Set(targetVocabIds.map(vid => vocab[vid - 1]?.hi.trim()).filter(Boolean));

    const distractorCandidates = [];
    const distractorCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 distractors
    let attempts = 0;

    while (distractorCandidates.length < distractorCount && attempts < 100) {
      attempts++;
      const randomIdx = Math.floor(Math.random() * vocab.length);
      const candidateItem = vocab[randomIdx];
      if (candidateItem && candidateItem.hi && candidateItem.en) {
        const cWord = candidateItem.hi.trim();
        if (!currentWordsSet.has(cWord) &&
            !targetVocabWords.has(cWord) &&
            !distractorCandidates.some(d => d.hi === cWord)) {
          distractorCandidates.push({
            hi: cWord,
            en: candidateItem.en.trim()
          });
        }
      }
    }

    // The 4 vocabulary words for sentence N are words (4N-3) to (4N)
    const targetVocabItems = targetVocabIds.map(vid => vocab[vid - 1]).filter(Boolean);

    // Target words that match exactly in the sentence
    const sentenceWordSet = new Set(words);

    // Missing target vocab words (ones not present in exact root form)
    const missingVocabItems = targetVocabItems.filter(tv => !sentenceWordSet.has(tv.hi.trim()));

    // Common irregular forms helper
    const irregulars = {
      "जाना": ["गया", "गई", "गए", "जा", "जाता", "जाती", "जाते", "जाइए", "जाओ"],
      "करना": ["किया", "की", "किए", "कर", "करता", "करती", "करते", "कीजिए", "करो"],
      "होना": ["था", "थी", "थे", "थीं", "हो", "होता", "होती", "होते", "हुए", "हुआ", "हुई", "होगा", "होगी", "होंगे"],
      "देना": ["दिया", "दी", "दिए", "दे", "देता", "देती", "देते", "दीजिए", "दो"],
      "लेना": ["लिया", "ली", "लिए", "ले", "लेता", "लेती", "लेते", "लीजिए", "लो"]
    };

    function isInflectionOf(token, root) {
      if (token === root) return false;
      if (irregulars[root] && irregulars[root].includes(token)) return true;
      let base = root;
      if (root.endsWith("ना")) {
        base = root.slice(0, -2);
      } else if (root.endsWith("ा") || root.endsWith("े") || root.endsWith("ी")) {
        base = root.slice(0, -1);
      }
      if (base.length >= 2 && token.startsWith(base)) return true;
      if (token.startsWith(root)) return true;
      return false;
    }

    // Set of tokens in sentence that represent inflected forms of missing target words
    const inflectedTargetTokens = new Set();
    missingVocabItems.forEach(tv => {
      const root = tv.hi.trim();
      words.forEach(w => {
        if (isInflectionOf(w, root)) {
          inflectedTargetTokens.add(w);
        }
      });
    });

    const targetHiSet = new Set(targetVocabItems.map(tv => tv.hi.trim()));

    const pool = words.map((w, idx) => {
      const isExactTarget = targetHiSet.has(w);
      const isInflected = inflectedTargetTokens.has(w);

      return {
        word: w,
        origIndex: idx,
        isDistractor: false,
        isTargetVocab: isExactTarget,
        isInflectedTarget: isInflected,
        // No meaning shown for inflected form in the hint!
        meaning: isInflected ? "" : getWordMeaning(w)
      };
    }).concat(distractorCandidates.map((dw, dIdx) => ({
      word: dw.hi,
      origIndex: -100 - dIdx,
      isDistractor: true,
      isTargetVocab: false,
      isInflectedTarget: false,
      // Meaning taken directly from vocab.json!
      meaning: dw.en
    })));

    shuffledPool = shuffle(pool);

    renderSlots();
    renderChips(missingVocabItems);
  }

  function renderSlots() {
    const words = currentSentence.words;
    // Slots display ONLY Hindi text without English hints
    dom.bridgeSlots.innerHTML = words.map((w, idx) => {
      const isFilled = placedIndices.includes(idx);
      if (isFilled) {
        return `
          <div class="bridge-slot filled good" data-slot-idx="${idx}">
            <span class="slot-hi-text">${w}</span>
          </div>
        `;
      }
      return `
        <div class="bridge-slot" data-slot-idx="${idx}">
          <span class="slot-hi-text">?</span>
        </div>
      `;
    }).join("");
  }

  function renderChips(missingVocabItems = []) {
    // 1. Playable word chips:
    // - Exact target words: orange (.target-vocab)
    // - Inflected target words: violet (.inflected-vocab), no meaning shown
    const playableChipsHtml = shuffledPool.map((item, i) => {
      const isUsed = !item.isDistractor && placedIndices.includes(item.origIndex);
      let specialClass = "";
      if (item.isTargetVocab) {
        specialClass = "target-vocab";
      } else if (item.isInflectedTarget) {
        specialClass = "inflected-vocab";
      }

      return `
        <button type="button" class="word-chip ${isUsed ? 'used' : ''} ${specialClass}" data-chip-idx="${i}">
          <span class="chip-hi-text">${item.word}</span>
          ${item.meaning ? `<span class="chip-en-gloss">${item.meaning}</span>` : ''}
        </button>
      `;
    }).join("");

    // 2. Unselectable original words in grey-shaded violet (.ref-vocab-chip)
    // Shown only when hint is toggled (.show-hints), cannot be clicked
    const refChipsHtml = missingVocabItems.map(ref => `
      <div class="word-chip ref-vocab-chip" title="Original vocabulary word: ${ref.hi}" aria-disabled="true">
        <span class="chip-hi-text">${ref.hi}</span>
        <span class="chip-en-gloss">${ref.en}</span>
      </div>
    `).join("");

    dom.bridgeChips.innerHTML = playableChipsHtml + refChipsHtml;
  }

  function handleChipClick(chipIdx, chipEl) {
    if (roundCompleted) return;
    const item = shuffledPool[chipIdx];
    if (!item) return;

    const nextExpectedIndex = placedIndices.length;

    // Check if correct next sequential word
    if (!item.isDistractor && item.origIndex === nextExpectedIndex) {
      placedIndices.push(item.origIndex);
      renderSlots();
      renderChips();

      // Check if complete
      if (placedIndices.length === currentSentence.words.length) {
        onRoundWon();
      }
    } else {
      // Wrong tap animation
      chipEl.classList.add("shake-bad");
      setTimeout(() => chipEl.classList.remove("shake-bad"), 380);
    }
  }

  function onRoundWon() {
    roundCompleted = true;

    // Track sentence completion count
    const sId = currentSentence.id;
    userProgress.completedSentences[sId] = (userProgress.completedSentences[sId] || 0) + 1;
    saveProgress();

    // Update UI badge & summaries
    const times = userProgress.completedSentences[sId];
    dom.sentenceCompletedBadge.textContent = `${times}x`;
    dom.sentenceCompletedBadge.classList.add("done");
    updateAllSummaries();
  }

  /* ---------------------------------------------------------------------
   * Stats & Completed Words Table Rendering
   * ------------------------------------------------------------------- */
  function updateAllSummaries() {
    const sDone = countUniqueSentencesCompleted();
    const wDone = countUniqueWordsCompleted();

    // Header Titlebar summary
    dom.titlebarSentencesCount.textContent = sDone;

    // Stats View hero
    dom.statsWordsCount.textContent = wDone;
    const pct = ((wDone / 4800) * 100).toFixed(1);
    dom.statsProgressBar.style.width = `${pct}%`;
  }

  function renderCompletedWords() {
    completedWordsCache = vocab.filter(item => isWordCompleted(item.id));
    renderedWordCount = 0;
    dom.wordsTableBody.innerHTML = "";

    if (completedWordsCache.length === 0) {
      dom.wordsTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-cell">No completed words yet. Play sentences to complete words!</td>
        </tr>
      `;
      dom.tableLoadMore.hidden = true;
      return;
    }

    loadMoreCompletedWords();
  }

  function loadMoreCompletedWords() {
    if (renderedWordCount >= completedWordsCache.length) {
      // All loaded: keep footer hidden (no "Showing all X completed words" message)
      dom.tableLoadMore.hidden = true;
      return;
    }

    const nextBatch = completedWordsCache.slice(renderedWordCount, renderedWordCount + WORDS_CHUNK_SIZE);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-no">${item.id}</td>
        <td class="col-word">
          <div class="word-cell">
            <span class="word-hi">${item.hi}</span>
            <span class="word-en">${item.en}</span>
          </div>
        </td>
        <td class="col-done">
          <span class="tick-badge" title="Completed">
            <svg class="icon icon-done"><use href="#i-check"/></svg>
          </span>
        </td>
      `;
      fragment.appendChild(tr);
    });

    dom.wordsTableBody.appendChild(fragment);
    renderedWordCount += nextBatch.length;

    // Only show footer indicator while more records exist to be scrolled
    if (renderedWordCount < completedWordsCache.length) {
      dom.tableLoadMore.hidden = false;
      dom.tableStatusText.textContent = `Scroll down for more (${renderedWordCount} / ${completedWordsCache.length})`;
    } else {
      dom.tableLoadMore.hidden = true;
    }
  }

  /* ---------------------------------------------------------------------
   * Event Handlers & View Switching
   * ------------------------------------------------------------------- */
  function switchTab(target) {
    if (target === "play") {
      dom.tabPlayBtn.classList.add("active");
      dom.tabPlayBtn.setAttribute("aria-selected", "true");
      dom.tabStatsBtn.classList.remove("active");
      dom.tabStatsBtn.setAttribute("aria-selected", "false");

      dom.viewPlay.hidden = false;
      dom.viewPlay.classList.add("active");
      dom.viewStats.hidden = true;
      dom.viewStats.classList.remove("active");
    } else {
      dom.tabStatsBtn.classList.add("active");
      dom.tabStatsBtn.setAttribute("aria-selected", "true");
      dom.tabPlayBtn.classList.remove("active");
      dom.tabPlayBtn.setAttribute("aria-selected", "false");

      dom.viewStats.hidden = false;
      dom.viewStats.classList.add("active");
      dom.viewPlay.hidden = true;
      dom.viewPlay.classList.remove("active");

      // Render stats view with completed words only
      updateAllSummaries();
      renderCompletedWords();
    }
  }

  function setupEvents() {
    // Tabs
    dom.tabPlayBtn.addEventListener("click", () => switchTab("play"));
    dom.tabStatsBtn.addEventListener("click", () => switchTab("stats"));

    // Previous / Next Buttons
    dom.btnPrevSentence.addEventListener("click", () => {
      if (activeSentenceIndex > 0) {
        loadSentence(activeSentenceIndex - 1);
      }
    });

    dom.btnNextSentence.addEventListener("click", () => {
      if (activeSentenceIndex < sentences.length - 1) {
        loadSentence(activeSentenceIndex + 1);
      }
    });

    // Reset current sentence completion count to zero
    dom.btnResetSentence.addEventListener("click", () => {
      if (!currentSentence) return;
      const sId = currentSentence.id;
      delete userProgress.completedSentences[sId];
      saveProgress();

      // Update badge, summaries, and reload round
      updateAllSummaries();
      loadSentence(activeSentenceIndex);
    });

    // Hint toggle button
    dom.btnToggleHint.addEventListener("click", () => {
      setHintsState(!hintsEnabled);
    });

    // Keyboard navigation: Left Arrow -> Previous, Right Arrow -> Next
    window.addEventListener("keydown", e => {
      // Only navigate when Play tab is active and not inside input/dialog
      if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (dom.appDialog && dom.appDialog.open) return;
      if (!dom.viewPlay || dom.viewPlay.hidden) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeSentenceIndex > 0) {
          loadSentence(activeSentenceIndex - 1);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (activeSentenceIndex < sentences.length - 1) {
          loadSentence(activeSentenceIndex + 1);
        }
      }
    });

    // Chips click handler
    dom.bridgeChips.addEventListener("click", e => {
      const chip = e.target.closest(".word-chip");
      if (!chip || chip.classList.contains("used")) return;
      const idx = Number(chip.dataset.chipIdx);
      handleChipClick(idx, chip);
    });

    // Infinite scroll on stats table
    const tableContainer = document.querySelector(".words-table-container");
    if (tableContainer) {
      tableContainer.addEventListener("scroll", () => {
        const { scrollTop, scrollHeight, clientHeight } = tableContainer;
        if (scrollTop + clientHeight >= scrollHeight - 80) {
          loadMoreCompletedWords();
        }
      });
    }

    // Reset button
    dom.btnResetStats.addEventListener("click", () => {
      dom.appDialog.showModal();
    });

    dom.dialogConfirmBtn.addEventListener("click", () => {
      userProgress = {
        lastSentenceId: 1,
        completedSentences: {}
      };
      saveProgress();
      updateAllSummaries();
      renderCompletedWords();
      loadSentence(0);
      dom.appDialog.close();
    });

    dom.dialogCancelBtn.addEventListener("click", () => {
      dom.appDialog.close();
    });
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    cacheDom();
    setupEvents();
    initData().catch(err => {
      console.error("Initialization failed:", err);
      dom.enSentenceText.textContent = "Error loading sentences. Please ensure data files are present.";
    });
  });
})();
