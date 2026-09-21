/**
 * IBM QE-FULLSTACK QUIZ — Core Application Engine (app.js)
 * =========================================================
 * Handles: routing, quiz state, scoring, timer, bookmarks,
 * localStorage persistence, UI rendering, keyboard/swipe nav.
 * Question data is loaded lazily by loader.js.
 */

'use strict';

/* ── Constants ─────────────────────────────────────────────── */
const APP_VERSION = '2.0.0';
const LS_KEYS = {
  THEME:        'qe_theme',
  BOOKMARKS:    'qe_bookmarks',
  SESSION:      'qe_session',
  HIGH_SCORES:  'qe_hiscores',
};

const TOPICS = [
  { id: 'core-testing',   label: 'Core Testing Fundamentals',  icon: '🧪', file: 'topic-01-core-testing',  global: 'QUESTIONS_CORE_TESTING',  color: '#0f62fe', count: 420 },
  { id: 'sql-db',         label: 'SQL & Database Fundamentals', icon: '🗄️', file: 'topic-02-sql-db',         global: 'QUESTIONS_SQL_DB',         color: '#198038', count: 380 },
  { id: 'java',           label: 'Java Fundamentals',           icon: '☕', file: 'topic-03-java',           global: 'QUESTIONS_JAVA',           color: '#c02b2b', count: 270 },
  { id: 'javascript',     label: 'JavaScript Fundamentals',     icon: '🟨', file: 'topic-04-javascript',     global: 'QUESTIONS_JAVASCRIPT',     color: '#eab308', count: 370 },
  { id: 'python',         label: 'Python Fundamentals',         icon: '🐍', file: 'topic-05-python',         global: 'QUESTIONS_PYTHON',         color: '#3b82f6', count: 420 },
  { id: 'testng',         label: 'TestNG Fundamentals',         icon: '✅', file: 'topic-06-testng',         global: 'QUESTIONS_TESTNG',         color: '#7c3aed', count: 420 },
  { id: 'mobile-testing', label: 'Mobile Testing Fundamentals', icon: '📱', file: 'topic-07-mobile-testing', global: 'QUESTIONS_MOBILE_TESTING',  color: '#0891b2', count: 420 },
  { id: 'api-postman',    label: 'API Testing / Postman',       icon: '🔌', file: 'topic-08-api-postman',    global: 'QUESTIONS_API_POSTMAN',    color: '#ea580c', count: 420 },
  { id: 'git-github',     label: 'Git & GitHub Fundamentals',   icon: '🐙', file: 'topic-09-git-github',     global: 'QUESTIONS_GIT_GITHUB',     color: '#374151', count: 420 },
  { id: 'cucumber',       label: 'Cucumber Fundamentals',       icon: '🥒', file: 'topic-10-cucumber',       global: 'QUESTIONS_CUCUMBER',       color: '#15803d', count: 420 },
  { id: 'selenium',       label: 'Selenium',                    icon: '🌐', file: 'topic-11-selenium',       global: 'QUESTIONS_SELENIUM',       color: '#1e40af', count: 210 },
  { id: 'playwright',     label: 'Playwright',                  icon: '🎭', file: 'topic-12-playwright',     global: 'QUESTIONS_PLAYWRIGHT',     color: '#6d28d9', count: 420 },
  { id: 'junit',          label: 'JUnit',                       icon: '🔬', file: 'topic-13-junit',          global: 'QUESTIONS_JUNIT',          color: '#b45309', count: 420 },
];

const QUIZ_LENGTHS = [10, 25, 50, 100];
const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'];

/* ── State ──────────────────────────────────────────────────── */
const State = {
  screen:         'home',       // 'home' | 'config' | 'loading' | 'quiz' | 'results' | 'bookmarks'
  selectedTopics: [],           // array of topic ids
  quizLength:     25,
  customLength:   null,
  difficulty:     'all',
  timerMode:      60,           // 0 = off, 30 | 60 | 90 seconds

  questions:      [],           // shuffled subset for session
  currentIndex:   0,
  answers:        [],           // { chosen: number|null, correct: boolean, timeSpent: number }
  bookmarks:      new Set(),
  sessionStartTime: null,
  questionStartTime: null,
  timerHandle:    null,
  timerRemaining: 0,
  submitted:      false,        // question answered

  // High scores keyed by topicId+length
  highScores:     {},
};

/* ── Helpers ────────────────────────────────────────────────── */
function secureRand() {
  if (window.crypto && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }
  return Math.random();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(secureRand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]
  ));
}

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatElapsed(ms) {
  const secs = Math.floor(ms / 1000);
  return formatTime(secs);
}

function showToast(msg, duration = 2000) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { t.classList.add('visible'); });
  });
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function getTopicById(id) {
  return TOPICS.find(t => t.id === id);
}

function getTopicColor(id) {
  return getTopicById(id)?.color || '#0f62fe';
}

/* ── localStorage helpers ───────────────────────────────────── */
function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota or unavailable */ }
}

function lsRemove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

