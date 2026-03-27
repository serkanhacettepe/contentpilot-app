# QuickNote v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild QuickNote Chrome extension into a full multi-note, multi-folder app with glassmorphism UI, search, export (PDF/TXT), and reminders.

**Architecture:** Pure client-side Chrome extension (Manifest V3). All state in `chrome.storage.local` as a single `qn_data` JSON object. UI is a 500×480px popup split into left panel (folders + notes) and right panel (editor). A background service worker handles alarm-based reminders.

**Tech Stack:** Manifest V3, vanilla JS (ES2020), CSS custom properties, Chrome Storage API, Chrome Alarms API, Chrome Notifications API, Clipboard API, Blob API, window.print().

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | Permissions (storage, alarms, notifications), service worker, popup |
| `background.js` | Service worker: listens for alarms, fires notifications |
| `popup.html` | 2-panel DOM skeleton |
| `popup.css` | Glassmorphism styles, light/dark themes, 500×480px layout |
| `popup.js` | All UI logic: storage, rendering, CRUD, search, export, reminders, theme |
| `icons/` | Existing SVG icons (unchanged) |

---

## Task 1: Update manifest.json + create background.js

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\manifest.json`
- Create: `C:\Users\serkan\quicknote-extension\background.js`

- [ ] **Step 1: Overwrite manifest.json**

```json
{
  "manifest_version": 3,
  "name": "QuickNote",
  "version": "2.0.0",
  "description": "Premium note-taking extension with folders, search, export and reminders.",
  "permissions": ["storage", "alarms", "notifications"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "QuickNote",
    "default_icon": {
      "16": "icons/icon16.svg",
      "48": "icons/icon48.svg",
      "128": "icons/icon128.svg"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.svg",
    "48": "icons/icon48.svg",
    "128": "icons/icon128.svg"
  }
}
```

- [ ] **Step 2: Create background.js**

```js
/**
 * background.js — QuickNote Service Worker
 * Listens for chrome.alarms and fires desktop notifications for reminders.
 */

const ALARM_PREFIX = 'qn_';
const STORAGE_KEY  = 'qn_data';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const noteId = alarm.name.slice(ALARM_PREFIX.length);
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];
  if (!data) return;

  const note = data.notes.find((n) => n.id === noteId);
  if (!note) return;

  const message = note.content
    ? note.content.slice(0, 80).replace(/\n/g, ' ')
    : 'Notuna bak!';

  chrome.notifications.create(`qn_notif_${noteId}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.svg',
    title: `⏰ ${note.title || 'QuickNote Hatırlatıcı'}`,
    message,
    priority: 2,
  });

  // Clear reminder from storage so it doesn't repeat
  const notes = data.notes.map((n) =>
    n.id === noteId ? { ...n, reminder: null } : n
  );
  await chrome.storage.local.set({ [STORAGE_KEY]: { ...data, notes } });
});
```

- [ ] **Step 3: Reload extension in Chrome**

Go to `chrome://extensions`, click reload on QuickNote. No errors should appear. Check "Service Worker" link shows background.js is registered.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add manifest.json background.js
git commit -m "feat: add alarms/notifications permissions and reminder service worker"
```

---

## Task 2: popup.html

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.html`

- [ ] **Step 1: Overwrite popup.html**

```html
<!DOCTYPE html>
<html lang="tr" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuickNote</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>

  <!-- ── Toolbar ─────────────────────────────────────────── -->
  <header class="toolbar">
    <div class="toolbar__brand">
      <svg class="toolbar__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
        <rect x="2" y="1" width="10" height="13" rx="1.5" fill="currentColor" opacity="0.9"/>
        <line x1="4.5" y1="5"   x2="9.5" y2="5"   stroke="var(--glass-bg-strong)" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" stroke="var(--glass-bg-strong)" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="4.5" y1="10"  x2="7.5" y2="10"  stroke="var(--glass-bg-strong)" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span class="toolbar__title">QuickNote</span>
    </div>
    <button class="btn btn--icon" id="themeToggle" aria-label="Tema değiştir">
      <span id="themeIcon">🌙</span>
    </button>
  </header>

  <!-- ── Main: 2-panel layout ───────────────────────────── -->
  <div class="main">

    <!-- LEFT PANEL -->
    <aside class="panel-left">

      <!-- Search -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          id="searchInput"
          class="search-input"
          placeholder="Ara..."
          autocomplete="off"
          spellcheck="false"
          aria-label="Notlarda ara"
        />
        <button class="btn btn--icon btn--xs" id="searchClear" aria-label="Aramayı temizle" hidden>✕</button>
      </div>

      <!-- New note button -->
      <button class="btn btn--new-note" id="newNoteBtn">+ Yeni Not</button>

      <!-- Note/folder list -->
      <div class="note-list" id="noteList" role="list">
        <!-- Rendered by JS -->
      </div>

      <!-- New folder button -->
      <div class="new-folder-wrap">
        <button class="btn btn--new-folder" id="newFolderBtn">+ Klasör</button>
      </div>

    </aside>

    <!-- RIGHT PANEL: Editor -->
    <main class="panel-right" id="editorPanel">

      <!-- Empty state -->
      <div class="empty-state" id="emptyState">
        <div class="empty-state__icon">📝</div>
        <p class="empty-state__text">Bir not seç veya yeni not oluştur</p>
      </div>

      <!-- Editor (hidden until note selected) -->
      <div class="editor" id="editor" hidden>

        <div class="editor__header">
          <input
            type="text"
            id="noteTitle"
            class="editor__title"
            placeholder="Başlık..."
            maxlength="100"
            aria-label="Not başlığı"
          />
          <button class="btn btn--icon btn--reminder" id="reminderBtn" title="Hatırlatıcı ekle" aria-label="Hatırlatıcı">⏰</button>
        </div>

        <!-- Reminder picker (hidden by default) -->
        <div class="reminder-picker" id="reminderPicker" hidden>
          <input type="datetime-local" id="reminderDatetime" class="reminder-datetime" />
          <button class="btn btn--sm btn--glass" id="reminderSave">Kaydet</button>
          <button class="btn btn--sm btn--glass btn--ghost" id="reminderCancel">İptal</button>
        </div>

        <!-- Folder selector -->
        <div class="folder-selector-wrap">
          <select id="folderSelect" class="folder-select" aria-label="Klasör seç">
            <option value="">📂 Klasörsüz</option>
            <!-- Populated by JS -->
          </select>
        </div>

        <!-- Textarea -->
        <textarea
          id="noteContent"
          class="editor__textarea"
          placeholder="Notunu buraya yaz..."
          spellcheck="true"
          aria-label="Not içeriği"
        ></textarea>

        <!-- Editor footer -->
        <div class="editor__footer">
          <span class="char-count" id="charCount" aria-live="polite">0 karakter</span>
          <div class="editor__actions">
            <button class="btn btn--sm btn--glass" id="exportPdfBtn" title="PDF olarak indir">PDF</button>
            <button class="btn btn--sm btn--glass" id="exportTxtBtn" title="TXT olarak indir">TXT</button>
            <button class="btn btn--sm btn--glass" id="copyBtn" title="Kopyala">Kopyala</button>
            <button class="btn btn--sm btn--glass btn--danger" id="deleteNoteBtn" title="Notu sil">🗑</button>
          </div>
        </div>

      </div>
    </main>

  </div><!-- /.main -->

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Reload and open popup — verify structure**

The popup should show a 500px-wide window with toolbar at top, left sidebar, and right editor area. Everything will be unstyled until Task 3.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.html
git commit -m "feat: restructure popup.html for 2-panel layout"
```

---

## Task 3: popup.css

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.css`

- [ ] **Step 1: Overwrite popup.css**

```css
/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── CSS Variables ──────────────────────────────────────── */
:root,
[data-theme="light"] {
  --grad-start:        #667eea;
  --grad-end:          #764ba2;
  --glass-bg:          rgba(255,255,255,0.15);
  --glass-bg-strong:   rgba(255,255,255,0.25);
  --glass-bg-subtle:   rgba(255,255,255,0.08);
  --glass-border:      rgba(255,255,255,0.25);
  --glass-border-weak: rgba(255,255,255,0.12);
  --text:              rgba(255,255,255,0.95);
  --text-muted:        rgba(255,255,255,0.5);
  --text-faint:        rgba(255,255,255,0.3);
  --accent:            rgba(255,255,255,0.9);
  --danger-bg:         rgba(220,38,38,0.25);
  --danger-border:     rgba(220,38,38,0.4);
  --danger-text:       #fca5a5;
  --active-bg:         rgba(255,255,255,0.22);
  --scrollbar:         rgba(255,255,255,0.2);
}

[data-theme="dark"] {
  --grad-start:        #1a1a2e;
  --grad-end:          #0f3460;
  --glass-bg:          rgba(255,255,255,0.06);
  --glass-bg-strong:   rgba(255,255,255,0.12);
  --glass-bg-subtle:   rgba(255,255,255,0.03);
  --glass-border:      rgba(255,255,255,0.1);
  --glass-border-weak: rgba(255,255,255,0.06);
  --text:              rgba(255,255,255,0.85);
  --text-muted:        rgba(255,255,255,0.4);
  --text-faint:        rgba(255,255,255,0.2);
  --accent:            #a5b4fc;
  --danger-bg:         rgba(220,38,38,0.15);
  --danger-border:     rgba(220,38,38,0.25);
  --danger-text:       #fca5a5;
  --active-bg:         rgba(255,255,255,0.1);
  --scrollbar:         rgba(255,255,255,0.1);
}

/* ── Base ───────────────────────────────────────────────── */
html {
  transition: background 0.25s ease;
}

body {
  width: 500px;
  height: 480px;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  background: linear-gradient(135deg, var(--grad-start) 0%, var(--grad-end) 100%);
  color: var(--text);
  overflow: hidden;
  position: relative;
}

/* Decorative orbs */
body::before, body::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
body::before {
  width: 250px; height: 250px;
  background: rgba(255,255,255,0.06);
  top: -80px; right: -60px;
}
body::after {
  width: 180px; height: 180px;
  background: rgba(255,255,255,0.04);
  bottom: -50px; left: -40px;
}

/* ── Toolbar ────────────────────────────────────────────── */
.toolbar {
  position: relative; z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 46px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.toolbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__icon {
  color: var(--accent);
  flex-shrink: 0;
}

.toolbar__title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* ── Main layout ────────────────────────────────────────── */
.main {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
}

/* ── Left panel ─────────────────────────────────────────── */
.panel-left {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--glass-border-weak);
  background: var(--glass-bg-subtle);
  overflow: hidden;
}

/* Search */
.search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 10px 6px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 6px 8px;
  transition: border-color 0.15s ease;
}

