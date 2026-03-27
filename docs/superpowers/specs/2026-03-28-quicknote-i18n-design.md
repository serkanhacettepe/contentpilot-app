# QuickNote i18n — Design Spec

**Date:** 2026-03-28
**Status:** Approved

---

## Overview

Add 5-language support (EN, TR, ES, DE, FR) to QuickNote v2 via an inline `TRANSLATIONS` object in `popup.js`. Users select language from a dropdown in the toolbar. Preference is persisted to `chrome.storage.local`.

---

## Languages

| Code | Language |
|------|----------|
| `en` | English (default) |
| `tr` | Türkçe |
| `es` | Español |
| `de` | Deutsch |
| `fr` | Français |

---

## File Changes

| File | Change |
|------|--------|
| `popup.html` | Add `<select id="langSelect">` to toolbar; move all static Turkish text to JS-controlled |
| `popup.js` | Add `TRANSLATIONS` object, `t(key)` helper, `appData.lang`, `applyLang()`, langSelect event |

---

## Data Model Change

`qn_data` gains one new field:

```ts
interface QNData {
  // ... existing fields ...
  lang: 'en' | 'tr' | 'es' | 'de' | 'fr'; // default: 'en'
}
```

`defaultData()` updated: `lang: 'en'`.

---

## TRANSLATIONS Object

All 25 UI strings extracted into a single object:

```js
const TRANSLATIONS = {
  en: {
    newNote:          '+ New Note',
    newFolder:        '+ Folder',
    search:           'Search...',
    folderPlaceholder:'📂 No Folder',
    allNotes:         '📋 All Notes',
    untitled:         'Untitled',
    noResults:        'No results',
    titlePlaceholder: 'Title...',
    contentPlaceholder:'Write your note here...',
    folderNamePlaceholder: 'Folder name...',
    chars:            (n) => n === 1 ? '1 character' : `${n} characters`,
    today:            'Today',
    yesterday:        'Yesterday',
    daysAgo:          (n) => `${n} days ago`,
    copy:             'Copy',
    copied:           'Copied!',
    pdf:              'PDF',
    txt:              'TXT',
    reminderAdd:      'Add reminder',
    reminderSet:      (d) => `Reminder: ${d}`,
    reminderSave:     'Save',
    reminderCancel:   'Cancel',
    confirmDeleteNote:'Are you sure you want to delete this note?',
    confirmDeleteFolder: (name) => `Delete "${name}" folder? (Notes are kept)`,
    confirmCancelReminder: 'Cancel the reminder?',
    reminderPastError:'Please select a future time.',
    deleteNote:       '🗑',
  },
  tr: {
    newNote:          '+ Yeni Not',
    newFolder:        '+ Klasör',
    search:           'Ara...',
    folderPlaceholder:'📂 Klasörsüz',
    allNotes:         '📋 Tüm Notlar',
    untitled:         'Başlıksız',
    noResults:        'Sonuç yok',
    titlePlaceholder: 'Başlık...',
    contentPlaceholder:'Notunu buraya yaz...',
    folderNamePlaceholder: 'Klasör adı...',
    chars:            (n) => n === 1 ? '1 karakter' : `${n} karakter`,
    today:            'Bugün',
    yesterday:        'Dün',
    daysAgo:          (n) => `${n} gün önce`,
    copy:             'Kopyala',
    copied:           'Kopyalandı!',
    pdf:              'PDF',
    txt:              'TXT',
    reminderAdd:      'Hatırlatıcı ekle',
    reminderSet:      (d) => `Hatırlatıcı: ${d}`,
    reminderSave:     'Kaydet',
    reminderCancel:   'İptal',
    confirmDeleteNote:'Bu notu silmek istediğine emin misin?',
    confirmDeleteFolder: (name) => `"${name}" klasörünü sil? (Notlar korunur)`,
    confirmCancelReminder: 'Hatırlatıcıyı iptal etmek istiyor musun?',
    reminderPastError:'Lütfen gelecekte bir zaman seç.',
    deleteNote:       '🗑',
  },
  es: {
    newNote:          '+ Nueva Nota',
    newFolder:        '+ Carpeta',
    search:           'Buscar...',
    folderPlaceholder:'📂 Sin Carpeta',
    allNotes:         '📋 Todas las Notas',
    untitled:         'Sin título',
    noResults:        'Sin resultados',
    titlePlaceholder: 'Título...',
    contentPlaceholder:'Escribe tu nota aquí...',
    folderNamePlaceholder: 'Nombre de carpeta...',
    chars:            (n) => n === 1 ? '1 carácter' : `${n} caracteres`,
    today:            'Hoy',
    yesterday:        'Ayer',
    daysAgo:          (n) => `hace ${n} días`,
    copy:             'Copiar',
    copied:           '¡Copiado!',
    pdf:              'PDF',
    txt:              'TXT',
    reminderAdd:      'Agregar recordatorio',
    reminderSet:      (d) => `Recordatorio: ${d}`,
    reminderSave:     'Guardar',
    reminderCancel:   'Cancelar',
    confirmDeleteNote:'¿Seguro que quieres eliminar esta nota?',
    confirmDeleteFolder: (name) => `¿Eliminar carpeta "${name}"? (Las notas se conservan)`,
    confirmCancelReminder: '¿Cancelar el recordatorio?',
    reminderPastError:'Por favor selecciona una hora futura.',
    deleteNote:       '🗑',
  },
  de: {
    newNote:          '+ Neue Notiz',
    newFolder:        '+ Ordner',
    search:           'Suchen...',
    folderPlaceholder:'📂 Kein Ordner',
    allNotes:         '📋 Alle Notizen',
    untitled:         'Ohne Titel',
    noResults:        'Keine Ergebnisse',
    titlePlaceholder: 'Titel...',
    contentPlaceholder:'Schreibe deine Notiz hier...',
    folderNamePlaceholder: 'Ordnername...',
    chars:            (n) => n === 1 ? '1 Zeichen' : `${n} Zeichen`,
    today:            'Heute',
    yesterday:        'Gestern',
    daysAgo:          (n) => `vor ${n} Tagen`,
    copy:             'Kopieren',
    copied:           'Kopiert!',
    pdf:              'PDF',
    txt:              'TXT',
    reminderAdd:      'Erinnerung hinzufügen',
    reminderSet:      (d) => `Erinnerung: ${d}`,
    reminderSave:     'Speichern',
    reminderCancel:   'Abbrechen',
    confirmDeleteNote:'Möchtest du diese Notiz wirklich löschen?',
    confirmDeleteFolder: (name) => `Ordner "${name}" löschen? (Notizen bleiben erhalten)`,
    confirmCancelReminder: 'Erinnerung abbrechen?',
    reminderPastError:'Bitte wähle eine zukünftige Zeit.',
    deleteNote:       '🗑',
  },
  fr: {
    newNote:          '+ Nouvelle Note',
    newFolder:        '+ Dossier',
    search:           'Chercher...',
    folderPlaceholder:'📂 Sans Dossier',
    allNotes:         '📋 Toutes les Notes',
    untitled:         'Sans titre',
    noResults:        'Aucun résultat',
    titlePlaceholder: 'Titre...',
    contentPlaceholder:'Écris ta note ici...',
    folderNamePlaceholder: 'Nom du dossier...',
    chars:            (n) => n === 1 ? '1 caractère' : `${n} caractères`,
    today:            "Aujourd'hui",
    yesterday:        'Hier',
    daysAgo:          (n) => `il y a ${n} jours`,
    copy:             'Copier',
    copied:           'Copié !',
    pdf:              'PDF',
    txt:              'TXT',
    reminderAdd:      'Ajouter un rappel',
    reminderSet:      (d) => `Rappel : ${d}`,
    reminderSave:     'Enregistrer',
    reminderCancel:   'Annuler',
    confirmDeleteNote:'Veux-tu vraiment supprimer cette note ?',
    confirmDeleteFolder: (name) => `Supprimer le dossier "${name}" ? (Les notes sont conservées)`,
    confirmCancelReminder: 'Annuler le rappel ?',
    reminderPastError:'Veuillez sélectionner une heure future.',
    deleteNote:       '🗑',
  },
};
```

