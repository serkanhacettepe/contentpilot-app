# TextExpander Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Chrome extension that auto-expands text shortcuts (e.g. `/hello` + Space → full greeting) in any text field, with a popup UI for managing snippets.

**Architecture:** Popup + Content Script, Manifest V3. `popup.js` handles CRUD via `chrome.storage.local`. `content.js` runs on all pages, listens for Space keypress, and expands matched shortcuts using `document.execCommand('insertText')`. No background service worker.

**Tech Stack:** Vanilla JS ES2020, CSS custom properties, `chrome.storage.local`, `document.execCommand`, `MutationObserver`, Manifest V3.

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | MV3 config, permissions (storage, clipboardWrite), content_scripts on `<all_urls>`, Alt+Shift+T command |
| `popup.html` | DOM: toolbar, search bar, category chips, snippet list, edit form |
| `popup.css` | CSS variables, light/dark themes, chip layout, card styles, tooltip |
| `popup.js` | All popup logic: CRUD, search, copy, import/export, chips, render |
| `content.js` | keydown listener, expansion via execCommand, storage sync, MutationObserver |
| `icons/icon16.svg` | 16px toolbar icon |
| `icons/icon48.svg` | 48px extensions page icon |
| `icons/icon128.svg` | 128px store icon |

---

## Task 1: Project setup — directory, git, manifest, icons

**Files:**
- Create: `C:\Users\serkan\textexpander-extension\manifest.json`
- Create: `C:\Users\serkan\textexpander-extension\icons\icon16.svg`
- Create: `C:\Users\serkan\textexpander-extension\icons\icon48.svg`
- Create: `C:\Users\serkan\textexpander-extension\icons\icon128.svg`

- [ ] **Step 1: Create project directory and git repo**

```bash
mkdir -p /c/Users/serkan/textexpander-extension/icons
cd /c/Users/serkan/textexpander-extension
git init
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "TextExpander",
  "version": "1.0.0",
  "description": "Save text shortcuts that auto-expand in any text field on any website.",
  "permissions": ["storage", "clipboardWrite"],
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
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Alt+Shift+T",
        "windows": "Alt+Shift+T",
        "mac":     "Alt+Shift+T",
        "linux":   "Alt+Shift+T"
      },
      "description": "Open TextExpander"
    }
  }
}
```

- [ ] **Step 3: Write icons/icon16.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
  <rect x="1" y="1" width="14" height="14" rx="3" fill="#6366f1"/>
  <path d="M9 2.5 L5 9 L8 9 L7 13.5 L11 7 L8 7 Z" fill="white" opacity="0.95"/>
</svg>
```

- [ ] **Step 4: Write icons/icon48.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect x="3" y="3" width="42" height="42" rx="9" fill="#6366f1"/>
  <path d="M27 6 L15 27 L24 27 L21 42 L33 21 L24 21 Z" fill="white" opacity="0.95"/>
</svg>
```

- [ ] **Step 5: Write icons/icon128.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect x="8" y="8" width="112" height="112" rx="24" fill="#6366f1"/>
  <path d="M72 16 L40 72 L64 72 L56 112 L88 56 L64 56 Z" fill="white" opacity="0.95"/>
</svg>
```

- [ ] **Step 6: Initial commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add manifest.json icons/
git commit -m "feat: initial project setup — manifest and icons"
```

---

## Task 2: popup.html — DOM structure

**Files:**
- Create: `C:\Users\serkan\textexpander-extension\popup.html`

