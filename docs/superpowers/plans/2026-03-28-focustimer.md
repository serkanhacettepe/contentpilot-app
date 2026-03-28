# FocusTimer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Pomodoro Chrome extension with SVG progress ring, Web Audio sounds, desktop notifications, session counter, and dark/light theme.

**Architecture:** Popup-only MV3 extension. Timer runs via `setInterval` in `popup.js`. No background service worker. Preferences (theme, sound) persisted to `chrome.storage.local`; all timer state is in-memory.

**Tech Stack:** Vanilla JS ES2020, SVG, Web Audio API, `chrome.notifications`, `chrome.storage.local`, CSS custom properties, Manifest V3.

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | MV3 config, permissions, popup entry |
| `popup.html` | DOM structure: toolbar, mode tabs, SVG ring, controls, session counter |
| `popup.css` | CSS variables, light/dark themes, ring styles, layout, animations |
| `popup.js` | Timer logic, audio, notifications, render, state, persistence |
| `icons/icon16.svg` | Toolbar icon (16px) |
| `icons/icon48.svg` | Extension management icon (48px) |
| `icons/icon128.svg` | Chrome Web Store / notification icon (128px) |

---

## Task 1: Project setup — directory, git, manifest, icons

**Files:**
- Create: `C:\Users\serkan\focustimer-extension\manifest.json`
- Create: `C:\Users\serkan\focustimer-extension\icons\icon16.svg`
- Create: `C:\Users\serkan\focustimer-extension\icons\icon48.svg`
- Create: `C:\Users\serkan\focustimer-extension\icons\icon128.svg`

- [ ] **Step 1: Create project directory and git repo**

```bash
mkdir -p /c/Users/serkan/focustimer-extension/icons
cd /c/Users/serkan/focustimer-extension
git init
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "FocusTimer",
  "version": "1.0.0",
  "description": "Pomodoro timer with progress ring, notifications, and session tracking.",
  "permissions": ["notifications", "storage"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16":  "icons/icon16.svg",
      "48":  "icons/icon48.svg",
      "128": "icons/icon128.svg"
    }
  },
  "icons": {
    "16":  "icons/icon16.svg",
    "48":  "icons/icon48.svg",
    "128": "icons/icon128.svg"
  }
}
```

- [ ] **Step 3: Write icons/icon16.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <circle cx="8" cy="9" r="6" fill="#ef4444"/>
  <ellipse cx="8" cy="3.5" rx="2" ry="1" fill="#22c55e"/>
  <circle cx="8" cy="9" r="3.5" fill="none" stroke="white" stroke-width="1.2"/>
  <line x1="8" y1="9" x2="10" y2="7" stroke="white" stroke-width="1" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 4: Write icons/icon48.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="28" r="18" fill="#ef4444"/>
  <ellipse cx="24" cy="11" rx="6" ry="3" fill="#22c55e"/>
  <circle cx="24" cy="28" r="11" fill="none" stroke="white" stroke-width="3"/>
  <line x1="24" y1="28" x2="30" y2="22" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="24" cy="28" r="1.5" fill="white"/>
</svg>
```

- [ ] **Step 5: Write icons/icon128.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <circle cx="64" cy="74" r="48" fill="#ef4444"/>
  <ellipse cx="64" cy="30" rx="16" ry="8" fill="#22c55e"/>
  <circle cx="64" cy="74" r="30" fill="none" stroke="white" stroke-width="7"/>
  <line x1="64" y1="74" x2="80" y2="58" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <circle cx="64" cy="74" r="4" fill="white"/>
</svg>
```

- [ ] **Step 6: Initial commit**

```bash
cd /c/Users/serkan/focustimer-extension
git add manifest.json icons/
git commit -m "feat: initial project setup — manifest and icons"
```

---

## Task 2: popup.html — DOM structure

**Files:**
- Create: `C:\Users\serkan\focustimer-extension\popup.html`