.search-wrap:focus-within {
  border-color: var(--glass-bg-strong);
}

.search-icon {
  font-size: 12px;
  opacity: 0.6;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* New note button */
.btn--new-note {
  margin: 0 10px 8px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 7px 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.btn--new-note:hover {
  background: var(--glass-bg-strong);
  opacity: 0.85;
}

/* Note list */
.note-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 6px;
}

.note-list::-webkit-scrollbar { width: 3px; }
.note-list::-webkit-scrollbar-track { background: transparent; }
.note-list::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }

/* Folder header */
.folder-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 6px 4px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
}

.folder-header:hover {
  color: var(--text);
}

/* Note item */
.note-item {
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.12s ease;
}

.note-item:hover {
  background: var(--glass-bg);
}

.note-item.active {
  background: var(--active-bg);
}

.note-item__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-item__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: var(--text-faint);
  font-size: 10px;
}

/* New folder button */
.new-folder-wrap {
  padding: 6px 10px 10px;
  flex-shrink: 0;
  border-top: 1px solid var(--glass-border-weak);
}

.btn--new-folder {
  width: 100%;
  background: transparent;
  border: 1px dashed var(--glass-border);
  border-radius: 7px;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  padding: 6px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.btn--new-folder:hover {
  color: var(--text);
  border-color: var(--glass-border);
}

/* Inline folder name input */
.new-folder-input {
  width: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 7px;
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  padding: 6px 8px;
  outline: none;
}

/* ── Right panel ────────────────────────────────────────── */
.panel-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0.5;
}