- [ ] **Step 1: Write popup.html**

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TextExpander</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>

  <!-- ── Toolbar ──────────────────────────────────────────── -->
  <header class="toolbar">
    <div class="toolbar__brand">
      <span class="toolbar__emoji" aria-hidden="true">⚡</span>
      <span class="toolbar__title">TextExpander</span>
    </div>
    <div class="toolbar__actions">
      <button id="exportBtn"   class="btn btn--icon" title="Export snippets" aria-label="Export">↓</button>
      <button id="importBtn"   class="btn btn--icon" title="Import snippets" aria-label="Import">↑</button>
      <input  type="file" id="importFile" accept=".json" hidden aria-hidden="true" />
      <button id="themeToggle" class="btn btn--icon" title="Toggle theme" aria-label="Toggle theme">🌙</button>
      <button id="newSnippetBtn" class="btn btn--new" aria-label="New snippet">+ New</button>
    </div>
  </header>

  <!-- ── Search bar ───────────────────────────────────────── -->
  <div class="search-bar">
    <span class="search-icon" aria-hidden="true">🔍</span>
    <input
      type="text"
      id="searchInput"
      class="search-input"
      placeholder="Search shortcuts..."
      autocomplete="off"
      spellcheck="false"
      aria-label="Search snippets"
    />
  </div>

  <!-- ── Category chips ───────────────────────────────────── -->
  <div class="chips-bar" id="chipsBar" role="list" aria-label="Category filters">
    <!-- Rendered by JS -->
  </div>

  <!-- ── Content area ─────────────────────────────────────── -->
  <div class="content" id="content">

    <!-- List view -->
    <div class="list-view" id="listView">
      <div class="snippet-list" id="snippetList" role="list" aria-label="Saved snippets"></div>
    </div>

    <!-- Edit / Add view (hidden until triggered) -->
    <div class="edit-view" id="editView" hidden>
      <div class="edit-header">
        <h2 class="edit-title" id="editTitle">New Snippet</h2>
        <button class="btn btn--icon" id="cancelBtn" aria-label="Cancel">✕</button>
      </div>
      <div class="edit-form">
        <label class="form-label" for="shortcutInput">Shortcut</label>
        <input
          type="text"
          id="shortcutInput"
          class="form-input form-input--mono"
          placeholder="/hello"
          maxlength="30"
          autocomplete="off"
          spellcheck="false"
        />

        <label class="form-label" for="contentInput">Expanded Text</label>
        <textarea
          id="contentInput"
          class="form-textarea"
          placeholder="Hi there! Thank you for reaching out..."
          rows="6"
          spellcheck="true"
          aria-label="Expanded text"
        ></textarea>

        <label class="form-label" for="categorySelect">Category</label>
        <select id="categorySelect" class="form-select" aria-label="Select category"></select>

        <div class="edit-actions">
          <button class="btn btn--danger"    id="deleteSnippetBtn" hidden>🗑 Delete</button>
          <button class="btn btn--secondary" id="cancelBtn2">Cancel</button>
          <button class="btn btn--primary"   id="saveSnippetBtn">Save</button>
        </div>
      </div>
    </div>

  </div><!-- /.content -->

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add popup.html
git commit -m "feat: add popup.html — toolbar, search, chips, list/edit views"
```

---

## Task 3: popup.css — styles, chip layout, themes

**Files:**
- Create: `C:\Users\serkan\textexpander-extension\popup.css`

- [ ] **Step 1: Write popup.css**

```css
/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── CSS Variables: Light ───────────────────────────────── */
:root,
[data-theme="light"] {
  --bg:            #ffffff;
  --bg-secondary:  #f8fafc;
  --surface:       #f1f5f9;
  --surface-hover: #e2e8f0;
  --border:        #e2e8f0;
  --text:          #0f172a;
  --text-muted:    #64748b;
  --text-faint:    #94a3b8;
  --accent:        #6366f1;
  --accent-light:  rgba(99, 102, 241, 0.12);
  --danger:        #ef4444;
  --danger-light:  rgba(239, 68, 68, 0.10);
}

/* ── CSS Variables: Dark ────────────────────────────────── */
[data-theme="dark"] {
  --bg:            #0f172a;
  --bg-secondary:  #1e293b;
  --surface:       #1e293b;
  --surface-hover: #334155;
  --border:        #334155;
  --text:          #f1f5f9;
  --text-muted:    #94a3b8;
  --text-faint:    #475569;
  --accent:        #818cf8;
  --accent-light:  rgba(129, 140, 248, 0.15);
  --danger:        #f87171;
  --danger-light:  rgba(248, 113, 113, 0.10);
}