- [ ] **Step 1: Write popup.html**

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FocusTimer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>

  <!-- ── Toolbar ─────────────────────────────────────────── -->
  <header class="toolbar">
    <div class="toolbar__brand">
      <span class="toolbar__emoji" aria-hidden="true">🍅</span>
      <span class="toolbar__title">FocusTimer</span>
    </div>
    <div class="toolbar__controls">
      <button id="soundToggle" class="btn btn--icon" aria-label="Toggle sound" title="Toggle sound">🔔</button>
      <button id="themeToggle" class="btn btn--icon" aria-label="Toggle theme" title="Toggle theme">🌙</button>
    </div>
  </header>

  <!-- ── Mode tabs ──────────────────────────────────────── -->
  <div class="mode-tabs" role="tablist" aria-label="Timer mode">
    <button class="mode-tab active" data-mode="work"  role="tab" aria-selected="true">Work</button>
    <button class="mode-tab"        data-mode="short" role="tab" aria-selected="false">Short Break</button>
    <button class="mode-tab"        data-mode="long"  role="tab" aria-selected="false">Long Break</button>
  </div>

  <!-- ── Timer ring ─────────────────────────────────────── -->
  <div class="ring-container" id="ringContainer">
    <svg class="ring-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <!-- Background track -->
      <circle class="ring-track"    cx="100" cy="100" r="80" />
      <!-- Progress arc -->
      <circle class="ring-progress" cx="100" cy="100" r="80" id="ringProgress" />
    </svg>
    <!-- Text overlay (not rotated with SVG) -->
    <div class="ring-inner">
      <div class="timer-display" id="timerDisplay" aria-live="polite" aria-label="Time remaining">25:00</div>
      <div class="timer-mode"    id="timerMode">WORK</div>
    </div>
  </div>

  <!-- ── Controls ───────────────────────────────────────── -->
  <div class="controls">
    <button class="btn btn--start" id="startBtn">▶ Start</button>
    <button class="btn btn--reset" id="resetBtn">↺ Reset</button>
  </div>

  <!-- ── Session counter ────────────────────────────────── -->
  <div class="sessions">
    <div class="session-dots" id="sessionDots" aria-hidden="true"></div>
    <div class="session-count" id="sessionCount">Sessions: 0</div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/focustimer-extension
git add popup.html
git commit -m "feat: add popup.html structure with SVG ring and controls"
```

---

## Task 3: popup.css — styles, themes, ring animation

**Files:**
- Create: `C:\Users\serkan\focustimer-extension\popup.css`

- [ ] **Step 1: Write popup.css**

```css
/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── CSS Variables: Light theme ─────────────────────────── */
:root,
[data-theme="light"] {
  --bg:           #ffffff;
  --bg-secondary: #f9fafb;
  --surface:      #f3f4f6;
  --border:       #e5e7eb;
  --text:         #111827;
  --text-muted:   #6b7280;
  --ring-track:   #e5e7eb;
  --shadow:       0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
}

/* ── CSS Variables: Dark theme ──────────────────────────── */
[data-theme="dark"] {
  --bg:           #111827;
  --bg-secondary: #1f2937;
  --surface:      #374151;
  --border:       #374151;
  --text:         #f9fafb;
  --text-muted:   #9ca3af;
  --ring-track:   #374151;
  --shadow:       0 1px 3px rgba(0,0,0,0.4);
}

/* ── Mode color variables (set by JS) ───────────────────── */
:root {
  --mode-color:       #ef4444;
  --mode-color-light: rgba(239, 68, 68, 0.12);
}

/* ── Body ───────────────────────────────────────────────── */
body {
  width: 350px;
  min-height: 480px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  transition: background 0.2s ease, color 0.2s ease;
}

/* ── Toolbar ────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.toolbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__emoji { font-size: 18px; line-height: 1; }
.toolbar__title { font-size: 15px; font-weight: 600; letter-spacing: -0.2px; }

.toolbar__controls {
  display: flex;
  gap: 6px;
}

/* ── Buttons: base ──────────────────────────────────────── */
.btn {
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s ease, transform 0.1s ease, background 0.2s ease;
}