.empty-state__icon { font-size: 32px; }
.empty-state__text { font-size: 12px; color: var(--text-muted); }

/* Editor */
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px 10px 14px;
  gap: 8px;
}

.editor__header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.editor__title {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--glass-border-weak);
  outline: none;
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 6px;
  transition: border-color 0.15s ease;
}

.editor__title:focus {
  border-bottom-color: var(--glass-border);
}

.editor__title::placeholder {
  color: var(--text-faint);
  font-weight: 400;
}

/* Reminder picker */
.reminder-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 7px 10px;
  flex-shrink: 0;
}

.reminder-datetime {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  color-scheme: dark;
  min-width: 0;
}

/* Folder selector */
.folder-selector-wrap {
  flex-shrink: 0;
}

.folder-select {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-weak);
  border-radius: 7px;
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  padding: 5px 8px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.folder-select:focus {
  border-color: var(--glass-border);
}

.folder-select option {
  background: #764ba2;
  color: white;
}

/* Textarea */
.editor__textarea {
  flex: 1;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-weak);
  border-radius: 10px;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  padding: 10px 12px;
  resize: none;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
  min-height: 0;
}

.editor__textarea:focus {
  border-color: var(--glass-border);
  background: var(--glass-bg);
}

.editor__textarea::placeholder { color: var(--text-faint); }
.editor__textarea::-webkit-scrollbar { width: 3px; }
.editor__textarea::-webkit-scrollbar-track { background: transparent; }
.editor__textarea::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }

/* Editor footer */
.editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.char-count {
  font-size: 10px;
  color: var(--text-faint);
  min-width: 70px;
}

.editor__actions {
  display: flex;
  gap: 5px;
}

/* ── Buttons ────────────────────────────────────────────── */
.btn {
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.btn--icon {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-weak);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}

.btn--icon:hover { background: var(--glass-bg-strong); }

.btn--xs { width: 20px; height: 20px; font-size: 10px; border: none; background: transparent; }

.btn--sm {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-weak);
  border-radius: 7px;
  color: var(--text);
  font-size: 11px;
  font-weight: 500;
  padding: 5px 10px;
}

.btn--glass { background: var(--glass-bg); border: 1px solid var(--glass-border-weak); color: var(--text); }
.btn--glass:hover { background: var(--glass-bg-strong); }

.btn--ghost { background: transparent; border-color: transparent; opacity: 0.6; }
.btn--ghost:hover { opacity: 1; }

.btn--danger { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger-text); }
.btn--danger:hover { opacity: 0.8; }

.btn--reminder {
  background: transparent;
  border: none;
  font-size: 16px;
  width: 28px; height: 28px;
  opacity: 0.6;
}
.btn--reminder:hover { opacity: 1; }
.btn--reminder.active { opacity: 1; }
```

- [ ] **Step 2: Reload + open popup — verify glassmorphism**

Popup should show purple gradient background, glass-effect toolbar, 2-panel layout. Left panel has search + "Yeni Not" + empty list. Right shows empty state.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.css
git commit -m "feat: add glassmorphism styles for v2 2-panel layout"
```

---

## Task 4: popup.js — Data layer

**Files:**
- Create: `C:\Users\serkan\quicknote-extension\popup.js` (replaces v1)

- [ ] **Step 1: Write popup.js — data layer only**

```js
/**
 * popup.js — QuickNote v2
 * Single-file app: data layer + rendering + all features
 */

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEY    = 'qn_data';
const ALARM_PREFIX   = 'qn_';
const DEBOUNCE_SAVE  = 300;
const DEBOUNCE_SRCH  = 200;
const COPY_FB_MS     = 1500;

// ── Default data ──────────────────────────────────────────
function defaultData() {
  return {
    folders: [],
    notes: [],
    theme: 'light',
    selectedNoteId: null,
    selectedFolderId: null,
  };
}

// ── ID generator ──────────────────────────────────────────
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Debounce ──────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Storage ───────────────────────────────────────────────
async function loadData() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  return res[STORAGE_KEY] ?? defaultData();
}

const _scheduleSave = debounce(async (data) => {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}, DEBOUNCE_SAVE);

function saveData(data) {
  _scheduleSave(data);
}

// ── Date formatting ───────────────────────────────────────
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7)  return `${diffDays} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ── App state (in-memory, synced from storage) ────────────
let appData = defaultData();

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  appData = await loadData();
  applyTheme(appData.theme);
  render();
  bindEvents();
});
```

- [ ] **Step 2: Reload popup — verify no console errors**

Open DevTools on the popup (right-click popup → Inspect). Console should be clean.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add popup.js data layer and app init"
```

---

## Task 5: popup.js — Rendering engine

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Append rendering functions to popup.js**

Add these functions after the `bindEvents` placeholder (keep existing code, append below):