/* ── Theme ──────────────────────────────────────────────────── */
function initTheme() {
  const saved = lsGet(LS_KEYS.THEME, 'light');
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  lsSet(LS_KEYS.THEME, next);
  $$('.theme-toggle').forEach(b => b.textContent = next === 'dark' ? '☀️' : '🌙');
}

function themeIcon() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
}

/* ── Bookmarks ──────────────────────────────────────────────── */
function loadBookmarks() {
  const saved = lsGet(LS_KEYS.BOOKMARKS, []);
  State.bookmarks = new Set(saved);
}

function saveBookmarks() {
  lsSet(LS_KEYS.BOOKMARKS, [...State.bookmarks]);
}

function toggleBookmark(questionId) {
  if (State.bookmarks.has(questionId)) {
    State.bookmarks.delete(questionId);
    showToast('Bookmark removed');
  } else {
    State.bookmarks.add(questionId);
    showToast('Question bookmarked ⭐');
  }
  saveBookmarks();
  // Update button in DOM if visible
  const btn = document.getElementById('bookmark-btn');
  if (btn) updateBookmarkBtn(btn, questionId);
}

function updateBookmarkBtn(btn, questionId) {
  if (State.bookmarks.has(questionId)) {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    btn.title = 'Remove bookmark';
    btn.textContent = '⭐';
  } else {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Bookmark this question';
    btn.textContent = '☆';
  }
}

/* ── Session persistence ────────────────────────────────────── */
function saveSession() {
  if (!State.questions.length) return;
  lsSet(LS_KEYS.SESSION, {
    selectedTopics: State.selectedTopics,
    quizLength:     State.quizLength,
    difficulty:     State.difficulty,
    timerMode:      State.timerMode,
    questions:      State.questions,
    currentIndex:   State.currentIndex,
    answers:        State.answers,
    sessionStartTime: State.sessionStartTime,
  });
}

function loadSession() {
  return lsGet(LS_KEYS.SESSION, null);
}

function clearSession() {
  lsRemove(LS_KEYS.SESSION);
}

/* ── High scores ────────────────────────────────────────────── */
function loadHighScores() {
  State.highScores = lsGet(LS_KEYS.HIGH_SCORES, {});
}

function saveHighScore(topicKey, score, total) {
  const pct = Math.round((score / total) * 100);
  const prev = State.highScores[topicKey] || 0;
  if (pct > prev) {
    State.highScores[topicKey] = pct;
    lsSet(LS_KEYS.HIGH_SCORES, State.highScores);
  }
}

/* ── Timer ──────────────────────────────────────────────────── */
function startTimer() {
  clearTimer();
  if (!State.timerMode) return;
  State.timerRemaining = State.timerMode;
  renderTimerDisplay();
  State.timerHandle = setInterval(() => {
    State.timerRemaining--;
    renderTimerDisplay();
    if (State.timerRemaining <= 0) {
      clearTimer();
      autoSubmit();
    }
  }, 1000);
}

function clearTimer() {
  if (State.timerHandle) {
    clearInterval(State.timerHandle);
    State.timerHandle = null;
  }
}

function renderTimerDisplay() {
  const el = document.getElementById('quiz-timer');
  if (!el) return;
  const t = State.timerRemaining;
  el.textContent = `⏱ ${formatTime(t)}`;
  el.className = 'quiz-timer';
  if (t <= 10) el.classList.add('danger');
  else if (t <= 20) el.classList.add('warn');
}

function autoSubmit() {
  if (!State.submitted) {
    submitAnswer(null); // timeout — null means no answer chosen
  }
}

/* ── Quiz Engine ────────────────────────────────────────────── */
function buildQuiz(questionPool) {
  let pool = [...questionPool];

  // Filter by difficulty
  if (State.difficulty !== 'all') {
    const filtered = pool.filter(q => q.difficulty === State.difficulty);
    pool = filtered.length >= 5 ? filtered : pool; // fallback to all if not enough
  }

  // Filter by selected topics
  if (State.selectedTopics.length > 0 && !State.selectedTopics.includes('all')) {
    pool = pool.filter(q => State.selectedTopics.includes(q.topic));
  }

  // Shuffle and slice to desired length
  pool = shuffle(pool);
  const len = State.customLength || State.quizLength;
  pool = pool.slice(0, Math.min(len, pool.length));

  // Shuffle answer options and track new correct index
  State.questions = pool.map(q => {
    const pairs = q.options.map((text, i) => ({ text, correct: i === q.answer }));
    const shuffledPairs = shuffle(pairs);
    return {
      ...q,
      options:       shuffledPairs.map(p => p.text),
      answer:        shuffledPairs.findIndex(p => p.correct),
      originalOptions: q.options,
    };
  });

  State.currentIndex   = 0;
  State.answers        = Array(State.questions.length).fill(null).map(() => ({ chosen: null, correct: false, timeSpent: 0 }));
  State.sessionStartTime = Date.now();
  State.submitted      = false;
}

function currentQuestion() {
  return State.questions[State.currentIndex];
}