.btn--icon {
  background: var(--surface);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 14px;
  color: var(--text);
  line-height: 1;
}
.btn--icon:hover  { opacity: 0.75; }
.btn--icon.muted  { opacity: 0.35; }

/* ── Mode tabs ──────────────────────────────────────────── */
.mode-tabs {
  display: flex;
  gap: 4px;
  padding: 14px 16px 0;
}

.mode-tab {
  flex: 1;
  padding: 7px 4px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 500;
  background: var(--surface);
  color: var(--text-muted);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mode-tab:hover:not(:disabled) { color: var(--text); }

.mode-tab.active {
  background: var(--mode-color-light);
  color: var(--mode-color);
  border-color: var(--mode-color);
  font-weight: 600;
}

.mode-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Ring container ─────────────────────────────────────── */
.ring-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 20px auto;
}

/* SVG is rotated -90deg so arc starts at top */
.ring-svg {
  width: 200px;
  height: 200px;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--ring-track);
  stroke-width: 10;
}

.ring-progress {
  fill: none;
  stroke: var(--mode-color);
  stroke-width: 10;
  stroke-linecap: round;
  /* transition handles the smooth countdown animation */
  transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
}

/* Text overlay — not rotated (positioned absolute over SVG) */
.ring-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.timer-display {
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.timer-mode {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--mode-color);
  margin-top: 8px;
  text-transform: uppercase;
}

/* ── Controls ───────────────────────────────────────────── */
.controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 0 16px;
}

.btn--start {
  background: var(--mode-color);
  color: #ffffff;
  border-radius: 10px;
  padding: 11px 0;
  font-size: 14px;
  font-weight: 600;
  width: 140px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  transition: opacity 0.15s ease, transform 0.1s ease, background 0.3s ease;
}
.btn--start:hover  { opacity: 0.9; transform: translateY(-1px); }
.btn--start:active { transform: translateY(0); opacity: 1; }

.btn--reset {
  background: var(--surface);
  color: var(--text-muted);
  border-radius: 10px;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--border);
}
.btn--reset:hover { color: var(--text); border-color: var(--text-muted); }

/* ── Sessions ───────────────────────────────────────────── */
.sessions {
  text-align: center;
  padding: 20px 16px 28px;
}

.session-dots {
  font-size: 20px;
  letter-spacing: 4px;
  margin-bottom: 6px;
  min-height: 26px;
  line-height: 1;
}

