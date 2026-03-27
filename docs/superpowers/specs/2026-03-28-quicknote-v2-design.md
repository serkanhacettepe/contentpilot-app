# QuickNote v2 — Full App Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

A premium Chrome extension for note-taking with glassmorphism design. Targets Etsy market as a paid digital product. Replaces the v1 single-note popup with a full multi-note, multi-folder application.

---

## Visual Design

- **Style:** Glassmorphism
- **Background:** `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` (day) / `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)` (night)
- **Glass surfaces:** `background: rgba(255,255,255,0.12)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(255,255,255,0.2)`
- **Dark mode glass:** `background: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.1)`
- **Font:** Inter (Google Fonts) or system-ui
- **Border radius:** 12px surfaces, 8px buttons
- **Transitions:** 0.2s ease on all color/bg changes

---

## Dimensions

- **Popup:** 500×480px (fixed)
- **Left panel:** 180px wide
- **Right panel:** flex-1

---

## File Structure

```
C:\Users\serkan\quicknote-extension\
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js        ← service worker for alarms + notifications
└── icons/
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

---

## manifest.json

- Manifest Version: 3
- Permissions: `["storage", "alarms", "notifications"]`
- Action: `default_popup: "popup.html"`
- Background: `{ "service_worker": "background.js" }`

---

## Data Model

Stored as a single object in `chrome.storage.local` under key `qn_data`:

```ts
interface QNData {
  folders: Folder[];
  notes: Note[];
  theme: 'light' | 'dark';
  selectedNoteId: string | null;
  selectedFolderId: string | null; // null = "All Notes"
}

interface Folder {
  id: string;       // crypto.randomUUID()
  name: string;
}

interface Note {
  id: string;       // crypto.randomUUID()
  title: string;    // default: "Yeni Not"
  content: string;
  folderId: string | null;
  createdAt: number; // Date.now()
  updatedAt: number;
  reminder: { time: number; alarmName: string } | null;
}
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: [✦ QuickNote]              [☀/🌙]        │  ← 44px
├──────────────────┬──────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL (editor)             │
│  180px           │  flex-1                           │
│                  │                                   │
│  [🔍 Ara...]     │  [Başlık input.................]  │
│  [+ Yeni Not]    │  [Klasör: dropdown ▼]             │
│                  │                                   │
│  Tüm Notlar      │  [                             ]  │
│  ─────────────   │  [  textarea (scrollable)      ]  │
│  📁 İş           │  [                             ]  │
│    • Toplantı ⏰  │  [                             ]  │
│    • Proje       │                                   │
│  📁 Kişisel      │  [0 chars] [PDF][TXT][Kopyala][🗑]│
│    • Alışveriş   │                                   │
└──────────────────┴──────────────────────────────────┘
```

---

## Features

### Multiple Notes
- "+ Yeni Not" butonu: yeni Note objesi oluşturur, storage'a kaydeder, editörde açar
- Not başlığı editörde düzenlenebilir (title input)
- Sol panelde tıklanan not editörde açılır
- Her değişiklik 300ms debounce ile otomatik kaydedilir

### Folder System
- Sol panelde klasör listesi — her klasör collapsible
- "Tüm Notlar" seçeneği (folderId: null olanlar dahil hepsi)
- Klasör ekle: sidebar altında "+ Klasör" butonu → inline name input
- Not'a klasör atama: editörde dropdown
- Klasör silme: klasör silinince içindeki notların folderId'si null olur (notlar silinmez)

### Search
- Sol panelin üstünde arama input
- `input` eventinde 200ms debounce
- Başlık + içerik aranır (case-insensitive)
- Sonuçlar klasör gruplaması olmadan düz liste gösterir
- Arama boşalınca normal klasör görünümüne döner

### Export
- **TXT:** `new Blob([content], {type: 'text/plain'})` + `URL.createObjectURL` + `<a download>` — dosya adı: `{title}.txt`
- **PDF:** `window.print()` — print CSS ile sadece editör içeriği yazdırılır, arka plan beyaz

### Reminders
- Editör sağ üstünde ⏰ buton
- Tıklayınca `<input type="datetime-local">` inline açılır
- Kaydet: `chrome.alarms.create(alarmName, { when: time })` — alarmName = `qn_{noteId}`
- `background.js` service worker: `chrome.alarms.onAlarm` → `chrome.notifications.create`
- Bildirim içeriği: not başlığı + ilk 50 karakter
- İptal: `chrome.alarms.clear(alarmName)`, note.reminder = null

### Theme Toggle
- Toolbar'da ☀️/🌙 buton
- `data-theme` attribute toggle on `<html>`
- CSS variables ile tüm renkler değişir
- Tercih storage'a kaydedilir

---

## popup.js — Sorumluluklar

```
storage.js mantığı (inline):
  - loadData() → chrome.storage.local.get
  - saveData(data) → chrome.storage.local.set (debounced 300ms)

render mantığı:
  - renderFolderList(data)
  - renderNoteList(folderId | 'all' | 'search', query)
  - renderEditor(note)

event handlers:
  - search input
  - new note / new folder
  - note select
  - title / content input (auto-save)
  - folder select (dropdown)
  - theme toggle
  - export PDF / TXT
  - reminder set / cancel
```

---

## background.js

```js
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm.name.startsWith('qn_')) return;
  const noteId = alarm.name.replace('qn_', '');
  // chrome.storage.local.get → find note → create notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.svg',
    title: 'QuickNote Hatırlatıcı',
    message: note.title
  });
});
```

---

## Non-goals

- Notlar arası bağlantı / link
- Markdown render
- Sync across devices
- Tag sistemi
- Not şablonları