/* ── Body ───────────────────────────────────────────────── */
body {
  width: 380px;
  height: 520px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: background 0.2s ease, color 0.2s ease;
}

/* ── Toolbar ────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  height: 44px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg);
}

.toolbar__brand { display: flex; align-items: center; gap: 6px; }
.toolbar__emoji { font-size: 15px; line-height: 1; }
.toolbar__title { font-size: 13px; font-weight: 600; letter-spacing: -0.2px; }
.toolbar__actions { display: flex; align-items: center; gap: 2px; }

/* ── Buttons ────────────────────────────────────────────── */
.btn {
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s ease, opacity 0.12s ease, color 0.12s ease;
}

.btn--icon {
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px;
  padding: 5px 7px;
  font-size: 13px;
  line-height: 1;
}
.btn--icon:hover { background: var(--surface); color: var(--text); }

.btn--new {
  background: var(--accent);
  color: #ffffff;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  margin-left: 4px;
}
.btn--new:hover { opacity: 0.88; }

.btn--primary {
  background: var(--accent);
  color: #ffffff;
  border-radius: 7px;
  padding: 7px 16px;
  font-size: 12.5px;
  font-weight: 600;
}
.btn--primary:hover { opacity: 0.88; }

.btn--secondary {
  background: var(--surface);
  color: var(--text-muted);
  border-radius: 7px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--border);
}
.btn--secondary:hover { color: var(--text); }

.btn--danger {
  background: var(--danger-light);
  color: var(--danger);
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid transparent;
}
.btn--danger:hover { border-color: var(--danger); }

/* ── Search bar ─────────────────────────────────────────── */
.search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg);
}
.search-icon { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--text);
}
.search-input::placeholder { color: var(--text-faint); }