function submitAnswer(chosenIndex) {
  if (State.submitted) return;
  State.submitted = true;
  clearTimer();

  const q   = currentQuestion();
  const elapsed = State.questionStartTime ? Math.floor((Date.now() - State.questionStartTime) / 1000) : 0;

  State.answers[State.currentIndex] = {
    chosen:    chosenIndex,
    correct:   chosenIndex === q.answer,
    timeSpent: elapsed,
  };

  saveSession();
  renderAnswerFeedback(chosenIndex);
}

function goNext() {
  if (State.currentIndex < State.questions.length - 1) {
    State.currentIndex++;
    State.submitted = false;
    saveSession();
    renderQuizScreen();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearTimer();
  const topicKey = State.selectedTopics.join('+') + '_' + State.quizLength;
  const score = State.answers.filter(a => a && a.correct).length;
  saveHighScore(topicKey, score, State.questions.length);
  clearSession();
  navigateTo('results');
}

/* ── Navigation ─────────────────────────────────────────────── */
function navigateTo(screen) {
  State.screen = screen;
  render();
}

/* ── Main Render Dispatcher ─────────────────────────────────── */
function render() {
  const app = document.getElementById('app');
  switch (State.screen) {
    case 'home':      app.innerHTML = renderHomeScreen();   break;
    case 'config':    app.innerHTML = renderConfigScreen(); break;
    case 'loading':   app.innerHTML = renderLoadingScreen(); break;
    case 'quiz':      app.innerHTML = renderQuizScreen();   break;
    case 'results':   app.innerHTML = renderResultsScreen(); break;
    case 'bookmarks': app.innerHTML = renderBookmarksScreen(); break;
    default:          app.innerHTML = renderHomeScreen();
  }
  bindEvents();
}

/* ── Header HTML helper ─────────────────────────────────────── */
function headerHtml(title, showScore = false) {
  const score = showScore
    ? (() => {
        const correct = State.answers.filter(a => a && a.correct).length;
        const total   = State.answers.filter(a => a && a.chosen !== null).length;
        return `<div class="header-score">✓ ${correct} / ${total}</div>`;
      })()
    : '';
  return `
  <header class="app-header" role="banner">
    <div class="inner">
      <div class="header-brand">${escHtml(title)}</div>
      <div class="header-meta">
        ${score}
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle dark/light mode" title="Toggle theme">${themeIcon()}</button>
      </div>
    </div>
  </header>`;
}

/* ── Home Screen ─────────────────────────────────────────────── */
function renderHomeScreen() {
  const savedSession = loadSession();
  const bookmarkCount = State.bookmarks.size;

  const topicCards = TOPICS.map(t => `
    <button class="topic-card" data-action="select-topic" data-topic="${t.id}"
            aria-label="Select topic: ${t.label}" role="button">
      <div class="topic-icon">${t.icon}</div>
      <div class="topic-name">${escHtml(t.label)}</div>
      <div class="topic-count">${t.count.toLocaleString()} questions</div>
    </button>
  `).join('');

  const resumeBtn = savedSession
    ? `<button class="btn btn-secondary btn-full" data-action="resume-session" style="margin-bottom:8px">
         ▶ Resume Previous Session (Q${(savedSession.currentIndex||0)+1} of ${savedSession.questions?.length||0})
       </button>`
    : '';

  return `
  ${headerHtml('IBM QE-FULLSTACK')}
  <div class="home-header">
    <div style="max-width:720px;margin:0 auto">
      <h1>Practice Quiz</h1>
      <p>4,000+ fact-checked questions across 13 QA engineering topics</p>
      <div class="home-stats">
        <div class="home-stat"><strong>4,170</strong><span>Questions</span></div>
        <div class="home-stat"><strong>13</strong><span>Topics</span></div>
        <div class="home-stat"><strong>3</strong><span>Difficulty Levels</span></div>
        <div class="home-stat"><strong>${bookmarkCount}</strong><span>Bookmarked</span></div>
      </div>
    </div>
  </div>

  <div style="padding:16px;max-width:720px;margin:0 auto">
    ${resumeBtn}
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary" style="flex:1" data-action="start-all-topics">
        ⚡ Quick Quiz — All Topics
      </button>
      ${bookmarkCount > 0
        ? `<button class="btn btn-secondary" data-action="quiz-bookmarks" aria-label="Quiz on ${bookmarkCount} bookmarked questions">
             ⭐ ${bookmarkCount}
           </button>`
        : ''
      }
    </div>

    <p class="section-title">Select a Topic</p>
    <div class="topic-grid">
      <button class="topic-card all-topics" data-action="select-topic" data-topic="all" aria-label="All topics mixed mode">
        <div class="topic-icon">🎯</div>
        <div>
          <div class="topic-name">All Topics — Mixed Mode</div>
          <div class="topic-count">4,170 questions combined</div>
          <!-- total will update automatically as playwright/junit files are added -->
        </div>
      </button>
      ${topicCards}
    </div>
  </div>`;
}

/* ── Config Screen ───────────────────────────────────────────── */
function renderConfigScreen() {
  const topics = State.selectedTopics.includes('all')
    ? ['All Topics']
    : State.selectedTopics.map(id => getTopicById(id)?.label || id);

  const lengthChips = QUIZ_LENGTHS.map(n => `
    <button class="chip ${State.quizLength === n && !State.customLength ? 'active' : ''}"
            data-action="set-length" data-val="${n}">${n}</button>
  `).join('');

  const diffChips = DIFFICULTIES.map(d => `
    <button class="chip ${State.difficulty === d ? 'active' : ''}"
            data-action="set-difficulty" data-val="${d}">
      ${d.charAt(0).toUpperCase() + d.slice(1)}
    </button>
  `).join('');

  const timerChips = [
    { val: 0,  label: 'Off' },
    { val: 30, label: '30s' },
    { val: 60, label: '60s' },
    { val: 90, label: '90s' },
  ].map(t => `
    <button class="chip ${State.timerMode === t.val ? 'active' : ''}"
            data-action="set-timer" data-val="${t.val}">${t.label}</button>
  `).join('');

  return `
  ${headerHtml('Configure Quiz')}
  <div class="config-panel" style="max-width:720px;margin:0 auto;padding-top:calc(var(--header-h) + 16px)">

    <div class="config-section">
      <label>Selected Topics</label>
      <div style="font-size:.9rem;color:var(--text-muted)">${topics.join(', ')}</div>
      <button class="btn btn-ghost btn-sm mt-8" data-action="back-home">← Change topics</button>
    </div>

    <div class="config-section">
      <label>Questions per Session</label>
      <div class="chip-group">${lengthChips}</div>
      <div class="input-group mt-8">
        <span style="font-size:.85rem;color:var(--text-muted)">Custom:</span>
        <input type="number" id="custom-length" min="1" max="500"
               value="${State.customLength || ''}"
               placeholder="e.g. 75"
               aria-label="Custom number of questions"
               oninput="handleCustomLength(this.value)" />
      </div>
    </div>

    <div class="config-section">
      <label>Difficulty</label>
      <div class="chip-group">${diffChips}</div>
    </div>

    <div class="config-section">
      <label>Timer per Question</label>
      <div class="chip-group">${timerChips}</div>
    </div>

  </div>

  <div class="bottom-bar">
    <div class="inner">
      <button class="btn btn-secondary" data-action="back-home">← Back</button>
      <button class="btn btn-primary" style="flex:1" data-action="start-quiz">
        Start Quiz →
      </button>
    </div>
  </div>`;
}

/* ── Loading Screen ──────────────────────────────────────────── */
function renderLoadingScreen() {
  return `
  ${headerHtml('Loading...')}
  <div style="padding-top:var(--header-h)">
    <div class="loading-screen">
      <div class="spinner" role="status" aria-label="Loading"></div>
      <div class="loading-label" id="loading-label">Loading questions…</div>
    </div>
  </div>`;
}

/* ── Quiz Screen ─────────────────────────────────────────────── */
function renderQuizScreen() {
  const q     = currentQuestion();
  const idx   = State.currentIndex;
  const total = State.questions.length;
  const pct   = Math.round(((idx) / total) * 100);
  const ans   = State.answers[idx];
  const answered = ans && ans.chosen !== null;

  State.questionStartTime = Date.now();

  const timerHtml = State.timerMode && !answered
    ? `<div class="quiz-timer" id="quiz-timer">⏱ ${formatTime(State.timerMode)}</div>`
    : (State.timerMode && answered
        ? `<div class="quiz-timer">⏱ ${formatTime(ans.timeSpent)}</div>`
        : '');

  const diffClass = `diff-${q.difficulty}`;
  const topicInfo = getTopicById(q.topic);
  const topicColor = topicInfo?.color || '#0f62fe';

  const optionsHtml = q.options.map((opt, i) => {
    let cls = '';
    if (answered) {
      if (i === q.answer) cls = 'correct';
      else if (i === ans.chosen) cls = 'incorrect';
    }
    return `
    <button class="option-btn ${cls}"
            data-action="${answered ? '' : 'choose-answer'}"
            data-idx="${i}"
            ${answered ? 'disabled aria-disabled="true"' : ''}
            aria-label="Option ${String.fromCharCode(65+i)}: ${escHtml(opt)}"
            ${answered && i === q.answer ? 'aria-current="true"' : ''}>
      <span class="opt-label" aria-hidden="true">${String.fromCharCode(65+i)}</span>
      <span class="opt-text">${escHtml(opt)}</span>
    </button>`;
  }).join('');

  const explanationHtml = answered
    ? `<div class="explanation-box" role="alert">
         <strong>Explanation</strong>
         ${escHtml(q.explanation)}
       </div>`
    : '';

  const isLast = idx === total - 1;
  const nextLabel = isLast ? 'Finish Quiz' : 'Next →';

  return `
  ${headerHtml(`${topicInfo?.icon || ''} ${topicInfo?.label || 'Quiz'}`, true)}
  <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
    <div class="progress-fill" style="width:${pct}%"></div>
  </div>

  <div class="quiz-wrap">
    <div class="quiz-meta">
      <span class="quiz-counter">Question ${idx+1} of ${total}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="difficulty-pill ${diffClass}">${q.difficulty}</span>
        ${timerHtml}
      </div>
    </div>

    <div class="question-card" id="question-card">
      <div class="flex-between" style="margin-bottom:10px">
        <span class="question-topic-badge" style="background:${topicColor}">${topicInfo?.label || q.topic}</span>
        <button class="bookmark-btn" id="bookmark-btn"
                data-action="toggle-bookmark"
                data-question-id="${q.id}"
                aria-label="Bookmark this question"
                aria-pressed="${State.bookmarks.has(q.id)}"
                title="${State.bookmarks.has(q.id) ? 'Remove bookmark' : 'Bookmark'}">
          ${State.bookmarks.has(q.id) ? '⭐' : '☆'}
        </button>
      </div>

      <div class="question-text">${escHtml(q.question)}</div>

      <div class="options-list" role="list" id="options-list">
        ${optionsHtml}
      </div>

      ${explanationHtml}
    </div>

    <div class="swipe-hint">← swipe or use arrow keys to navigate →</div>
  </div>

  <nav class="quiz-nav" role="navigation" aria-label="Quiz navigation">
    <div class="inner">
      <button class="btn btn-secondary" data-action="quiz-prev"
              ${idx === 0 ? 'disabled' : ''}
              aria-label="Previous question">← Prev</button>
      <button class="btn btn-ghost" data-action="toggle-bookmark"
              data-question-id="${q.id}"
              style="flex-shrink:0;padding:0 10px"
              aria-label="Bookmark">
        ${State.bookmarks.has(q.id) ? '⭐' : '☆'}
      </button>
      ${answered
        ? `<button class="btn btn-primary" style="flex:1" data-action="quiz-next">${nextLabel}</button>`
        : `<button class="btn btn-secondary" style="flex:1" data-action="skip-question">Skip</button>`
      }
    </div>
  </nav>`;
}

/* ── Render answer feedback without full re-render ──────────── */
function renderAnswerFeedback(chosenIndex) {
  const q = currentQuestion();
  const optionBtns = $$('.option-btn');

  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.removeAttribute('data-action');
    if (i === q.answer) btn.classList.add('correct');
    else if (i === chosenIndex) btn.classList.add('incorrect');
  });

  // Show explanation
  const card = document.getElementById('question-card');
  if (card) {
    const expBox = document.createElement('div');
    expBox.className = 'explanation-box';
    expBox.setAttribute('role', 'alert');
    expBox.innerHTML = `<strong>Explanation</strong>${escHtml(q.explanation)}`;
    card.appendChild(expBox);
  }

  // Update nav bar
  const nav = document.querySelector('.quiz-nav .inner');
  if (nav) {
    const isLast = State.currentIndex === State.questions.length - 1;
    const skipBtn = nav.querySelector('[data-action="skip-question"]');
    if (skipBtn) {
      skipBtn.className = 'btn btn-primary';
      skipBtn.style.flex = '1';
      skipBtn.setAttribute('data-action', 'quiz-next');
      skipBtn.textContent = isLast ? 'Finish Quiz' : 'Next →';
    }
  }

  // Update header score
  const scoreEl = document.querySelector('.header-score');
  if (scoreEl) {
    const correct = State.answers.filter(a => a && a.correct).length;
    const total   = State.answers.filter(a => a && a.chosen !== null).length;
    scoreEl.textContent = `✓ ${correct} / ${total}`;
  }
}

