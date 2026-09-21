# QE-Fullstack Quiz App

A fully-featured, mobile-optimised quiz application for QA / Full-Stack engineering interview preparation.  
**5,100+ thoroughly fact-checked questions** across 13 topics, delivered as a GitHub Pages static site with lazy-loading so only the topic you select is downloaded.

---

## Topics covered

| # | Topic | Questions |
|---|-------|-----------|
| 01 | Core Testing Concepts | ~420 |
| 02 | SQL & Databases | ~380 |
| 03 | Java | ~270 |
| 04 | JavaScript | ~380 |
| 05 | Python | ~420 |
| 06 | TestNG | ~420 |
| 07 | Mobile Testing | ~420 |
| 08 | API Testing & Postman | ~420 |
| 09 | Git & GitHub | ~420 |
| 10 | Cucumber / BDD | ~420 |
| 11 | Selenium | ~420 |
| 12 | Playwright | ~420 |
| 13 | JUnit 5 | ~310 |

---

## Running locally

No build step required.  Open the file directly — or serve via any static HTTP server:

```bash
# Option 1 – Python (any OS)
cd quiz-app
python -m http.server 8080
# then open http://localhost:8080

# Option 2 – Node.js
npx serve quiz-app

# Option 3 – VS Code Live Server extension
# Right-click quiz-app/index.html → Open with Live Server
```

> **Important:** The app loads question files with `<script src="...">` tags.  
> Browsers block this when using `file://` protocol (CORS restriction).  
> Always use a local HTTP server or GitHub Pages.

---

## Deploying to GitHub Pages

1. Fork or push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under *Source*, select **Deploy from a branch** → `main` → `/ (root)`.
4. Click **Save**.
5. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/quiz-app/`.

The `_config.yml` in `quiz-app/` disables Jekyll processing so the `.js` question files are served as-is.

---

## Project structure

```
quiz-app/
├── index.html                  Main SPA shell
├── _config.yml                 Disables Jekyll on GitHub Pages
├── css/
│   └── style.css               Responsive mobile-first styles
└── js/
    ├── app.js                  Quiz engine (routing, scoring, timer, bookmarks)
    ├── loader.js               Lazy chunk loader & TOPIC_MANIFEST
    └── questions/
        ├── topic-01-core-testing-p[1-4].js
        ├── topic-02-sql-db-p[1-4].js
        ├── topic-03-java-p[1-4].js
        ├── topic-04-javascript-p[1-4].js
        ├── topic-05-python-p[1-4].js
        ├── topic-06-testng-p[1-4].js
        ├── topic-07-mobile-testing-p[1-4].js
        ├── topic-08-api-postman-p[1-4].js
        ├── topic-09-git-github-p[1-4].js
        ├── topic-10-cucumber-p[1-4].js
        ├── topic-11-selenium-p[1-4].js
        ├── topic-12-playwright-p[1-4].js
        └── topic-13-junit-p[1-4].js
```

---

## Question data format

Every question object follows this schema:

```js
{
  id:          5042,              // globally unique, sequential
  topic:       'junit',          // matches TOPIC_MANIFEST key
  difficulty:  'intermediate',   // 'beginner' | 'intermediate' | 'advanced'
  question:    'What is …?',
  options:     ['A', 'B', 'C', 'D'],
  answer:      2,                // zero-based index of the correct option
  explanation: 'Detailed reason why C is correct …'
}
```

---

## Adding more questions

1. Create a new part file, e.g. `js/questions/topic-13-junit-p5.js`.
2. Use the concat pattern — never overwrite the array:
   ```js
   window.QUIZ_BANK['junit'] = (window.QUIZ_BANK['junit']||[]).concat([
     { id: 5231, topic: 'junit', … },
     …
   ]);
   ```
3. Register the filename in `TOPIC_MANIFEST` inside `js/loader.js`:
   ```js
   'junit': ['topic-13-junit-p1', …, 'topic-13-junit-p5'],
   ```
4. Validate syntax before committing:
   ```bash
   node -e "const fs=require('fs');new Function('window',fs.readFileSync('quiz-app/js/questions/topic-13-junit-p5.js','utf8'));console.log('OK');"
   ```

---

## Features

- **Lazy loading** — questions download only when the topic is selected
- **Randomised order** — questions are shuffled on each session start; restart resumes the same shuffle
- **Score & progress** — live score counter and question number tracker
- **Explanations** — every question has a detailed explanation shown after answering
- **Bookmarks** — save questions for later review (stored in `localStorage`)
- **Timer** — configurable per-question countdown
- **Keyboard navigation** — 1-4 to select answer, Enter/→ for Next, ← for Prev
- **Swipe navigation** — swipe left/right on mobile
- **Dark / light mode** — respects `prefers-color-scheme`
- **Offline capable** — no external dependencies; all assets are local

---

## License

MIT — free to use, modify, and distribute.