---

## `t(key)` Helper

```js
function t(key) {
  return TRANSLATIONS[appData.lang ?? 'en'][key];
}
```

For function-type values (chars, daysAgo, etc.), caller invokes them:
```js
t('chars')(5)       // "5 characters"
t('daysAgo')(3)     // "3 days ago"
t('reminderSet')(dateStr)
t('confirmDeleteFolder')(folderName)
```

---

## toolbar UI Change (popup.html)

Add `<select id="langSelect">` between brand and theme toggle:

```html
<select id="langSelect" class="lang-select" aria-label="Language">
  <option value="en">EN</option>
  <option value="tr">TR</option>
  <option value="es">ES</option>
  <option value="de">DE</option>
  <option value="fr">FR</option>
</select>
```

Static Turkish strings in popup.html (`placeholder`, `title`, button text) are replaced by JS-driven `applyLang()`.

---

## `applyLang()` Function

Called on init and every language change. Updates all static DOM text:

```js
function applyLang() {
  document.getElementById('newNoteBtn').textContent      = t('newNote');
  document.getElementById('searchInput').placeholder     = t('search');
  document.getElementById('noteTitle').placeholder       = t('titlePlaceholder');
  document.getElementById('noteContent').placeholder     = t('contentPlaceholder');
  document.getElementById('copyBtn').textContent         = t('copy');
  document.getElementById('exportPdfBtn').textContent    = t('pdf');
  document.getElementById('exportTxtBtn').textContent    = t('txt');
  document.getElementById('reminderSave').textContent    = t('reminderSave');
  document.getElementById('reminderCancel').textContent  = t('reminderCancel');
  // Sync langSelect value
  document.getElementById('langSelect').value = appData.lang;
}
```

---

## langSelect Event

```js
document.getElementById('langSelect').addEventListener('change', (e) => {
  appData.lang = e.target.value;
  saveData(appData);
  applyLang();
  render(); // re-renders note list (date strings, folder headers, etc.)
});
```

---

## popup.css Addition

```css
.lang-select {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-weak);
  border-radius: 7px;
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 6px;
  outline: none;
  cursor: pointer;
}

.lang-select option {
  background: #764ba2;
  color: white;
}
```

---

## `formatDate` Update

`formatDate()` uses `t()` for date strings:

```js
function formatDate(ts) {
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('yesterday');
  if (diffDays < 7)  return t('daysAgo')(diffDays);
  return new Date(ts).toLocaleDateString(
    appData.lang === 'tr' ? 'tr-TR' :
    appData.lang === 'es' ? 'es-ES' :
    appData.lang === 'de' ? 'de-DE' :
    appData.lang === 'fr' ? 'fr-FR' : 'en-US',
    { day: 'numeric', month: 'short' }
  );
}
```

---

## Non-goals

- Auto-detect browser language (user picks manually)
- Right-to-left languages
- Translating note content
- More than 5 languages