/* ── Results Screen ──────────────────────────────────────────── */
function renderResultsScreen() {
  const total    = State.questions.length;
  const correct  = State.answers.filter(a => a && a.correct).length;
  const incorrect= State.answers.filter(a => a && a.chosen !== null && !a.correct).length;
  const skipped  = State.answers.filter(a => !a || a.chosen === null).length;
  const pct      = total > 0 ? Math.round((correct / total) * 100) : 0;
  const elapsed  = State.sessionStartTime ? Date.now() - State.sessionStartTime : 0;

  let rating = 'Needs Work';
  let ratingColor = '#da1e28';
  if (pct >= 90) { rating = 'Outstanding 🏆'; ratingColor = '#198038'; }
  else if (pct >= 75) { rating = 'Proficient ✅'; ratingColor = '#0f62fe'; }
  else if (pct >= 60) { rating = 'Developing 📈'; ratingColor = '#f59e0b'; }
  else if (pct >= 40) { rating = 'Progressing 🔄'; ratingColor = '#ea580c'; }

  const reviewItems = State.questions.map((q, i) => {
    const ans = State.answers[i];
    const chosen = ans?.chosen;
    const isCorrect = ans?.correct;
    const isSkipped = chosen === null || chosen === undefined;
    let statusClass = isSkipped ? 'skipped' : (isCorrect ? 'correct' : 'incorrect');
    let statusIcon  = isSkipped ? '⏭' : (isCorrect ? '✓' : '✗');
    const chosenText = isSkipped ? 'Skipped' : `${String.fromCharCode(65 + chosen)}. ${escHtml(q.options[chosen])}`;
    const correctText = `${String.fromCharCode(65 + q.answer)}. ${escHtml(q.options[q.answer])}`;
    const topicInfo = getTopicById(q.topic);

    return `
    <div class="review-item ${statusClass}" data-action="expand-review">
      <div class="ri-q">${statusIcon} Q${i+1}. ${escHtml(q.question)}</div>
      <div class="ri-meta">
        <span>${topicInfo?.icon || ''} ${escHtml(topicInfo?.label || q.topic)}</span>
        <span class="difficulty-pill diff-${q.difficulty}">${q.difficulty}</span>
        ${!isSkipped ? `<span>${ans.timeSpent}s</span>` : ''}
      </div>
      <div class="ri-detail">
        <div class="${isCorrect ? 'ans-correct' : 'ans-wrong'} ans-label">
          Your answer: ${chosenText}
        </div>
        ${!isCorrect ? `<div class="ans-correct ans-label mt-4">Correct: ${correctText}</div>` : ''}
        <div style="margin-top:8px;color:var(--text-muted);font-size:.85rem">${escHtml(q.explanation)}</div>
      </div>
    </div>`;
  }).join('');

  return `
  ${headerHtml('Quiz Results')}
  <div class="results-page">
    <div class="results-hero">
      <div class="results-score">${correct}/${total}</div>
      <div class="results-pct">${pct}% correct</div>
      <span class="results-rating" style="background:${ratingColor}">${rating}</span>
    </div>

    <div class="results-stats-grid">
      <div class="result-stat">
        <strong style="color:var(--success)">${correct}</strong>
        <span>Correct</span>
      </div>
      <div class="result-stat">
        <strong style="color:var(--danger)">${incorrect}</strong>
        <span>Incorrect</span>
      </div>
      <div class="result-stat">
        <strong style="color:var(--warning)">${skipped}</strong>
        <span>Skipped</span>
      </div>
      <div class="result-stat">
        <strong>${formatElapsed(elapsed)}</strong>
        <span>Time Taken</span>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <button class="btn btn-primary" data-action="restart-quiz" style="flex:1">
        🔄 Restart Same Quiz
      </button>
      <button class="btn btn-secondary" data-action="back-home" style="flex:1">
        🏠 Home
      </button>
    </div>

    <p class="section-title">Review All Questions (${total})</p>
    <div class="review-list">
      ${reviewItems}
    </div>
  </div>`;
}