```js
// ── Theme ─────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Render: main entry point ──────────────────────────────
function render(searchQuery = '') {
  renderNoteList(searchQuery);
  renderEditor();
  renderFolderSelect();
}

// ── Render: note list (left panel) ────────────────────────
function renderNoteList(searchQuery = '') {
  const list = document.getElementById('noteList');
  list.innerHTML = '';

  const q = searchQuery.trim().toLowerCase();

  if (q) {
    // Search mode: flat list, no folder grouping
    const matches = appData.notes.filter((n) =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
    if (matches.length === 0) {
      list.innerHTML = `<p style="padding:12px 10px;font-size:11px;opacity:0.5;text-align:center;">Sonuç yok</p>`;
      return;
    }
    matches.forEach((note) => list.appendChild(makeNoteItem(note)));
    return;
  }

  // Normal mode: group by folder
  // "All Notes" section first (no folder filter — show all)
  const allHeader = document.createElement('div');
  allHeader.className = 'folder-header';
  allHeader.textContent = '📋 Tüm Notlar';
  allHeader.style.cursor = 'default';
  list.appendChild(allHeader);

  // Notes without a folder
  const unfiled = appData.notes.filter((n) => !n.folderId);
  unfiled.forEach((note) => list.appendChild(makeNoteItem(note)));

  // Notes grouped by folder
  appData.folders.forEach((folder) => {
    const folderNotes = appData.notes.filter((n) => n.folderId === folder.id);
    const header = document.createElement('div');
    header.className = 'folder-header';
    header.innerHTML = `<span>📁 ${escHtml(folder.name)}</span><span style="margin-left:auto;opacity:0.5;font-size:9px;">${folderNotes.length}</span>`;

    // Right-click to delete folder
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`"${folder.name}" klasörünü sil? (Notlar korunur)`)) {
        appData.folders = appData.folders.filter((f) => f.id !== folder.id);
        appData.notes = appData.notes.map((n) =>
          n.folderId === folder.id ? { ...n, folderId: null } : n
        );
        saveData(appData);
        render();
      }
    });

    list.appendChild(header);
    folderNotes.forEach((note) => list.appendChild(makeNoteItem(note)));
  });
}

// ── Helper: single note item ──────────────────────────────
function makeNoteItem(note) {
  const item = document.createElement('div');
  item.className = 'note-item' + (note.id === appData.selectedNoteId ? ' active' : '');
  item.setAttribute('role', 'listitem');
  item.setAttribute('data-note-id', note.id);

  const hasReminder = !!note.reminder;
  item.innerHTML = `
    <div class="note-item__title">${escHtml(note.title || 'Başlıksız')}</div>
    <div class="note-item__meta">
      <span>${formatDate(note.updatedAt)}</span>
      ${hasReminder ? '<span>⏰</span>' : ''}
    </div>
  `;

  item.addEventListener('click', () => {
    appData.selectedNoteId = note.id;
    saveData(appData);
    render();
  });

  return item;
}

// ── Render: editor (right panel) ─────────────────────────
function renderEditor() {
  const emptyState = document.getElementById('emptyState');
  const editor     = document.getElementById('editor');
  const note = appData.notes.find((n) => n.id === appData.selectedNoteId);

  if (!note) {
    emptyState.hidden = false;
    editor.hidden = true;
    return;
  }

  emptyState.hidden = true;
  editor.hidden = false;

  document.getElementById('noteTitle').value   = note.title;
  document.getElementById('noteContent').value = note.content;
  updateCharCount(note.content.length);

  // Reminder button state
  const reminderBtn = document.getElementById('reminderBtn');
  reminderBtn.classList.toggle('active', !!note.reminder);
  reminderBtn.title = note.reminder
    ? `Hatırlatıcı: ${new Date(note.reminder.time).toLocaleString('tr-TR')}`
    : 'Hatırlatıcı ekle';

  // Hide reminder picker
  document.getElementById('reminderPicker').hidden = true;

  renderFolderSelect(note.folderId);
}

// ── Render: folder <select> in editor ────────────────────
function renderFolderSelect(selectedFolderId = null) {
  const sel = document.getElementById('folderSelect');
  const current = selectedFolderId ?? sel.value;
  sel.innerHTML = `<option value="">📂 Klasörsüz</option>`;
  appData.folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `📁 ${f.name}`;
    if (f.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── Char count ────────────────────────────────────────────
function updateCharCount(n) {
  document.getElementById('charCount').textContent =
    n === 1 ? '1 karakter' : `${n} karakter`;
}

// ── Escape HTML ───────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Placeholder for bindEvents (implemented in Task 6+) ──
function bindEvents() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    appData.theme = appData.theme === 'light' ? 'dark' : 'light';
    applyTheme(appData.theme);
    saveData(appData);
  });
}
```

- [ ] **Step 2: Reload popup — verify rendering works**

