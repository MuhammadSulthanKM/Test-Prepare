/**
 * IBM QE-FULLSTACK QUIZ — Chunked Lazy Topic Loader (loader.js)
 * ==============================================================
 * Each topic is split into multiple part files (~100 q each).
 * Part files use: window.QUIZ_BANK[topicId] = (window.QUIZ_BANK[topicId]||[]).concat([...])
 * so they safely accumulate without overwriting each other.
 *
 * The TOPIC_MANIFEST defines every part file per topic.
 * loadTopics() loads all parts for the requested topics in parallel.
 */
'use strict';

(function () {
  /* ── Global registry initialisation ─────────────────────── */
  if (!window.QUIZ_BANK) window.QUIZ_BANK = {};

  /* ── Manifest: topic id → ordered array of part file names ─ */
  const TOPIC_MANIFEST = {
    'core-testing':   ['topic-01-core-testing-p1','topic-01-core-testing-p2','topic-01-core-testing-p3','topic-01-core-testing-p4'],
    'sql-db':         ['topic-02-sql-db-p1','topic-02-sql-db-p2','topic-02-sql-db-p3','topic-02-sql-db-p4'],
    'java':           ['topic-03-java-p1','topic-03-java-p2','topic-03-java-p3','topic-03-java-p4'],
    'javascript':     ['topic-04-javascript-p1','topic-04-javascript-p2','topic-04-javascript-p3','topic-04-javascript-p4'],
    'python':         ['topic-05-python-p1','topic-05-python-p2','topic-05-python-p3','topic-05-python-p4'],
    'testng':         ['topic-06-testng-p1','topic-06-testng-p2','topic-06-testng-p3','topic-06-testng-p4'],
    'mobile-testing': ['topic-07-mobile-testing-p1','topic-07-mobile-testing-p2','topic-07-mobile-testing-p3','topic-07-mobile-testing-p4'],
    'api-postman':    ['topic-08-api-postman-p1','topic-08-api-postman-p2','topic-08-api-postman-p3','topic-08-api-postman-p4'],
    'git-github':     ['topic-09-git-github-p1','topic-09-git-github-p2','topic-09-git-github-p3','topic-09-git-github-p4'],
    'cucumber':       ['topic-10-cucumber-p1','topic-10-cucumber-p2','topic-10-cucumber-p3','topic-10-cucumber-p4'],
    'selenium':       ['topic-11-selenium-p1','topic-11-selenium-p2'], // extend when p3–p4 are added
    'playwright':     ['topic-12-playwright-p1','topic-12-playwright-p2','topic-12-playwright-p3','topic-12-playwright-p4'],
    'junit':          ['topic-13-junit-p1','topic-13-junit-p2','topic-13-junit-p3','topic-13-junit-p4'],
    'code-challenges': ['topic-14-code-challenges-p1','topic-14-code-challenges-p2'],
  };

  const BASE_PATH = 'js/questions/';

  /* track injected scripts to prevent double-load */
  const _injected = new Set();

  /**
   * Inject a single script file. Resolves when window.QUIZ_BANK[topicId]
   * has grown (the part file concat'd into it).
   */
  function injectScript(filename) {
    return new Promise((resolve) => {
      if (_injected.has(filename)) { resolve(); return; }
      _injected.add(filename);

      const script  = document.createElement('script');
      script.src    = BASE_PATH + filename + '.js';
      script.async  = false; // preserve order within a topic's parts
      script.onload = () => resolve();
      script.onerror = () => {
        // Warn but resolve so a missing part file doesn't abort the whole quiz
        console.warn('[QuizLoader] Part file not found (skipped):', script.src);
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load all parts for a single topic sequentially, then return the array.
   */
  async function loadTopic(topicId) {
    const parts = TOPIC_MANIFEST[topicId];
    if (!parts) throw new Error('Unknown topic: ' + topicId);

    for (const filename of parts) {
      await injectScript(filename);
    }

    return window.QUIZ_BANK[topicId] || [];
  }

  /**
   * Public API: load multiple topics in parallel, collect all questions.
   * @param {string[]} topicIds
   * @param {Function} onAllDone  — called with combined question array
   * @param {Function} onError    — called on any failure
   */
  function loadTopics(topicIds, onAllDone, onError) {
    const ids = topicIds.includes('all')
      ? Object.keys(TOPIC_MANIFEST)
      : topicIds;

    const total  = ids.length;
    let   loaded = 0;
    const pool   = [];
    let   failed = false;

    function updateLabel() {
      const el = document.getElementById('loading-label');
      if (el) el.textContent = `Loading topics… (${loaded}/${total})`;
    }

    ids.forEach(id => {
      loadTopic(id)
        .then(questions => {
          if (failed) return;
          pool.push(...questions);
          loaded++;
          updateLabel();
          if (loaded === total) onAllDone(pool);
        })
        .catch(err => {
          if (failed) return;
          failed = true;
          onError(err);
        });
    });
  }

  /* Expose */
  window.QuizLoader = {
    loadTopics,
    loadTopic,
    TOPIC_MANIFEST,
    isPartLoaded: (filename) => _injected.has(filename),
  };
})();