/* ── Bookmarks Screen ────────────────────────────────────────── */
function renderBookmarksScreen() {
  // Gather bookmarked questions from ALL loaded topics
  const bookmarkedIds = [...State.bookmarks];
  const loaded = [];
  TOPICS.forEach(t => {
    const arr = window[t.global];
    if (arr) loaded.push(...arr);
  });

  const bookmarkedQs = loaded.filter(q => bookmarkedIds.includes(q.id));

  const items = bookmarkedQs.length === 0
    ? '<div class="empty-state"><div class="icon">☆</div><p>No bookmarks yet. Tap ☆ on any question while quizzing to save it here.</p></div>'
    : bookmarkedQs.map(q => {
        const topicInfo = getTopicById(q.topic);
        return `
        <div class="review-item" data-action="expand-review">
          <div class="ri-q">${escHtml(q.question)}</div>
          <div class="ri-meta">
            <span>${topicInfo?.icon || ''} ${escHtml(topicInfo?.label || q.topic)}</span>
            <span class="difficulty-pill diff-${q.difficulty}">${q.difficulty}</span>
          </div>
          <div class="ri-detail">
            ${q.options.map((o, i) => `
              <div style="padding:4px 0;${i === q.answer ? 'color:var(--success);font-weight:700' : ''}">
                ${String.fromCharCode(65+i)}. ${escHtml(o)}${i === q.answer ? ' ✓' : ''}
              </div>
            `).join('')}
            <div style="margin-top:8px;color:var(--text-muted);font-size:.85rem">${escHtml(q.explanation)}</div>
          </div>
        </div>`;
      }).join('');

  return `
  ${headerHtml('⭐ Bookmarks')}
  <div style="padding:16px;max-width:720px;margin:0 auto;padding-top:calc(var(--header-h) + 16px)">
    <div class="flex-between mb-16">
      <span style="font-size:.9rem;color:var(--text-muted)">${bookmarkedQs.length} bookmarked question${bookmarkedQs.length !== 1 ? 's' : ''}</span>
      ${bookmarkedQs.length > 0
        ? `<button class="btn btn-primary btn-sm" data-action="quiz-bookmarks">Quiz on Bookmarks</button>`
        : ''
      }
    </div>
    <div class="review-list">${items}</div>
    <div style="margin-top:20px">
      <button class="btn btn-secondary" data-action="back-home">← Back to Home</button>
    </div>
  </div>`;
}

