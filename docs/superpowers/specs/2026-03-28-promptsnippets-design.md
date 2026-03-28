# PromptSnippets Chrome Extension — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

PromptSnippets is a standalone Chrome extension for saving, organizing, and instantly copying AI prompts (ChatGPT, Claude, Gemini). It features a sidebar layout with category folders, full-text search, one-click copy, hover preview, edit/delete, JSON import/export, dark/light mode, and a keyboard shortcut to open.

---

## Architecture

**Type:** Popup-only, Manifest V3. No background service worker.

All prompts and categories are persisted to `chrome.storage.local`. Theme preference is also persisted. The popup is the sole UI surface. A `commands` entry in manifest.json enables `Alt+Shift+P` to open the popup.

**Permissions:** `storage`, `clipboardWrite`

---

## File Structure

```
promptsnippets-extension/
├── manifest.json       — MV3 config, permissions, keyboard command
├── popup.html          — Shell: toolbar, sidebar, main panel
├── popup.css           — CSS variables, themes, layout, card styles
├── popup.js            — All logic: CRUD, search, copy, import/export, render
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
│  💬 PromptSnippets            [🌙] [↓] [↑]  │  toolbar: brand + theme + export + import
├────────────┬────────────────────────────────┤
│ CATEGORIES │ 🔍 Search...        [+ New]    │
│            ├────────────────────────────────┤
│ All (24)   │ ┌──────────────────────────┐   │
│ ✍️ Writing │ │ Blog Post Outline    ✏️📋│   │  ← prompt card (hover shows preview)
│ 💻 Code    │ │ Create a detailed...     │   │
│ 📊 Data    │ │ ✍️ Writing              │   │
│ 🎨 Design  │ └──────────────────────────┘   │
│ 📧 Email   │ ┌──────────────────────────┐   │
│            │ │ Code Review Helper   ✏️📋│   │
│ + Folder   │ │ Review this code...      │   │
│            │ │ 💻 Code                  │   │
│            │ └──────────────────────────┘   │
└────────────┴────────────────────────────────┘
```

**Edit/Add state:** The right panel switches to an in-place form (title input, content textarea, category select, save/cancel). The sidebar remains visible.

---

## Data Model

```js
// Stored in chrome.storage.local under key 'ps_data'
{
  prompts: [
    {
      id: string,         // crypto.randomUUID()
      title: string,
      content: string,
      categoryId: string | null,
      createdAt: number,  // timestamp
      updatedAt: number,
    }
  ],
  categories: [
    {
      id: string,
      name: string,
      emoji: string,      // e.g. "✍️"
      color: string,      // hex accent color for card left border
    }
  ],
  // Persisted preferences
  theme: 'light' | 'dark',
}
```

Default categories created on first run: Writing (#6366f1), Code (#10b981), Data (#f59e0b), Design (#ec4899), Email (#3b82f6).

---

## Features

### Prompt List (right panel — list view)
- Prompt cards with: title, truncated content preview (1 line), category tag, edit (✏️) and copy (📋) buttons
- **Hover preview:** CSS tooltip showing first 200 characters of content
- **Copy:** `navigator.clipboard.writeText(content)`, copy button briefly shows "✓" feedback
- **Delete:** edit form has a delete button with confirm dialog
- Cards sorted by `updatedAt` descending (most recently edited first)

### Search
- Input at top of right panel
- Debounced (200ms), filters by title + content (case-insensitive)
- "No results" empty state when search yields nothing

### Categories (left sidebar)
- Fixed 110px width sidebar
- "All" item at top (always shows total count)
- Each category shows emoji + name + count
- Active category highlighted
- **Add folder:** "+ Folder" button at bottom → inline input → Enter to save
- **Delete folder:** right-click on category → confirm dialog → category deleted, prompts in it become uncategorized

### Add / Edit Form (right panel in-place)
- Triggered by "+ New" button or ✏️ on a card
- Fields: title (text input, required), content (textarea, 5 rows), category (select dropdown)
- Save button + Cancel button
- Auto-saves `updatedAt` on edit

### Import / Export
- **Export (↓):** serializes `{ prompts, categories }` to JSON → downloads as `promptsnippets-export.json`
- **Import (↑):** file input accepts `.json` → merges prompts and categories by id (no duplicates) → re-renders

### Keyboard Shortcut
- `Alt+Shift+P` opens the extension popup (defined in manifest `commands`)

### Theme
- CSS custom properties on `[data-theme]` attribute
- Light: white background, light gray surface
- Dark: `#0f172a` background, `#1e293b` surface
- Preference saved to `chrome.storage.local`

---

## State Model

```js
// In-memory app state (loaded from storage on boot)
{
  data: {
    prompts: [...],
    categories: [...],
    theme: 'light' | 'dark',
  },
  selectedCategoryId: null | string,  // null = "All"
  searchQuery: '',
  view: 'list' | 'edit',             // current right-panel view
  editingPromptId: null | string,     // null = new prompt
}
```

---

## Tech Stack

- Vanilla JS ES2020, no dependencies
- `chrome.storage.local` for data persistence
- `navigator.clipboard.writeText()` for copy
- Blob API + `<a download>` for export
- `<input type="file">` for import
- CSS custom properties for theming
- Manifest V3

---

## Out of Scope

- Sync across devices (chrome.storage.sync)
- Tag system (only categories/folders)
- Prompt usage statistics
- Cloud backup
- Context menu integration
