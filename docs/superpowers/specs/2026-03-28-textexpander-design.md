# TextExpander Chrome Extension — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

TextExpander is a standalone Chrome extension for saving custom text shortcuts that auto-expand in any text field on any website. Type `/hello` followed by Space and it expands to your full greeting. Features a popup UI for managing snippets (add, edit, delete), category filtering via chips, full-text search, one-click copy, hover preview, JSON import/export, dark/light mode, and a keyboard shortcut to open.

---

## Architecture

**Type:** Popup + Content Script, Manifest V3. No background service worker.

All snippets and categories are persisted to `chrome.storage.local`. Theme preference is also persisted. The popup is the management UI surface. `content.js` runs on every page and handles auto-expansion.

**Permissions:** `storage`, `clipboardWrite`

---

## File Structure

```
textexpander-extension/
├── manifest.json       — MV3 config, permissions, content_scripts, Alt+Shift+T command
├── popup.html          — Shell: toolbar, category chips, snippet list, edit form
├── popup.css           — CSS variables, themes, layout, chip styles, card styles
├── popup.js            — All logic: CRUD, search, copy, import/export, render
├── content.js          — Keydown listener, expansion logic, MutationObserver
└── icons/
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

---

## UI Layout

**Popup size:** 380×520px

```
┌─────────────────────────────────────────────┐
│  ⚡ TextExpander    [↓] [↑] [🌙]  [+ New]  │  toolbar: brand + export + import + theme + new
├─────────────────────────────────────────────┤
│  🔍 Search shortcuts...                     │  search bar (full width)
├─────────────────────────────────────────────┤
│  [All(18)] [💬 Support] [📧 Email] [📱 …]  │  category chips (scrollable)
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ [/hello]  💬 Support          ✏️  📋 │  │  ← snippet card
│  │ Hi there! Thank you for reaching...   │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ [/thanks] 📧 Email            ✏️  📋 │  │
│  │ Thank you for your email. I'll get... │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Edit/Add state:** The area below the chips switches to an in-place form (shortcut input, content textarea, category select, save/cancel/delete).

---

## Data Model

```js
// Stored in chrome.storage.local under key 'te_data'
{
  snippets: [
    {
      id: string,           // crypto.randomUUID()
      shortcut: string,     // e.g. '/hello' — always starts with /
      content: string,      // expanded text
      categoryId: string | null,
      createdAt: number,    // timestamp
      updatedAt: number,
    }
  ],
  categories: [
    {
      id: string,
      name: string,
      emoji: string,        // e.g. '💬'
      color: string,        // hex accent color for card left border
    }
  ],
  theme: 'light' | 'dark',
}
```

Default categories created on first run:
- 💬 Customer Support — `#6366f1`
- 📧 Email — `#10b981`
- 📱 Social Media — `#f59e0b`
- 👤 Personal — `#ec4899`
- 📝 Other — `#94a3b8`

---

## Features

### Snippet List
- Snippet cards with: shortcut badge (monospace, category color), preview text (1 line truncated), category label, edit (✏️) and copy (📋) buttons
- **Hover tooltip:** CSS tooltip showing first 200 characters of expanded content
- **Copy:** `navigator.clipboard.writeText(content)`, copy button briefly shows "✓" feedback
- **Delete:** edit form has a delete button with confirm dialog
- Cards sorted by `updatedAt` descending

### Search
- Full-width input below toolbar, above chips
- Debounced (200ms), filters by shortcut + content (case-insensitive)
- "No results" empty state when search yields nothing

### Category Chips
- "All" chip at left (always shows total count)
- Each category chip: emoji + name
- Active chip highlighted with accent color
- Horizontally scrollable if overflow
- **Add category:** "+" chip at end → inline input → Enter to save
- **Delete category:** right-click on chip → confirm dialog → category deleted, snippets become uncategorized

### Add / Edit Form
- Triggered by "+ New" button (bottom-right) or ✏️ on a card
- Fields: shortcut (text input, required, must start with `/`, max 30 chars), content (textarea, 6 rows), category (select dropdown)
- Save button + Cancel button + Delete button (edit only)
- Auto-saves `updatedAt` on edit
- Validation: shortcut required, auto-prefixes `/` if not typed

### Import / Export
- **Export (↓):** serializes `{ snippets, categories }` to JSON → downloads as `textexpander-export.json`
- **Import (↑):** file input accepts `.json` → merges snippets and categories by id (no duplicates) → re-renders

### Keyboard Shortcut
- `Alt+Shift+T` opens the extension popup (defined in manifest `commands`)

### Theme
- CSS custom properties on `[data-theme]` attribute
- Light: white background, light gray surface
- Dark: `#0f172a` background, `#1e293b` surface
- Preference saved to `chrome.storage.local`

---

## State Model (popup)

```js
// In-memory app state (loaded from storage on boot)
{
  data: {
    snippets: [...],
    categories: [...],
    theme: 'light' | 'dark',
  },
  selectedCategoryId: null | string,  // null = "All"
  searchQuery: '',
  view: 'list' | 'edit',             // current panel view
  editingSnippetId: null | string,    // null = new snippet
}
```

---

## content.js — Auto-Expansion Logic

### Boot sequence
1. Load all snippets from `chrome.storage.local` → build `Map<shortcut, content>`
2. Listen to `chrome.storage.onChanged` → rebuild map when snippets change (popup edits apply instantly)
3. Attach `keydown` listener to `document`
4. Use `MutationObserver` on `document.body` to detect dynamically added input fields (SPAs, modals)

### Expansion flow (on Space keydown)
1. Check `document.activeElement` — must be `<input>`, `<textarea>`, or `contenteditable`
2. Get text before cursor
3. Extract last word (text after last space/newline)
4. If word does not start with `/` → do nothing, let Space through
5. Look up word in snippet Map
6. If found: call `document.execCommand('insertText', false, content + ' ')` which replaces the shortcut with expanded text + trailing space
7. If not found: let Space through normally

### Compatibility
- Native inputs/textareas: `execCommand` works reliably
- `contenteditable` elements (Gmail compose, Notion, Twitter/X): `execCommand` works
- React/Vue controlled inputs: `execCommand` triggers synthetic events correctly in modern browsers

---

## Tech Stack

- Vanilla JS ES2020, no dependencies
- `chrome.storage.local` for data persistence
- `navigator.clipboard.writeText()` for copy
- `document.execCommand('insertText')` for text expansion
- `MutationObserver` for dynamic field detection
- Blob API + `<a download>` for export
- `<input type="file">` for import
- CSS custom properties for theming
- Manifest V3

---

## Out of Scope

- Sync across devices (chrome.storage.sync)
- Rich text / HTML expansion
- Variable placeholders (e.g. `{{date}}`, `{{clipboard}}`)
- Expansion undo (Ctrl+Z after expansion)
- Site-specific snippet rules