/* ── Event Binding ───────────────────────────────────────────── */
function bindEvents() {
  // Delegated click handling on #app
  const app = document.getElementById('app');
  if (app._listenerBound) return;
  app._listenerBound = true;

  app.addEventListener('click', handleClick);
  app.addEventListener('keydown', handleKeydown);
}

function handleClick(e) {
  // Walk up to find the element with data-action
  let el = e.target;
  while (el && el !== document.getElementById('app')) {
    const action = el.dataset?.action;
    if (action) {
      e.preventDefault();
      dispatchAction(action, el);
      return;
    }
    el = el.parentElement;
  }
}

function handleKeydown(e) {
  if (State.screen !== 'quiz') return;
  if (State.submitted) {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'n' || e.key === 'N') {
      goNext();
    }
  } else {
    const map = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    if (map[e.key] !== undefined) {
      submitAnswer(map[e.key]);
    }
  }
  if (e.key === 'ArrowLeft' && State.currentIndex > 0) {
    State.currentIndex--;
    State.submitted = (State.answers[State.currentIndex]?.chosen !== null);
    renderQuizScreen();
    document.getElementById('app').innerHTML = renderQuizScreen();
    bindEvents();
    if (!State.submitted && State.timerMode) startTimer();
  }
}

function dispatchAction(action, el) {
  switch (action) {
    case 'select-topic': {
      const topic = el.dataset.topic;
      if (topic === 'all') {
        State.selectedTopics = ['all'];
      } else {
        State.selectedTopics = [topic];
      }
      navigateTo('config');
      break;
    }

    case 'start-all-topics':
      State.selectedTopics = ['all'];
      State.quizLength = 25;
      State.customLength = null;
      State.difficulty = 'all';
      navigateTo('config');
      break;

    case 'back-home':
      navigateTo('home');
      break;

    case 'set-length': {
      const val = parseInt(el.dataset.val);
      State.quizLength  = val;
      State.customLength = null;
      const input = document.getElementById('custom-length');
      if (input) input.value = '';
      // Re-render chip states
      $$('.chip[data-action="set-length"]').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.val) === val);
      });
      break;
    }

    case 'set-difficulty': {
      State.difficulty = el.dataset.val;
      $$('.chip[data-action="set-difficulty"]').forEach(c => {
        c.classList.toggle('active', c.dataset.val === State.difficulty);
      });
      break;
    }

    case 'set-timer': {
      State.timerMode = parseInt(el.dataset.val);
      $$('.chip[data-action="set-timer"]').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.val) === State.timerMode);
      });
      break;
    }

    case 'start-quiz':
      startQuizSession();
      break;

    case 'resume-session':
      resumeSession();
      break;

    case 'choose-answer':
      if (!State.submitted) {
        submitAnswer(parseInt(el.dataset.idx));
        if (State.timerMode) clearTimer();
      }
      break;

    case 'quiz-next':
      goNext();
      break;

    case 'quiz-prev':
      if (State.currentIndex > 0) {
        State.currentIndex--;
        State.submitted = State.answers[State.currentIndex]?.chosen !== null;
        clearTimer();
        document.getElementById('app').innerHTML = renderQuizScreen();
        document.getElementById('app')._listenerBound = false;
        bindEvents();
        if (!State.submitted && State.timerMode) startTimer();
      }
      break;

    case 'skip-question':
      submitAnswer(null);
      break;

    case 'toggle-bookmark': {
      const qId = el.dataset.questionId;
      if (qId) toggleBookmark(qId);
      break;
    }

    case 'quiz-bookmarks':
      startBookmarkQuiz();
      break;

    case 'restart-quiz':
      restartQuiz();
      break;

    case 'expand-review': {
      const item = el.closest('.review-item');
      if (item) item.classList.toggle('expanded');
      break;
    }

    case 'view-bookmarks':
      navigateTo('bookmarks');
      break;
  }
}