Open popup. Left panel should show "📋 Tüm Notlar" header. Right panel shows empty state. Theme toggle should work.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add rendering engine (note list, editor, theme)"
```

---

## Task 6: popup.js — Note CRUD + auto-save

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Replace `bindEvents` with full version**

Find the `function bindEvents()` block (added in Task 5) and **replace it entirely** with:

```js
function bindEvents() {
  // ── Theme toggle ─────────────────────────────────────
  document.getElementById('themeToggle').addEventListener('click', () => {
    appData.theme = appData.theme === 'light' ? 'dark' : 'light';
    applyTheme(appData.theme);
    saveData(appData);
  });

  // ── New note ─────────────────────────────────────────
  document.getElementById('newNoteBtn').addEventListener('click', () => {
    const note = {
      id: uid(),
      title: '',
      content: '',
      folderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reminder: null,
    };
    appData.notes.unshift(note);
    appData.selectedNoteId = note.id;
    saveData(appData);
    render();
    // Focus title immediately
    setTimeout(() => document.getElementById('noteTitle').focus(), 50);
  });

  // ── Note title auto-save ──────────────────────────────
  const debouncedSave = debounce(() => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;
    note.title   = document.getElementById('noteTitle').value;
    note.content = document.getElementById('noteContent').value;
    note.updatedAt = Date.now();
    saveData(appData);
    // Re-render just the note list to update title/date (not editor)
    renderNoteList(_currentSearchQuery());
  }, DEBOUNCE_SAVE);

  document.getElementById('noteTitle').addEventListener('input', debouncedSave);

  // ── Note content auto-save ────────────────────────────
  document.getElementById('noteContent').addEventListener('input', () => {
    const n = document.getElementById('noteContent').value.length;
    updateCharCount(n);
    debouncedSave();
  });

  // ── Folder select change ──────────────────────────────
  document.getElementById('folderSelect').addEventListener('change', (e) => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;
    note.folderId  = e.target.value || null;
    note.updatedAt = Date.now();
    saveData(appData);
    renderNoteList(_currentSearchQuery());
  });

  // ── Delete note ───────────────────────────────────────
  document.getElementById('deleteNoteBtn').addEventListener('click', () => {
    if (!appData.selectedNoteId) return;
    if (!confirm('Bu notu silmek istediğine emin misin?')) return;

    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (note?.reminder) {
      chrome.alarms.clear(ALARM_PREFIX + note.id);
    }
    appData.notes = appData.notes.filter((n) => n.id !== appData.selectedNoteId);
    appData.selectedNoteId = appData.notes[0]?.id ?? null;
    saveData(appData);
    render();
  });

  // ── Copy ─────────────────────────────────────────────
  document.getElementById('copyBtn').addEventListener('click', async () => {
    const content = document.getElementById('noteContent').value;
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      const btn = document.getElementById('copyBtn');
      btn.textContent = 'Kopyalandı!';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = 'Kopyala'; btn.disabled = false; }, COPY_FB_MS);
    } catch {
      // silent fail
    }
  });
}

// Helper: current search query
function _currentSearchQuery() {
  return document.getElementById('searchInput').value;
}
```

- [ ] **Step 2: Reload — test note CRUD**

| Action | Expected |
|--------|---------|
| Click "+ Yeni Not" | New note appears in list, editor opens, title focused |
| Type title | Title updates in left panel after 300ms |
| Type content | Char count updates live |
| Close popup, reopen | Note is still there with content |
| Click 🗑 → confirm | Note deleted, next note selected |

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add note CRUD, auto-save, copy, delete"
```

---

## Task 7: popup.js — Folder CRUD

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Add folder creation to `bindEvents`**

Inside `bindEvents()`, after the `copyBtn` event listener, append:

```js
  // ── New folder ────────────────────────────────────────
  document.getElementById('newFolderBtn').addEventListener('click', () => {
    const wrap = document.querySelector('.new-folder-wrap');

    // Replace button with input
    wrap.innerHTML = `<input type="text" class="new-folder-input" id="newFolderInput" placeholder="Klasör adı..." maxlength="30" autofocus />`;
    const input = document.getElementById('newFolderInput');
    input.focus();

    function commit() {
      const name = input.value.trim();
      if (name) {
        appData.folders.push({ id: uid(), name });
        saveData(appData);
      }
      // Restore button
      wrap.innerHTML = `<button class="btn btn--new-folder" id="newFolderBtn">+ Klasör</button>`;
      document.getElementById('newFolderBtn').addEventListener('click', arguments.callee.caller || (() => {}));
      render();
      // Re-bind since we replaced the DOM
      document.getElementById('newFolderBtn').addEventListener('click', () => {
        document.getElementById('newFolderBtn').dispatchEvent(new Event('_rebind'));
      });
      bindNewFolderBtn();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  commit();
      if (e.key === 'Escape') {
        wrap.innerHTML = `<button class="btn btn--new-folder" id="newFolderBtn">+ Klasör</button>`;
        bindNewFolderBtn();
      }
    });
    input.addEventListener('blur', commit);
  });
```

- [ ] **Step 2: Add `bindNewFolderBtn` helper function** (after `bindEvents`):