/* ── Chips bar ──────────────────────────────────────────── */
.chips-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
  background: var(--bg-secondary);
}
.chips-bar::-webkit-scrollbar { display: none; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease;
  user-select: none;
  flex-shrink: 0;
}
.chip:hover { color: var(--text); background: var(--surface-hover); }
.chip.active { background: var(--accent); color: #ffffff; border-color: var(--accent); font-weight: 600; }

.chip--add { color: var(--text-faint); border-style: dashed; }
.chip--add:hover { color: var(--accent); border-color: var(--accent); background: var(--surface); }

/* ── Content area ───────────────────────────────────────── */
.content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* ── List view ──────────────────────────────────────────── */
.list-view { display: flex; flex-direction: column; height: 100%; }

.snippet-list {
  flex: 1;
  overflow-y: auto;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Snippet card ───────────────────────────────────────── */
.snippet-card {
  position: relative;
  background: var(--surface);
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  cursor: default;
  transition: background 0.1s ease;
}
.snippet-card:hover { background: var(--surface-hover); }

.snippet-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.snippet-card__shortcut {
  font-family: 'Courier New', Courier, monospace;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.snippet-card__category {
  font-size: 9px;
  color: var(--text-faint);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet-card__actions { display: flex; gap: 1px; flex-shrink: 0; }
.snippet-card__actions .btn--icon {
  padding: 2px 4px;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.1s ease;
}
.snippet-card:hover .snippet-card__actions .btn--icon { opacity: 1; }

.snippet-card__preview {
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

/* ── Hover tooltip ──────────────────────────────────────── */
.snippet-card__tooltip {
  display: none;
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  width: 190px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 10.5px;
  color: var(--text-muted);
  line-height: 1.55;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  word-break: break-word;
  pointer-events: none;
  white-space: pre-wrap;
}
.snippet-card:hover .snippet-card__tooltip { display: block; }

/* ── Empty state ────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text-faint);
  font-size: 11.5px;
  text-align: center;
  padding: 20px;
  line-height: 1.6;
}
.empty-state__icon { font-size: 28px; margin-bottom: 4px; }

/* ── Edit view ──────────────────────────────────────────── */
.edit-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.edit-title { font-size: 13px; font-weight: 600; }

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px 12px;
  flex: 1;
  overflow-y: auto;
}

.form-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-top: 4px;
}
.form-label:first-child { margin-top: 0; }

.form-input,
.form-textarea,
.form-select {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  padding: 7px 9px;
  outline: none;
  transition: border-color 0.15s ease;
  width: 100%;
}
.form-input:focus,
.form-textarea:focus,
.form-select:focus { border-color: var(--accent); }

.form-input--mono {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 600;
  font-size: 12px;
}

.form-textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
.form-select { cursor: pointer; }

.edit-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
.edit-actions .btn--primary { margin-left: auto; }

/* ── Scrollbars ─────────────────────────────────────────── */
::-webkit-scrollbar       { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-faint); }
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add popup.css
git commit -m "feat: add popup.css — chip layout, themes, card styles, tooltip"
```

---

## Task 4: popup.js — complete app logic

**Files:**
- Create: `C:\Users\serkan\textexpander-extension\popup.js`

- [ ] **Step 1: Write popup.js**

```js
/**
 * popup.js — TextExpander v1
 * Popup-only Chrome extension: save and manage text expansion shortcuts.
 * Data: chrome.storage.local (key: te_data)
 * State: in-memory, reloaded from storage on each popup open.
 */

// ── Constants ─────────────────────────────────────────────
const STORAGE_KEY        = 'te_data';
const COPY_FEEDBACK_MS   = 1200;
const SEARCH_DEBOUNCE_MS = 200;

/** Default categories seeded on first run */
const DEFAULT_CATEGORIES = [
  { id: 'cat_support',  name: 'Customer Support', emoji: '💬', color: '#6366f1' },
  { id: 'cat_email',    name: 'Email',            emoji: '📧', color: '#10b981' },
  { id: 'cat_social',   name: 'Social Media',     emoji: '📱', color: '#f59e0b' },
  { id: 'cat_personal', name: 'Personal',         emoji: '👤', color: '#ec4899' },
  { id: 'cat_other',    name: 'Other',            emoji: '📝', color: '#94a3b8' },
];

// ── App state ─────────────────────────────────────────────
const state = {
  data: {
    snippets:   [],
    categories: [],
    theme:      'light',
  },
  selectedCategoryId: null,   // null = show all
  searchQuery:        '',
  view:               'list', // 'list' | 'edit'
  editingSnippetId:   null,   // null = creating new snippet
};

// ── Utilities ─────────────────────────────────────────────
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Storage ───────────────────────────────────────────────
async function loadData() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  if (res[STORAGE_KEY]) {
    state.data = res[STORAGE_KEY];
    if (!state.data.theme) state.data.theme = 'light'; // migration guard
  } else {
    // First run — seed default categories, no snippets
    state.data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    await saveData();
  }
}

async function saveData() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.data });
}

// ── Theme ─────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Render: root ──────────────────────────────────────────
function render() {
  renderChips();
  if (state.view === 'list') {
    document.getElementById('listView').hidden = false;
    document.getElementById('editView').hidden = true;
    renderSnippetList();
  } else {
    document.getElementById('listView').hidden = true;
    document.getElementById('editView').hidden = false;
  }
}