/* ── Custom length input handler (global) ───────────────────── */
window.handleCustomLength = function(val) {
  const n = parseInt(val);
  if (!isNaN(n) && n > 0) {
    State.customLength = Math.min(n, 500);
    State.quizLength   = 0;
    $$('.chip[data-action="set-length"]').forEach(c => c.classList.remove('active'));
  } else {
    State.customLength = null;
  }
};

/* ── Start Quiz Session (triggers topic file load) ───────────── */
function startQuizSession() {
  // Determine which topics to load
  const topicsToLoad = State.selectedTopics.includes('all')
    ? TOPICS.map(t => t.id)
    : State.selectedTopics;

  navigateTo('loading');

  // Loader is in loader.js — it exposes window.QuizLoader
  if (window.QuizLoader) {
    window.QuizLoader.loadTopics(topicsToLoad, (pool) => {
      buildQuiz(pool);
      clearSession();
      navigateTo('quiz');
      document.getElementById('app')._listenerBound = false;
      bindEvents();
      if (State.timerMode) startTimer();
    }, (err) => {
      console.error('Failed to load questions:', err);
      showToast('Error loading questions — please try again');
      navigateTo('config');
    });
  } else {
    // Fallback: try to use already-loaded globals
    const pool = collectLoadedQuestions(topicsToLoad);
    if (pool.length > 0) {
      buildQuiz(pool);
      navigateTo('quiz');
      document.getElementById('app')._listenerBound = false;
      bindEvents();
      if (State.timerMode) startTimer();
    } else {
      showToast('QuizLoader not available. Check js/loader.js');
      navigateTo('config');
    }
  }
}

