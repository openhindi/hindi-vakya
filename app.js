"use strict";

/**
 * Hindi Vakya — Single Game: Word Bridge & Vocabulary Stats
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
  let shuffledPool = []; // array of { word, origIndex, isDistractor }
  let roundCompleted = false;

  // Stats table state
  let currentFilter = "all"; // 'all' | 'done' | 'pending'
  let searchQuery = "";
  let renderedWordCount = 0;
  const WORDS_CHUNK_SIZE = 100;
  let filteredVocabCache = [];

  // DOM Elements cache
  const dom = {};
  const $ = id => document.getElementById(id);

  function cacheDom() {
    [
      "tab-play-btn", "tab-stats-btn",
      "view-play", "view-stats",
      "summary-sentences-count", "summary-words-count",
      "btn-prev-sentence", "btn-next-sentence",
      "sentence-index-label", "sentence-completed-badge",
      "btn-toggle-hint",
      "en-sentence-text", "bridge-slots", "bridge-chips",
      "round-complete-banner", "btn-advance-sentence",
      // Stats
      "stats-words-count", "stats-progress-bar",
      "stats-search-input", "filter-all-btn", "filter-done-btn", "filter-pending-btn",
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
    // 4 words per completed sentence
    let count = 0;
    for (let id = 1; id <= 1200; id++) {
      if (isSentenceCompleted(id)) count += 4;
    }
    return Math.min(count, 4800);
  }

  /* ---------------------------------------------------------------------
   * Data Loading
   * ------------------------------------------------------------------- */
  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  async function initData() {
    // Load vocab.json and all 3 phrases JSON files in parallel
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
    // Sort by id to ensure strictly sequential ordering
    allPhrases.sort((a, b) => a.id - b.id);

    sentences = allPhrases.map(p => ({
      id: p.id,
      hi: p.hi.trim(),
      en: p.en.trim(),
      words: p.hi.trim().split(/\s+/)
    }));

    loadSavedProgress();

    // Determine initial active sentence
    const savedId = userProgress.lastSentenceId || 1;
    activeSentenceIndex = Math.max(0, Math.min(savedId - 1, sentences.length - 1));

    updateAllSummaries();
    loadSentence(activeSentenceIndex);
  }

  function getWordMeaning(hindiWord) {
    if (!hindiWord) return "";
    const clean = hindiWord.replace(/[^\w\u0900-\u097F]/g, "").trim();
    if (vocabMap.has(clean)) return vocabMap.get(clean);
    if (vocabMap.has(hindiWord)) return vocabMap.get(hindiWord);
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

  function loadSentence(index) {
    if (index < 0 || index >= sentences.length) return;
    activeSentenceIndex = index;
    currentSentence = sentences[index];
    userProgress.lastSentenceId = currentSentence.id;
    saveProgress();

    roundCompleted = false;
    placedIndices = [];

    // Update navigation buttons
    dom.btnPrevSentence.disabled = (index === 0);
    dom.btnNextSentence.disabled = (index === sentences.length - 1);

    // Update Meta
    dom.sentenceIndexLabel.textContent = `Sentence ${currentSentence.id} / ${sentences.length}`;
    const times = userProgress.completedSentences[currentSentence.id] || 0;
    dom.sentenceCompletedBadge.textContent = `${times}x`;
    dom.sentenceCompletedBadge.classList.toggle("done", times > 0);

    // English text
    dom.enSentenceText.textContent = currentSentence.en;

    // Hide complete banner
    dom.roundCompleteBanner.hidden = true;

    // Pick 1-2 distractor words from a different sentence
    const words = currentSentence.words;
    const distractorCandidates = [];
    const otherSentence = sentences[(index + 7) % sentences.length];
    if (otherSentence) {
      for (const dw of otherSentence.words) {
        if (!words.includes(dw) && !distractorCandidates.includes(dw)) {
          distractorCandidates.push(dw);
          if (distractorCandidates.length >= 2) break;
        }
      }
    }

    const pool = words.map((w, idx) => ({
      word: w,
      origIndex: idx,
      isDistractor: false
    })).concat(distractorCandidates.map((dw, dIdx) => ({
      word: dw,
      origIndex: -100 - dIdx,
      isDistractor: true
    })));

    shuffledPool = shuffle(pool);

    renderSlots();
    renderChips();
  }

  function renderSlots() {
    const words = currentSentence.words;
    dom.bridgeSlots.innerHTML = words.map((w, idx) => {
      const isFilled = placedIndices.includes(idx);
      const meaning = getWordMeaning(w);
      if (isFilled) {
        return `
          <div class="bridge-slot filled good" data-slot-idx="${idx}">
            <span class="slot-hi-text">${w}</span>
            <span class="slot-en-gloss">${meaning}</span>
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

  function renderChips() {
    dom.bridgeChips.innerHTML = shuffledPool.map((item, i) => {
      const isUsed = !item.isDistractor && placedIndices.includes(item.origIndex);
      const meaning = getWordMeaning(item.word);
      return `
        <button type="button" class="word-chip ${isUsed ? 'used' : ''}" data-chip-idx="${i}">
          <span class="chip-hi-text">${item.word}</span>
          <span class="chip-en-gloss">${meaning}</span>
        </button>
      `;
    }).join("");
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

    // Show completion banner - stays on current sentence until user clicks Next!
    dom.roundCompleteBanner.hidden = false;
  }

  /* ---------------------------------------------------------------------
   * Stats & Words Table Rendering (Chunked / Lazy Loaded)
   * ------------------------------------------------------------------- */
  function updateAllSummaries() {
    const sDone = countUniqueSentencesCompleted();
    const wDone = countUniqueWordsCompleted();

    // Play View summary
    dom.summarySentencesCount.textContent = sDone;
    dom.summaryWordsCount.textContent = wDone;

    // Stats View hero
    dom.statsWordsCount.textContent = wDone;
    const pct = ((wDone / 4800) * 100).toFixed(1);
    dom.statsProgressBar.style.width = `${pct}%`;
  }

  function applyStatsFilters() {
    const q = searchQuery.toLowerCase().trim();
    filteredVocabCache = vocab.filter(item => {
      const done = isWordCompleted(item.id);
      if (currentFilter === "done" && !done) return false;
      if (currentFilter === "pending" && done) return false;

      if (q) {
        const matchesHi = item.hi && item.hi.toLowerCase().includes(q);
        const matchesEn = item.en && item.en.toLowerCase().includes(q);
        return matchesHi || matchesEn;
      }
      return true;
    });

    renderedWordCount = 0;
    dom.wordsTableBody.innerHTML = "";
    loadMoreWords();
  }

  function loadMoreWords() {
    if (renderedWordCount >= filteredVocabCache.length) {
      dom.tableStatusText.textContent = filteredVocabCache.length === 0
        ? "No matching vocabulary found."
        : `Showing all ${filteredVocabCache.length} words`;
      return;
    }

    const nextBatch = filteredVocabCache.slice(renderedWordCount, renderedWordCount + WORDS_CHUNK_SIZE);
    const fragment = document.createDocumentFragment();

    nextBatch.forEach(item => {
      const tr = document.createElement("tr");
      const done = isWordCompleted(item.id);

      tr.innerHTML = `
        <td class="col-no">${item.id}</td>
        <td class="col-word">
          <div class="word-cell">
            <span class="word-hi">${item.hi}</span>
            <span class="word-en">${item.en}</span>
          </div>
        </td>
        <td class="col-done">
          ${done
            ? '<span class="tick-badge" title="Completed"><svg class="icon icon-done"><use href="#i-check"/></svg></span>'
            : '<span class="tick-empty">&bull;</span>'
          }
        </td>
      `;
      fragment.appendChild(tr);
    });

    dom.wordsTableBody.appendChild(fragment);
    renderedWordCount += nextBatch.length;

    if (renderedWordCount < filteredVocabCache.length) {
      dom.tableStatusText.textContent = `Showing ${renderedWordCount} of ${filteredVocabCache.length} words (Scroll down for more)`;
    } else {
      dom.tableStatusText.textContent = `Showing all ${filteredVocabCache.length} words`;
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

      // Render stats view
      updateAllSummaries();
      applyStatsFilters();
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

    // Advance button from completion banner
    dom.btnAdvanceSentence.addEventListener("click", () => {
      if (activeSentenceIndex < sentences.length - 1) {
        loadSentence(activeSentenceIndex + 1);
      }
    });

    // Hint toggle button
    dom.btnToggleHint.addEventListener("click", () => {
      hintsEnabled = !hintsEnabled;
      dom.btnToggleHint.classList.toggle("active", hintsEnabled);
      document.body.classList.toggle("show-hints", hintsEnabled);
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
          loadMoreWords();
        }
      });
    }

    // Search input
    let searchDebounceTimer = null;
    dom.statsSearchInput.addEventListener("input", e => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchQuery = e.target.value;
        applyStatsFilters();
      }, 200);
    });

    // Filter pills
    const pillButtons = [dom.filterAllBtn, dom.filterDoneBtn, dom.filterPendingBtn];
    function setFilterActive(btn, filter) {
      pillButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = filter;
      applyStatsFilters();
    }

    dom.filterAllBtn.addEventListener("click", () => setFilterActive(dom.filterAllBtn, "all"));
    dom.filterDoneBtn.addEventListener("click", () => setFilterActive(dom.filterDoneBtn, "done"));
    dom.filterPendingBtn.addEventListener("click", () => setFilterActive(dom.filterPendingBtn, "pending"));

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
      applyStatsFilters();
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