// ── Render: chips ─────────────────────────────────────────
function renderChips() {
  const bar = document.getElementById('chipsBar');
  bar.innerHTML = '';

  // "All" chip
  const allChip = document.createElement('div');
  allChip.className = 'chip' + (state.selectedCategoryId === null ? ' active' : '');
  allChip.setAttribute('role', 'listitem');
  allChip.textContent = `All (${state.data.snippets.length})`;
  allChip.addEventListener('click', () => {
    state.selectedCategoryId = null;
    _clearSearch();
    render();
  });
  bar.appendChild(allChip);

  // Per-category chips
  state.data.categories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (state.selectedCategoryId === cat.id ? ' active' : '');
    chip.setAttribute('role', 'listitem');
    chip.innerHTML = `${escHtml(cat.emoji)} ${escHtml(cat.name)}`;
    chip.addEventListener('click', () => {
      state.selectedCategoryId = cat.id;
      _clearSearch();
      render();
    });
    chip.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm(`Delete "${cat.name}" category?\nSnippets will become uncategorized.`)) {
        state.data.snippets = state.data.snippets.map(s =>
          s.categoryId === cat.id ? { ...s, categoryId: null } : s
        );
        state.data.categories = state.data.categories.filter(c => c.id !== cat.id);
        if (state.selectedCategoryId === cat.id) state.selectedCategoryId = null;
        saveData();
        render();
      }
    });
    bar.appendChild(chip);
  });

  // "+" add category chip
  const addChip = document.createElement('div');
  addChip.className = 'chip chip--add';
  addChip.setAttribute('role', 'listitem');
  addChip.textContent = '+';
  addChip.addEventListener('click', () => _showAddCategoryInput(bar, addChip));
  bar.appendChild(addChip);
}

function _showAddCategoryInput(bar, addChip) {
  const input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Category name...';
  input.maxLength   = 24;
  input.autocomplete = 'off';
  input.style.cssText = [
    'font-family:inherit', 'font-size:10px', 'border:1px solid var(--accent)',
    'border-radius:20px', 'padding:3px 9px', 'outline:none',
    'background:var(--surface)', 'color:var(--text)', 'width:120px', 'flex-shrink:0',
  ].join(';');

  let committed = false;
  async function commit() {
    if (committed) return;
    committed = true;
    const name = input.value.trim();
    if (name) {
      state.data.categories.push({ id: uid(), name, emoji: '📁', color: '#6366f1' });
      await saveData();
    }
    render();
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter')  { await commit(); }
    if (e.key === 'Escape') { render(); }
  });
  input.addEventListener('blur', commit);

  bar.replaceChild(input, addChip);
  input.focus();
}

function _clearSearch() {
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
}