function collectLoadedQuestions(topicIds) {
  const pool = [];
  TOPICS.forEach(t => {
    if (topicIds.includes(t.id) || topicIds.includes('all')) {
      const arr = window[t.global];
      if (arr) pool.push(...arr);
    }
  });
  return pool;
}

/* ── Start Bookmark Quiz ─────────────────────────────────────── */
function startBookmarkQuiz() {
  if (State.bookmarks.size === 0) {
    showToast('No bookmarks yet!');
    return;
  }

  // Gather all loaded questions matching bookmarks
  const loaded = collectLoadedQuestions(TOPICS.map(t => t.id));
  const bookmarkedQs = loaded.filter(q => State.bookmarks.has(q.id));

  if (bookmarkedQs.length === 0) {
    showToast('Bookmarked topics not loaded yet. Open them first.');
    navigateTo('home');
    return;
  }

  // Build quiz from bookmarked questions
  const len = State.quizLength || bookmarkedQs.length;
  const pool = shuffle(bookmarkedQs).slice(0, len);

  State.questions = pool.map(q => {
    const pairs = q.options.map((text, i) => ({ text, correct: i === q.answer }));
    const shuffled = shuffle(pairs);
    return { ...q, options: shuffled.map(p => p.text), answer: shuffled.findIndex(p => p.correct) };
  });

  State.currentIndex    = 0;
  State.answers         = Array(State.questions.length).fill(null).map(() => ({ chosen: null, correct: false, timeSpent: 0 }));
  State.sessionStartTime = Date.now();
  State.submitted       = false;

  navigateTo('quiz');
  document.getElementById('app')._listenerBound = false;
  bindEvents();
  if (State.timerMode) startTimer();
}

/* ── Resume Session ──────────────────────────────────────────── */
function resumeSession() {
  const saved = loadSession();
  if (!saved) return;

  State.selectedTopics   = saved.selectedTopics;
  State.quizLength       = saved.quizLength;
  State.difficulty       = saved.difficulty;
  State.timerMode        = saved.timerMode;
  State.questions        = saved.questions;
  State.currentIndex     = saved.currentIndex;
  State.answers          = saved.answers;
  State.sessionStartTime = saved.sessionStartTime;
  State.submitted        = State.answers[State.currentIndex]?.chosen !== null;

  navigateTo('quiz');
  document.getElementById('app')._listenerBound = false;
  bindEvents();
  if (!State.submitted && State.timerMode) startTimer();
}

/* ── Restart Quiz ─────────────────────────────────────────────── */
function restartQuiz() {
  clearTimer();
  // Re-shuffle current question set
  const reshuffled = shuffle(State.questions).map(q => {
    const pairs = q.options.map((text, i) => ({ text, correct: i === q.answer }));
    const sp = shuffle(pairs);
    return { ...q, options: sp.map(p => p.text), answer: sp.findIndex(p => p.correct) };
  });
  State.questions        = reshuffled;
  State.currentIndex     = 0;
  State.answers          = Array(State.questions.length).fill(null).map(() => ({ chosen: null, correct: false, timeSpent: 0 }));
  State.sessionStartTime = Date.now();
  State.submitted        = false;

  navigateTo('quiz');
  document.getElementById('app')._listenerBound = false;
  bindEvents();
  if (State.timerMode) startTimer();
}

/* ── Touch/Swipe Support ─────────────────────────────────────── */
(function initSwipe() {
  let startX = 0, startY = 0;

  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (State.screen !== 'quiz') return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && State.submitted) {
        // Swipe left = next
        goNext();
      } else if (dx > 0 && State.currentIndex > 0) {
        // Swipe right = prev
        State.currentIndex--;
        State.submitted = State.answers[State.currentIndex]?.chosen !== null;
        clearTimer();
        document.getElementById('app').innerHTML = renderQuizScreen();
        document.getElementById('app')._listenerBound = false;
        bindEvents();
        if (!State.submitted && State.timerMode) startTimer();
      }
    }
  }, { passive: true });
})();

/* ── Splash Screen ───────────────────────────────────────────── */
function hideSplash() {
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => splash.classList.add('hidden'), 1600);
  }
}

/* ── Init ────────────────────────────────────────────────────── */
function init() {
  initTheme();
  loadBookmarks();
  loadHighScores();
  hideSplash();
  navigateTo('home');
}

// Expose to global for loader.js callbacks
window.App = {
  navigateTo,
  State,
  TOPICS,
  buildQuiz,
  startTimer,
  render,
  showToast,
  bindEvents,
  collectLoadedQuestions,
};

// Boot
window.addEventListener('DOMContentLoaded', init);
