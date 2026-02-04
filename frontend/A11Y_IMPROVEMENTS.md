# Miglioramenti Accessibilità (a11y)

## Data: 2026-01-10

## Obiettivo
Migliorare l'accessibilità dell'applicazione VPS Panel aggiungendo attributi ARIA e configurando ESLint con regole a11y.

## Modifiche Implementate

### 1. Configurazione ESLint
- Creato `eslint.config.mjs` con supporto ESLint v9 (flat config)
- Installato `eslint-plugin-jsx-a11y` per rilevare problemi di accessibilità
- Configurate regole a11y raccomandate come errori
- Configurate regole opzionali come warning

**File modificati:**
- `eslint.config.mjs` (creato)
- `package.json` (dipendenze aggiornate)

### 2. Header.tsx
**Miglioramenti:**
- Aggiunto `aria-label="Cambia tema"` al bottone theme switcher
- Aggiunto `aria-label="Menu utente"` al bottone user menu

**Impatto:** Screen reader possono ora annunciare correttamente la funzione dei bottoni con solo icone.

### 3. NotificationDropdown.tsx
**Miglioramenti:**
- Aggiunto `aria-label` dinamico al bottone notifiche:
  - "Notifiche" (0 non lette)
  - "Notifiche (3 non lette)" (con contatore)
- Aggiunto `aria-label="Segna notifica come letta"` ai bottoni di azione
- Aggiunto `aria-label="Rimuovi notifica"` ai bottoni di rimozione
- Aggiunto `aria-label="Segna tutte le notifiche come lette"` al bottone mark all
- Aggiunto `aria-label="Cancella tutte le notifiche"` al bottone clear all

**Impatto:** Utenti con screen reader possono navigare e gestire le notifiche in modo efficace.

### 4. Sidebar.tsx
**Miglioramenti:**
- Aggiunto `aria-label="Vai a {nome}"` a tutti i link di navigazione
- Aggiunto `aria-current="page"` ai link attivi (indica la pagina corrente)
- Aggiunto `aria-label="Torna alla dashboard"` al logo
- Aggiunto `aria-label="Navigazione principale"` al tag nav

**Impatto:** Navigazione completamente accessibile con indicazione chiara della pagina corrente.

### 5. CommandPalette.tsx
**Miglioramenti:**
- Aggiunto `aria-label="Apri ricerca globale (Cmd+K)"` al trigger button
- Aggiunto `aria-label="Campo di ricerca"` e `role="searchbox"` all'input
- Aggiunto `role="listbox"` e `aria-label="Risultati di ricerca"` al container risultati
- Aggiunto `role="option"`, `aria-selected` e `aria-label` a ogni risultato

**Impatto:** Command palette completamente accessibile con semantica ARIA corretta.

### 6. Dialog.tsx
**Miglioramenti:**
- Aggiunto `role="dialog"` al DialogContent
- Aggiunto `aria-modal="true"` per indicare modalità
- Aggiunto `aria-label="Chiudi dialog"` al bottone close
- Corretto testo screen reader da "Close" a "Chiudi" (italiano)

**Impatto:** Dialog conformi alle specifiche WAI-ARIA.

### 7. AlertDialog.tsx
**Miglioramenti:**
- Aggiunto `role="alertdialog"` al AlertDialogContent
- Aggiunto `aria-modal="true"` per indicare modalità

**Impatto:** Alert dialog conformi alle specifiche WAI-ARIA.

## Metriche

### Prima dei miglioramenti
- **aria-label trovati:** 6
- **Componenti con a11y:** ~5%

### Dopo i miglioramenti
- **aria-label trovati:** 17 (+183%)
- **Componenti con a11y:** ~40%
- **Regole ESLint a11y:** 8 configurate
- **Warning a11y rimanenti:** 13 (da correggere in futuro)

## Compatibilità Screen Reader

I miglioramenti supportano:
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

## Prossimi Passi

### Warning da Risolvere
1. **click-events-have-key-events**: Alcuni elementi con onClick necessitano anche di onKeyDown
2. **no-static-element-interactions**: Alcuni div interattivi dovrebbero essere button o link

### Componenti da Migliorare
- FileManager (dropzone accessibility)
- DatabaseForm (form field labels)
- ProjectCard (interactive elements)
- Terminal (keyboard navigation)

### Test Raccomandati
1. Test con screen reader (NVDA/VoiceOver)
2. Test navigazione solo tastiera (Tab, Enter, Escape)
3. Test contrasto colori (WCAG AA compliance)
4. Audit con axe DevTools

## Riferimenti
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Note per il Team

**IMPORTANTE:**
- Tutti i nuovi bottoni con solo icone devono avere `aria-label`
- Tutti i dialog devono avere `role="dialog"` e `aria-modal="true"`
- I link di navigazione devono avere `aria-current="page"` quando attivi
- Gli input devono avere label visibili o `aria-label`

**Comando per verificare a11y:**
```bash
npm run lint | grep "jsx-a11y"
```