// ── Render: snippet list ───────────────────────────────────
function getFilteredSnippets() {
  let snippets = [...state.data.snippets];

  if (state.selectedCategoryId !== null) {
    snippets = snippets.filter(s => s.categoryId === state.selectedCategoryId);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    snippets = snippets.filter(s =>
      s.shortcut.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }

  return snippets.sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderSnippetList() {
  const list = document.getElementById('snippetList');
  list.innerHTML = '';
  const snippets = getFilteredSnippets();

  if (snippets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (state.searchQuery) {
      empty.innerHTML = `
        <div class="empty-state__icon">🔍</div>
        <div>No results for<br><strong>${escHtml(state.searchQuery)}</strong></div>
      `;
    } else {
      empty.innerHTML = `
        <div class="empty-state__icon">⚡</div>
        <div>No snippets yet.<br>Click <strong>+ New</strong> to add one.</div>
      `;
    }
    list.appendChild(empty);
    return;
  }

  snippets.forEach(snippet => {
    const cat         = state.data.categories.find(c => c.id === snippet.categoryId) ?? null;
    const borderColor = cat ? cat.color : '#94a3b8';
    const tooltipText = snippet.content.slice(0, 200) + (snippet.content.length > 200 ? '…' : '');
    const catLabel    = cat ? `${escHtml(cat.emoji)} ${escHtml(cat.name)}` : '';

    // Shortcut badge style: tinted background from category color
    const shortcutBg   = cat ? `${cat.color}22` : 'var(--accent-light)';
    const shortcutColor = cat ? cat.color : 'var(--accent)';

    const card = document.createElement('div');
    card.className = 'snippet-card';
    card.style.borderLeftColor = borderColor;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="snippet-card__header">
        <span class="snippet-card__shortcut" style="background:${shortcutBg};color:${shortcutColor};">${escHtml(snippet.shortcut)}</span>
        <span class="snippet-card__category">${catLabel}</span>
        <div class="snippet-card__actions">
          <button class="btn btn--icon js-edit" title="Edit"  aria-label="Edit snippet">✏️</button>
          <button class="btn btn--icon js-copy" title="Copy"  aria-label="Copy snippet">📋</button>
        </div>
      </div>
      <div class="snippet-card__preview">${escHtml(snippet.content)}</div>
      <div class="snippet-card__tooltip">${escHtml(tooltipText)}</div>
    `;

    card.querySelector('.js-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditForm(snippet.id);
    });

    card.querySelector('.js-copy').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(snippet.content);
        const btn = card.querySelector('.js-copy');
        btn.textContent = '✓';
        btn.style.color = '#10b981';
        setTimeout(() => { btn.textContent = '📋'; btn.style.color = ''; }, COPY_FEEDBACK_MS);
      } catch { /* clipboard unavailable — silent fail */ }
    });

    list.appendChild(card);
  });
}

// ── Edit form ─────────────────────────────────────────────
function openEditForm(snippetId) {
  state.view             = 'edit';
  state.editingSnippetId = snippetId ?? null;

  const snippet = snippetId ? state.data.snippets.find(s => s.id === snippetId) : null;

  document.getElementById('editTitle').textContent        = snippetId ? 'Edit Snippet' : 'New Snippet';
  document.getElementById('shortcutInput').value          = snippet?.shortcut ?? '';
  document.getElementById('contentInput').value           = snippet?.content  ?? '';
  document.getElementById('deleteSnippetBtn').hidden      = !snippetId;

  // Populate category select
  const sel = document.getElementById('categorySelect');
  sel.innerHTML = '<option value="">No Category</option>';
  state.data.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    if (snippet?.categoryId === cat.id) opt.selected = true;
    sel.appendChild(opt);
  });

  document.getElementById('listView').hidden = true;
  document.getElementById('editView').hidden = false;
  setTimeout(() => document.getElementById('shortcutInput').focus(), 50);
}

function closeEditForm() {
  state.view             = 'list';
  state.editingSnippetId = null;
  render();
}

async function saveSnippet() {
  let shortcut  = document.getElementById('shortcutInput').value.trim();
  const content = document.getElementById('contentInput').value.trim();
  const catId   = document.getElementById('categorySelect').value || null;

  if (!shortcut) {
    document.getElementById('shortcutInput').focus();
    document.getElementById('shortcutInput').style.borderColor = 'var(--danger)';
    setTimeout(() => { document.getElementById('shortcutInput').style.borderColor = ''; }, 1500);
    return;
  }

  // Auto-prefix with /
  if (!shortcut.startsWith('/')) shortcut = '/' + shortcut;

  const now = Date.now();

  if (state.editingSnippetId) {
    const idx = state.data.snippets.findIndex(s => s.id === state.editingSnippetId);
    if (idx !== -1) {
      state.data.snippets[idx] = {
        ...state.data.snippets[idx],
        shortcut,
        content,
        categoryId: catId,
        updatedAt:  now,
      };
    }
  } else {
    state.data.snippets.unshift({
      id:         uid(),
      shortcut,
      content,
      categoryId: catId,
      createdAt:  now,
      updatedAt:  now,
    });
  }

  await saveData();
  closeEditForm();
}

async function deleteSnippet() {
  if (!state.editingSnippetId) return;
  const snippet = state.data.snippets.find(s => s.id === state.editingSnippetId);
  if (!snippet) return;
  if (!confirm(`Delete "${snippet.shortcut}"? This cannot be undone.`)) return;
  state.data.snippets = state.data.snippets.filter(s => s.id !== state.editingSnippetId);
  await saveData();
  closeEditForm();
}

// ── Import / Export ───────────────────────────────────────
function exportData() {
  const payload = JSON.stringify(
    { snippets: state.data.snippets, categories: state.data.categories },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'textexpander-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  try {
    const text   = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed.snippets) || !Array.isArray(parsed.categories)) {
      alert('Invalid file format. Expected { snippets: [], categories: [] }.');
      return;
    }

    const existingSnippetIds  = new Set(state.data.snippets.map(s => s.id));
    const existingCategoryIds = new Set(state.data.categories.map(c => c.id));
    let addedSnippets = 0, addedCategories = 0;

    parsed.categories.forEach(c => {
      if (!existingCategoryIds.has(c.id)) { state.data.categories.push(c); addedCategories++; }
    });
    parsed.snippets.forEach(s => {
      if (!existingSnippetIds.has(s.id)) { state.data.snippets.push(s); addedSnippets++; }
    });

    await saveData();
    render();

    if (addedSnippets === 0 && addedCategories === 0) {
      alert('Nothing new to import — all items already exist.');
    }
  } catch {
    alert('Failed to import: file is not valid JSON or has an unexpected format.');
  }
}

// ── Event binding ─────────────────────────────────────────
function bindEvents() {
  document.getElementById('themeToggle').addEventListener('click', async () => {
    state.data.theme = state.data.theme === 'light' ? 'dark' : 'light';
    applyTheme(state.data.theme);
    await saveData();
  });

  document.getElementById('newSnippetBtn').addEventListener('click', () => openEditForm(null));

  document.getElementById('saveSnippetBtn').addEventListener('click', saveSnippet);
  document.getElementById('cancelBtn').addEventListener('click',  closeEditForm);
  document.getElementById('cancelBtn2').addEventListener('click', closeEditForm);
  document.getElementById('deleteSnippetBtn').addEventListener('click', deleteSnippet);

  const debouncedSearch = debounce((q) => {
    state.searchQuery = q;
    renderSnippetList();
  }, SEARCH_DEBOUNCE_MS);
  document.getElementById('searchInput').addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  applyTheme(state.data.theme);
  render();
  bindEvents();
});
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add popup.js
git commit -m "feat: add popup.js — CRUD, search, copy, chips, import/export, themes"
```

---

## Task 5: content.js — auto-expansion logic

**Files:**
- Create: `C:\Users\serkan\textexpander-extension\content.js`

- [ ] **Step 1: Write content.js**

```js
/**
 * content.js — TextExpander v1
 * Runs on all pages (matches: <all_urls>).
 * Listens for Space keypress in any text field.
 * When the last word typed matches a saved shortcut, expands it inline.
 */

/** Map<shortcut_lowercase, content> — rebuilt whenever storage changes */
let snippetMap = new Map();

// ── Storage ───────────────────────────────────────────────
async function loadSnippets() {
  const res = await chrome.storage.local.get('te_data');
  buildMap(res['te_data']?.snippets ?? []);
}

function buildMap(snippets) {
  snippetMap = new Map(snippets.map(s => [s.shortcut.toLowerCase(), s.content]));
}

/** Rebuild map instantly when popup saves changes */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['te_data']) {
    buildMap(changes['te_data'].newValue?.snippets ?? []);
  }
});

// ── Cursor helpers ────────────────────────────────────────
/** Returns text before cursor for input/textarea or contenteditable */
function getTextBeforeCursor(el) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return el.value.substring(0, el.selectionStart ?? el.value.length);
  }
  // contenteditable
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  range.setStart(el, 0);
  return range.toString();
}

/** Extract last non-space word before cursor (e.g. "/hello") */
function getLastWord(text) {
  const match = text.match(/(\S+)$/);
  return match ? match[1] : '';
}

// ── Expansion ─────────────────────────────────────────────
/**
 * Replace the shortcut with expanded content + trailing space.
 * Uses execCommand so undo history works and React/Vue synthetic events fire.
 */
function expand(el, shortcut, content) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart ?? el.value.length;
    // Select the shortcut text so execCommand replaces it
    el.setSelectionRange(start - shortcut.length, start);
    document.execCommand('insertText', false, content + ' ');
  } else {
    // contenteditable — use Selection API to select last word
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Move start back by shortcut.length characters
    const node   = range.startContainer;
    const offset = range.startOffset;
    if (node.nodeType === Node.TEXT_NODE && offset >= shortcut.length) {
      range.setStart(node, offset - shortcut.length);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand('insertText', false, content + ' ');
  }
}

// ── Keydown handler ───────────────────────────────────────
function onKeyDown(e) {
  // Only act on Space, no modifier keys
  if (e.key !== ' ') return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

  const el = document.activeElement;
  if (!el) return;

  const tag        = el.tagName;
  const isInput    = tag === 'INPUT' || tag === 'TEXTAREA';
  const isEditable = el.isContentEditable;
  if (!isInput && !isEditable) return;

  // Skip non-text input types (number, checkbox, etc.)
  if (isInput && tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    if (!['text', 'search', 'url', 'email', ''].includes(type)) return;
  }

  const textBefore = getTextBeforeCursor(el);
  const lastWord   = getLastWord(textBefore);

  // Only try expansion if word starts with /
  if (!lastWord.startsWith('/')) return;

  const content = snippetMap.get(lastWord.toLowerCase());
  if (!content) return;

  // Match found — prevent the Space from being typed, expand instead
  e.preventDefault();
  expand(el, lastWord, content);
}

// ── MutationObserver (SPAs) ───────────────────────────────
/**
 * MutationObserver watches for new nodes. No per-element setup needed
 * because onKeyDown uses document.activeElement (captures any element).
 * The observer exists to future-proof against edge cases in lazy-loaded iframes.
 */
function observeDOM() {
  new MutationObserver(() => {
    // No-op — keydown on document (capture phase) catches all elements.
    // Observer kept for structural completeness and future extension.
  }).observe(document.body, { childList: true, subtree: true });
}

// ── Boot ──────────────────────────────────────────────────
loadSnippets();
document.addEventListener('keydown', onKeyDown, true); // capture phase catches all fields

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeDOM);
} else {
  observeDOM();
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add content.js
git commit -m "feat: add content.js — Space-triggered expansion, execCommand, storage sync"
```

---

## Task 6: Load in Chrome, verify, and package

**No new files — manual verification + packaging.**

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `C:\Users\serkan\textexpander-extension`
5. Extension appears with indigo lightning bolt icon

- [ ] **Step 2: Smoke test checklist**

| Action | Expected |
|--------|---------|
| Click extension icon | 380×520px popup, chips: All + 5 default categories |
| Click **+ New** | Edit form opens with shortcut/content/category fields |
| Type `/hello` in shortcut, fill content, click **Save** | Returns to list, card appears with `/hello` badge |
| Open any website (e.g. google.com search bar), type `/hello ` | Text expands to saved content |
| Hover over a snippet card | Tooltip shows first 200 chars to the right |
| Click 📋 copy button | Button briefly shows ✓ in green |
| Click ✏️ edit button | Edit form opens pre-filled |
| Delete via edit form | Confirm dialog, then card disappears |
| Right-click a category chip | Confirm dialog for deletion |
| Click **+** chip at end of chips bar | Inline input appears, Enter saves new category |
| Type in search box | List filters in real-time |
| Click 🌙 theme toggle | Dark mode applied, persists on reopen |
| Export (↓) button | JSON file downloaded as `textexpander-export.json` |
| Import (↑) button | File picker opens, select JSON, snippets merge |
| Press `Alt+Shift+T` | Popup opens (configure at `chrome://extensions/shortcuts`) |

- [ ] **Step 3: Package as zip**

```bash
cd /c/Users/serkan/textexpander-extension
powershell -Command "Compress-Archive -Path manifest.json, popup.html, popup.css, popup.js, content.js, icons -DestinationPath ../textexpander-v1.zip -Force"
echo "Packaged: C:\Users\serkan\textexpander-v1.zip"
```

- [ ] **Step 4: Final commit**

```bash
cd /c/Users/serkan/textexpander-extension
git add -A
git status
git commit -m "chore: project complete — TextExpander v1.0.0" 2>/dev/null || echo "Nothing to commit — already clean"
```