```js
function bindNewFolderBtn() {
  const btn = document.getElementById('newFolderBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const wrap = document.querySelector('.new-folder-wrap');
    wrap.innerHTML = `<input type="text" class="new-folder-input" id="newFolderInput" placeholder="Klasör adı..." maxlength="30" />`;
    const input = document.getElementById('newFolderInput');
    input.focus();

    function commit() {
      const name = input.value.trim();
      if (name) {
        appData.folders.push({ id: uid(), name });
        saveData(appData);
      }
      wrap.innerHTML = `<button class="btn btn--new-folder" id="newFolderBtn">+ Klasör</button>`;
      bindNewFolderBtn();
      render();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  commit();
      if (e.key === 'Escape') {
        wrap.innerHTML = `<button class="btn btn--new-folder" id="newFolderBtn">+ Klasör</button>`;
        bindNewFolderBtn();
      }
    });
    input.addEventListener('blur', commit);
  });
}
```

- [ ] **Step 3: Call `bindNewFolderBtn()` at end of `bindEvents`**

At the very end of `bindEvents()`, before the closing `}`, add:

```js
  bindNewFolderBtn();
```

Also, **remove** the `newFolderBtn` click listener block from `bindEvents` (it's now in `bindNewFolderBtn`). The folder delete was already handled in `makeNoteItem`'s `contextmenu`.

- [ ] **Step 4: Reload — test folder CRUD**

| Action | Expected |
|--------|---------|
| Click "+ Klasör" | Input appears |
| Type name + Enter | Folder appears in left panel |
| Assign note to folder via dropdown | Note moves under folder in list |
| Right-click folder header | Confirm dialog → folder deleted, notes unfiled |

- [ ] **Step 5: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add folder CRUD with inline name input"
```

---

## Task 8: popup.js — Search

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Add search event listeners to `bindEvents`** (before `bindNewFolderBtn()` call):

```js
  // ── Search ────────────────────────────────────────────
  const debouncedSearch = debounce((q) => {
    renderNoteList(q);
    document.getElementById('searchClear').hidden = !q;
  }, DEBOUNCE_SRCH);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  document.getElementById('searchClear').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').hidden = true;
    renderNoteList('');
  });
```

- [ ] **Step 2: Reload — test search**

| Action | Expected |
|--------|---------|
| Type in search box | List filters by title + content, ✕ button appears |
| Click ✕ | Search cleared, full list restored |
| Search with no matches | "Sonuç yok" message |

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add debounced search (title + content)"
```

---

## Task 9: popup.js — Export (PDF + TXT)

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Add export listeners to `bindEvents`** (before `bindNewFolderBtn()` call):

```js
  // ── Export TXT ────────────────────────────────────────
  document.getElementById('exportTxtBtn').addEventListener('click', () => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;
    const blob = new Blob([note.content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(note.title || 'not').replace(/[^a-z0-9ğüşıöç\s-]/gi, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Export PDF ────────────────────────────────────────
  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;

    // Build a print window with clean white styling
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <title>${escHtml(note.title || 'QuickNote')}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #1a1a1a; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          .meta { font-size: 11px; color: #888; margin-bottom: 24px; }
          pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.7; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>${escHtml(note.title || 'Başlıksız Not')}</h1>
        <div class="meta">${new Date(note.updatedAt).toLocaleString('tr-TR')}</div>
        <pre>${escHtml(note.content)}</pre>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  });
```

- [ ] **Step 2: Reload — test exports**

| Action | Expected |
|--------|---------|
| Click TXT with content | Downloads `{title}.txt` file |
| Click TXT with empty note | Nothing happens |
| Click PDF with content | New window opens, print dialog appears |

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add export TXT (Blob download) and PDF (print window)"
```

---

## Task 10: popup.js — Reminders

**Files:**
- Modify: `C:\Users\serkan\quicknote-extension\popup.js`

- [ ] **Step 1: Add reminder listeners to `bindEvents`** (before `bindNewFolderBtn()` call):

```js
  // ── Reminder toggle ───────────────────────────────────
  document.getElementById('reminderBtn').addEventListener('click', () => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;

    const picker = document.getElementById('reminderPicker');

    if (note.reminder) {
      // Already has reminder — offer to cancel
      if (confirm('Hatırlatıcıyı iptal etmek istiyor musun?')) {
        chrome.alarms.clear(ALARM_PREFIX + note.id);
        note.reminder = null;
        note.updatedAt = Date.now();
        saveData(appData);
        renderEditor();
      }
      return;
    }

    // Show picker
    picker.hidden = false;

    // Set minimum datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('reminderDatetime').min = now.toISOString().slice(0, 16);
    document.getElementById('reminderDatetime').value = '';
  });

  // ── Reminder save ─────────────────────────────────────
  document.getElementById('reminderSave').addEventListener('click', () => {
    const note = appData.notes.find((n) => n.id === appData.selectedNoteId);
    if (!note) return;

    const val = document.getElementById('reminderDatetime').value;
    if (!val) return;

    const time = new Date(val).getTime();
    if (time <= Date.now()) {
      alert('Lütfen gelecekte bir zaman seç.');
      return;
    }

    const alarmName = ALARM_PREFIX + note.id;
    chrome.alarms.create(alarmName, { when: time });
    note.reminder  = { time, alarmName };
    note.updatedAt = Date.now();
    saveData(appData);

    document.getElementById('reminderPicker').hidden = true;
    renderEditor();
    renderNoteList(_currentSearchQuery());
  });

  // ── Reminder cancel picker ────────────────────────────
  document.getElementById('reminderCancel').addEventListener('click', () => {
    document.getElementById('reminderPicker').hidden = true;
  });