.session-count {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Completion pulse animation ─────────────────────────── */
@keyframes pulse-ring {
  0%,  100% { transform: rotate(-90deg) scale(1);    }
  50%        { transform: rotate(-90deg) scale(1.04); }
}

.ring-container.complete .ring-svg {
  animation: pulse-ring 0.5s ease 3;
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/focustimer-extension
git add popup.css
git commit -m "feat: add popup.css with light/dark themes and ring animation"
```

---

## Task 4: popup.js — complete timer logic

**Files:**
- Create: `C:\Users\serkan\focustimer-extension\popup.js`

- [ ] **Step 1: Write popup.js**

```js
/**
 * popup.js — FocusTimer v1
 * Popup-only Pomodoro timer: work/break modes, SVG ring, Web Audio sounds,
 * chrome.notifications, session counter, dark/light theme.
 */

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEY = 'ft_prefs';

/** Duration and display config per mode */
const MODES = {
  work:  { label: 'WORK',        seconds: 25 * 60, color: '#ef4444', colorLight: 'rgba(239,68,68,0.12)'  },
  short: { label: 'SHORT BREAK', seconds:  5 * 60, color: '#22c55e', colorLight: 'rgba(34,197,94,0.12)'  },
  long:  { label: 'LONG BREAK',  seconds: 15 * 60, color: '#22c55e', colorLight: 'rgba(34,197,94,0.12)'  },
};

/** SVG circle r="80" → circumference = 2π × 80 ≈ 502.65 */
const RING_RADIUS       = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── State ─────────────────────────────────────────────────
const state = {
  mode:         'work',
  timeLeft:     MODES.work.seconds,  // seconds remaining
  isRunning:    false,
  sessions:     0,                   // work sessions completed this popup session
  intervalId:   null,
  // Persisted preferences:
  theme:        'light',
  soundEnabled: true,
};

// ── Audio ─────────────────────────────────────────────────
let _audioCtx = null;

/** Lazy-init AudioContext (must follow user gesture on first use) */
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

/** Short 1kHz click played every second while timer runs */
function playTick() {
  if (!state.soundEnabled) return;
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = 'sine';
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch { /* AudioContext unavailable — silent fail */ }
}

/** Ascending C5-E5-G5 chime played when timer completes */
function playChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx   = getAudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type            = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0,   t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch { /* silent fail */ }
}

// ── Notifications ─────────────────────────────────────────
const NOTIFY_MESSAGES = {
  work:  'Work session complete! Time for a break. 🎉',
  short: 'Short break over. Back to focus! 💪',
  long:  'Long break over. Ready to work? 🚀',
};

function fireNotification(mode) {
  chrome.notifications.create(`ft_${Date.now()}`, {
    type:    'basic',
    iconUrl: 'icons/icon128.svg',
    title:   'FocusTimer',
    message: NOTIFY_MESSAGES[mode],
  });
}

// ── Timer core ────────────────────────────────────────────
/** Called every second by setInterval */
function tick() {
  state.timeLeft--;
  updateDisplay();
  updateRing();
  playTick();

  if (state.timeLeft <= 0) {
    // Timer finished
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning  = false;

    if (state.mode === 'work') {
      state.sessions++;
      updateSessionCounter();
    }

    playChime();
    fireNotification(state.mode);
    onTimerComplete();
  }
}

function startTimer() {
  if (state.isRunning) return;
  state.isRunning  = true;
  state.intervalId = setInterval(tick, 1000);
  updateStartBtn();
  setTabsDisabled(true);
}

function pauseTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning  = false;
  updateStartBtn();
  setTabsDisabled(false);
}

function resetTimer() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning  = false;
  state.timeLeft   = MODES[state.mode].seconds;
  document.getElementById('ringContainer').classList.remove('complete');
  updateDisplay();
  updateRing();
  updateStartBtn();
  setTabsDisabled(false);
}

function switchMode(mode) {
  if (state.isRunning) return; // tabs disabled while running
  state.mode     = mode;
  state.timeLeft = MODES[mode].seconds;
  document.getElementById('ringContainer').classList.remove('complete');
  applyModeColors();
  updateDisplay();
  updateRing();
  updateModeTabs();
}

/** Called when timeLeft hits 0 */
function onTimerComplete() {
  const container = document.getElementById('ringContainer');
  container.classList.add('complete');
  updateStartBtn();
  // Remove pulse class after animation completes (3 × 0.5s)
  setTimeout(() => container.classList.remove('complete'), 1600);
}

// ── Render helpers ────────────────────────────────────────
/** Format seconds → "MM:SS" */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateDisplay() {
  document.getElementById('timerDisplay').textContent = formatTime(state.timeLeft);
  document.getElementById('timerMode').textContent    = MODES[state.mode].label;
}

function updateRing() {
  const total    = MODES[state.mode].seconds;
  const progress = state.timeLeft / total;
  // dashoffset 0 = full ring; dashoffset = circumference = empty ring
  const offset   = RING_CIRCUMFERENCE * (1 - progress);
  const ring     = document.getElementById('ringProgress');
  ring.style.strokeDasharray  = RING_CIRCUMFERENCE;
  ring.style.strokeDashoffset = offset;
}

function updateStartBtn() {
  document.getElementById('startBtn').textContent = state.isRunning ? '⏸ Pause' : '▶ Start';
}

function updateModeTabs() {
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    const active = tab.dataset.mode === state.mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active);
  });
}

function setTabsDisabled(disabled) {
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.disabled = disabled;
  });
}

