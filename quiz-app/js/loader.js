/**
 * IBM QE-FULLSTACK QUIZ — Lazy Topic Loader (loader.js)
 * ======================================================
 * Dynamically injects <script> tags for topic question files
 * only when they are needed, preventing the browser from
 * loading 10,000+ questions upfront.
 *
 * Each topic file sets window.QUESTIONS_<TOPIC> = [...] on load.
 */

'use strict';

(function () {
  // Track which topic files have been requested to avoid double-loading
  const _loaded  = new Set();
  const _loading = new Map(); // topicId => [callbacks]

  /**
   * Base path to question files (relative to index.html).
   * On GitHub Pages this is just 'js/questions/'.
   */
  const BASE_PATH = 'js/questions/';

  /**
   * Load a single topic file by script injection.
   * @param {object} topicDef  - entry from App.TOPICS
   * @param {Function} onDone  - called when file is loaded and parsed
   * @param {Function} onError - called on load failure
   */
  function loadTopicFile(topicDef, onDone, onError) {
    const { id, file, global: globalVar } = topicDef;

    // Already loaded
    if (_loaded.has(id) && window[globalVar]) {
      onDone(window[globalVar]);
      return;
    }

    // Queued — add to callback list
    if (_loading.has(id)) {
      _loading.get(id).push({ onDone, onError });
      return;
    }

    // Start loading
    _loading.set(id, [{ onDone, onError }]);

    updateLoadingLabel(`Loading ${topicDef.label}…`);

    const script = document.createElement('script');
    script.src   = `${BASE_PATH}${file}.js`;
    script.async = true;

    script.onload = function () {
      if (window[globalVar]) {
        _loaded.add(id);
        const callbacks = _loading.get(id) || [];
        _loading.delete(id);
        callbacks.forEach(cb => cb.onDone(window[globalVar]));
      } else {
        const err = new Error(`Global variable window.${globalVar} not found after loading ${file}.js`);
        const callbacks = _loading.get(id) || [];
        _loading.delete(id);
        callbacks.forEach(cb => cb.onError(err));
      }
    };

    script.onerror = function () {
      const err = new Error(`Failed to load script: ${script.src}`);
      const callbacks = _loading.get(id) || [];
      _loading.delete(id);
      callbacks.forEach(cb => cb.onError(err));
    };

    document.head.appendChild(script);
  }

  /**
   * Load multiple topics in parallel, collect all questions, then callback.
   * @param {string[]} topicIds    - array of topic id strings
   * @param {Function} onAllDone   - called with combined question pool array
   * @param {Function} onError     - called if any file fails
   */
  function loadTopics(topicIds, onAllDone, onError) {
    const topics = App.TOPICS.filter(t => topicIds.includes(t.id));

    if (topics.length === 0) {
      onError(new Error('No matching topics found for ids: ' + topicIds.join(', ')));
      return;
    }

    let remaining = topics.length;
    const pool = [];
    let failed = false;

    topics.forEach(topicDef => {
      loadTopicFile(
        topicDef,
        (questions) => {
          if (failed) return;
          pool.push(...questions);
          remaining--;
          updateLoadingLabel(`Loaded ${topics.length - remaining}/${topics.length} topic files…`);
          if (remaining === 0) {
            onAllDone(pool);
          }
        },
        (err) => {
          if (failed) return;
          failed = true;
          onError(err);
        }
      );
    });
  }

  function updateLoadingLabel(text) {
    const el = document.getElementById('loading-label');
    if (el) el.textContent = text;
  }

  // Expose public API
  window.QuizLoader = {
    loadTopics,
    loadTopicFile,
    isLoaded: (topicId) => _loaded.has(topicId),
  };

})();