```

- [ ] **Step 2: Reload — test reminders**

| Action | Expected |
|--------|---------|
| Click ⏰ on note without reminder | Datetime picker appears |
| Select future time → Kaydet | Picker closes, ⏰ turns solid, note list shows ⏰ |
| Click ⏰ on note with reminder | Confirm dialog to cancel |
| Confirm cancel | Reminder removed |

> Note: To test the alarm notification, set a reminder 1-2 minutes in the future, close the popup, and wait. A Chrome notification should appear.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/serkan/quicknote-extension
git add popup.js
git commit -m "feat: add reminder system with chrome.alarms and notifications"
```

---

## Task 11: Final verification

**Files:** All files — read-only verification

- [ ] **Step 1: Verify file tree**

```bash
find /c/Users/serkan/quicknote-extension -not -path '*/.git/*' -not -path '*/.superpowers/*' | sort
```

Expected:
```
background.js
icons/icon128.svg
icons/icon16.svg
icons/icon48.svg
manifest.json
popup.css
popup.html
popup.js
```

- [ ] **Step 2: Full feature smoke test**

| Feature | Test | Expected |
|---------|------|---------|
| Create note | Click "+ Yeni Not" | New note in list, editor open |
| Auto-save | Type, close, reopen | Content preserved |
| Create folder | Click "+ Klasör", type name, Enter | Folder appears |
| Assign to folder | Dropdown in editor | Note moves under folder |
| Delete folder (right-click) | Confirm | Folder gone, notes unfiled |
| Search | Type in search box | Filtered results |
| Search clear | Click ✕ | Full list restored |
| Export TXT | Click TXT | File downloads |
| Export PDF | Click PDF | Print dialog opens |
| Reminder set | ⏰ → pick time → Kaydet | ⏰ icon active |
| Reminder cancel | ⏰ on active note → confirm | Removed |
| Theme toggle | Click ☀/🌙 | Theme switches + persists |
| Delete note | 🗑 → confirm | Note removed |

- [ ] **Step 3: Check for console errors**

Right-click popup → Inspect → Console. Should be clean (no red errors).

- [ ] **Step 4: Final commit**

```bash
cd /c/Users/serkan/quicknote-extension
git log --oneline
git status
# If clean, done. If any uncommitted changes:
git add -A
git commit -m "chore: QuickNote v2.0.0 complete"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Multiple notes: Task 6 (create, select, delete, auto-save)
- ✅ Folder system: Task 7 (create inline, assign via dropdown, delete via right-click)
- ✅ Search: Task 8 (debounced, title+content, clear button)
- ✅ Export PDF: Task 9 (print window)
- ✅ Export TXT: Task 9 (Blob download)
- ✅ Reminders: Task 10 (chrome.alarms + notifications via background.js Task 1)
- ✅ Glassmorphism purple/blue: Task 3
- ✅ 2-panel 500×480px: Tasks 2+3
- ✅ Dark/light theme: Tasks 3+5
- ✅ Auto-save 300ms debounce: Task 6

**Type consistency:**
- `STORAGE_KEY = 'qn_data'` — used in loadData (Task 4) and background.js (Task 1) ✅
- `ALARM_PREFIX = 'qn_'` — used in bindEvents reminder (Task 10) and background.js (Task 1) ✅
- `uid()` — used in new note (Task 6) and new folder (Task 7) ✅
- `saveData(appData)` — used consistently throughout ✅
- `renderNoteList(_currentSearchQuery())` — called in Tasks 6,7,8,10 ✅
- `escHtml()` — used in makeNoteItem (Task 5) and PDF export (Task 9) ✅
