# FocusTimer Chrome Extension — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

FocusTimer is a standalone Chrome extension implementing the Pomodoro technique. It provides a popup-based timer with work/break modes, a circular progress ring, desktop notifications, session tracking, optional tick sound, and dark/light mode. It is a separate project from QuickNote.

---

## Architecture

**Type:** Popup-only, Manifest V3. No background service worker.

The timer runs via `setInterval` in `popup.js`. All runtime state lives in memory; closing the popup pauses/resets the timer. Only user preferences (theme, sound toggle) are persisted to `chrome.storage.local`.

**Permissions:** `notifications`, `storage`

---

## File Structure

```
focustimer-extension/
├── manifest.json       — MV3 manifest, permissions, popup config
├── popup.html          — Shell, SVG ring, button structure
├── popup.css           — CSS variables, themes, ring animation, layout
├── popup.js            — All logic: timer, audio, notifications, state
└── icons/
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

---

## UI Layout

**Popup size:** 350×480px

```
┌─────────────────────────────┐
│  🍅 FocusTimer    [🌙] [🔔] │  toolbar: brand + theme toggle + sound toggle
├─────────────────────────────┤
│  [ Work ] [Short] [Long ]   │  mode tabs
│                             │
│       ╭───────────╮         │
│      ╱  25:00      ╲        │  SVG circular progress ring
│     │   WORK        │       │  red = work, green = break
│      ╲             ╱        │
│       ╰───────────╯         │
│                             │
│   [▶ Start] [↺ Reset]       │  controls
│                             │
│   🍅🍅🍅🍅  Session: 4      │  session dots + count
└─────────────────────────────┘
```

---

## Timer Modes

| Mode | Duration | Color |
|------|----------|-------|
| Work | 25 minutes | Red (`#ef4444`) |
| Short Break | 5 minutes | Green (`#22c55e`) |
| Long Break | 15 minutes | Green (`#22c55e`) |

Switching modes resets the current timer. Mode tabs are disabled while timer is running (prevent accidental switches).

---

## Components

### Progress Ring (SVG)
- `<circle>` element with `stroke-dasharray` = circumference
- `stroke-dashoffset` animated as time decreases from full → 0
- Smooth CSS `transition: stroke-dashoffset 1s linear`
- Ring color switches via CSS variable driven by current mode

### Timer Display
- Large `MM:SS` format centered inside the ring
- Mode label below time (`WORK` / `SHORT BREAK` / `LONG BREAK`)

### Controls
- **Start/Pause** — single button, label toggles
- **Reset** — resets timeLeft to mode duration, stops interval

### Session Counter
- Increments when a Work session completes naturally (not via reset)
- Displayed as emoji dots (🍅) up to 4, then repeats + numeric count
- Resets on page reload (session-scoped, not persisted)

### Sound
- Web Audio API `AudioContext` — no audio files required
- Tick: short 1kHz oscillator pulse every second while running
- End chime: ascending 3-note sequence on timer completion
- Toggled via toolbar button, preference saved to `chrome.storage.local`

### Notifications
- `chrome.notifications.create()` on timer completion
- Title: "FocusTimer", message varies by completed mode
- Icon: `icons/icon128.svg`

### Theme
- CSS custom properties on `[data-theme]` attribute
- Light: white background, subtle shadows
- Dark: deep gray (`#111827`) background
- Preference saved to `chrome.storage.local`

---

## State Model

```js
{
  mode: 'work' | 'short' | 'long',
  timeLeft: number,        // seconds remaining
  isRunning: boolean,
  sessions: number,        // pomodoros completed this session
  intervalId: number|null,
  // preferences (persisted):
  theme: 'light' | 'dark',
  soundEnabled: boolean,
}
```

---

## Data Flow

1. User clicks Start → `setInterval(tick, 1000)` begins
2. Each tick: `timeLeft--`, update ring + display, optionally play tick sound
3. `timeLeft === 0`: clear interval, fire notification, play chime, increment sessions if work mode, show completion state
4. User clicks Pause: clear interval, `isRunning = false`
5. User clicks Reset: clear interval, `timeLeft = modeDuration[mode]`, reset ring
6. Mode tab click (when not running): set mode, reset timeLeft, update ring color

---

## Tech Stack

- Vanilla JS ES2020, no dependencies
- SVG for progress ring
- Web Audio API for sound (no external files)
- `chrome.notifications` for desktop alerts
- `chrome.storage.local` for preferences
- CSS custom properties for theming
- Manifest V3

---

## Out of Scope

- Timer continuing when popup is closed (popup-only by design)
- Custom timer durations
- Task/todo list integration
- Statistics or history persistence
- Auto-start next session