function updateSessionCounter() {
  const n = state.sessions;
  // Show tomato dots cycling 1-4, then repeat
  const dots = n === 0 ? '' : '🍅'.repeat(((n - 1) % 4) + 1);
  document.getElementById('sessionDots').textContent  = dots;
  document.getElementById('sessionCount').textContent = `Sessions: ${n}`;
}

/** Apply --mode-color and --mode-color-light CSS vars + ring stroke */
function applyModeColors() {
  const { color, colorLight } = MODES[state.mode];
  const root = document.documentElement;
  root.style.setProperty('--mode-color',       color);
  root.style.setProperty('--mode-color-light', colorLight);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function applySoundState() {
  const btn = document.getElementById('soundToggle');
  btn.textContent = state.soundEnabled ? '🔔' : '🔕';
  btn.classList.toggle('muted', !state.soundEnabled);
  btn.title = state.soundEnabled ? 'Mute sounds' : 'Unmute sounds';
}

// ── Persistence ───────────────────────────────────────────
async function loadPrefs() {
  const res   = await chrome.storage.local.get(STORAGE_KEY);
  const prefs = res[STORAGE_KEY] ?? {};
  if (prefs.theme !== undefined)        state.theme        = prefs.theme;
  if (prefs.soundEnabled !== undefined) state.soundEnabled = prefs.soundEnabled;
}

function savePrefs() {
  chrome.storage.local.set({
    [STORAGE_KEY]: {
      theme:        state.theme,
      soundEnabled: state.soundEnabled,
    },
  });
}

// ── Event binding ─────────────────────────────────────────
function bindEvents() {
  // Start / Pause toggle
  document.getElementById('startBtn').addEventListener('click', () => {
    state.isRunning ? pauseTimer() : startTimer();
  });

  // Reset
  document.getElementById('resetBtn').addEventListener('click', resetTimer);

  // Mode tab clicks
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(state.theme);
    savePrefs();
  });

  // Sound toggle
  document.getElementById('soundToggle').addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    applySoundState();
    savePrefs();
  });
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadPrefs();
  applyTheme(state.theme);
  applySoundState();
  applyModeColors();
  updateDisplay();
  updateRing();
  updateStartBtn();
  updateModeTabs();
  updateSessionCounter();
  bindEvents();
});
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/focustimer-extension
git add popup.js
git commit -m "feat: add popup.js — timer logic, audio, notifications, session counter"
```

---

## Task 5: Load & verify in Chrome

**No files to create — manual verification steps.**

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `C:\Users\serkan\focustimer-extension`
5. Extension should appear with the red tomato icon

- [ ] **Step 2: Smoke test checklist**

| Action | Expected result |
|--------|----------------|
| Click extension icon | 350px popup opens, shows 25:00, Work mode active |
| Click **▶ Start** | Countdown begins, button shows ⏸ Pause, mode tabs disabled |
| Click **⏸ Pause** | Timer freezes, button shows ▶ Start, tabs re-enabled |
| Click **↺ Reset** | Timer resets to 25:00, ring full |
| Click **Short Break** tab | Timer shows 5:00, ring turns green |
| Click **Long Break** tab | Timer shows 15:00 |
| Click **Work** tab | Timer shows 25:00, ring turns red |
| Click 🌙 theme toggle | Dark theme applied, icon changes to ☀️ |
| Reload popup | Dark theme persists |
| Click 🔔 sound toggle | Icon changes to 🔕, sound muted state saved |
| Let timer reach 0 | Notification fires, chime plays (if sound on), ring pulses, sessions increments |
| Complete 4 work sessions | 4 🍅 dots show, then 5th session resets to 1 🍅 |

- [ ] **Step 3: Package as zip**

```bash
cd /c/Users/serkan/focustimer-extension
powershell -Command "Compress-Archive -Path manifest.json, popup.html, popup.css, popup.js, icons -DestinationPath ../focustimer-v1.zip -Force"
echo "Packaged to C:\Users\serkan\focustimer-v1.zip"
```

- [ ] **Step 4: Final commit**

```bash
cd /c/Users/serkan/focustimer-extension
git add -A
git commit -m "chore: project complete — FocusTimer v1.0.0"
```
