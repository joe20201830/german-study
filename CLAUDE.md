# german-study

German reading comprehension practice app. Generates essays via Claude with vocabulary tooltips, inline translations, grammar notes, and comprehension questions.

## Running

```bash
cd german-study
node server.js
# → http://localhost:3002
```

## Architecture

Single-page app: `server.js` (raw Node.js HTTP server) + `index.html` (all CSS/JS inline, no framework).

### Server (`server.js`)

- **`POST /generate`** — accepts JSON `{ topic, difficulty, length }`, calls Claude, returns a single JSON response (not streamed).
- **`GET /*.png|jpg|gif|svg`** — serves static image files from the app directory (used for the Little My sprite).
- Model: `claude-sonnet-4-6`, max_tokens 8000.
- Claude is prompted to return JSON. Response is extracted via regex (`/```json.../``` → /```...```/ → /{...}/`), then validated with Zod (`EssayResponseSchema`).
- No thinking/streaming — synchronous request/response.

### Response schema (Zod-validated)

```
EssayResponseSchema {
  essay: string              — full German essay
  vocabulary: VocabWord[]    — 8-12 words with word, translation, type, gender_plural, example, b2_note
  questions: Question[]      — 3-5 comprehension Q&A pairs (German)
  grammar_notes: string[]    — 2-4 grammar constructions used in the essay
  translation: string        — full English translation
}
```

### Frontend (`index.html`)

**Controls:**
- Topic: 4 categories (environment, technology, politics, education)
- Difficulty: B1 / B2 Standard / B2 Schwer / C1
- Length: Kurz (200-300) / Mittel (400-500) / Lang (600-800) words

**Essay rendering:**
- Essay and translation split on `\n\n`, paired by paragraph index, rendered interleaved.
- Translation paragraphs hidden by default; toggled via `.show-translations` class on `.essay-card`.
- Vocabulary words: exact surface forms matched in essay text, wrapped in `<span class="vocab" data-word="...">` for hover/click tooltips.

**Other features:**
- Reading timer (click to pause/resume)
- Collapsible grammar notes section with term highlighting (bold + accent color for known grammar terms like Konjunktiv, Passiv, etc.)
- Comprehension questions with click-to-reveal answers
- Dark/light theme toggle (persisted in localStorage)
- **Word highlight:** select any text in the essay with the mouse → wraps selection in `<mark class="user-highlight">` (yellow background). Click the mark to remove it. Uses `range.surroundContents(mark)`; silently skips if selection crosses element boundaries.
- **Copy FAB:** fixed `⎘ Kopieren` button (top-right corner, `position: fixed`), hidden until the first essay is generated. Copies `currentEssayData.essay` plain text to clipboard. Flashes red on success.
- **Little My sprite:** pixel-art character (`little-my.png`) that runs back and forth along the top edge of the controls box. Implemented as a `position: absolute` wrapper inside `.controls`. On load, the image is drawn to a hidden canvas; white pixels (R/G/B > 230) are set to transparent via `getImageData`; the processed canvas is displayed. Movement driven by `requestAnimationFrame`; direction flip via `scaleX(-1)` on the wrapper. Walk animation: 2-frame stepped bob (`steps(1, end) infinite alternate`, 0.22s per frame).

- **Text-to-speech:** per-paragraph TTS buttons using `speechSynthesis` with German voice, rate 0.9.
- **Progression stats:** tracks essays generated per topic × difficulty in `localStorage`. Collapsible section with summary + grid view, clearable.

### Design — "Storybook Editorial"

- **Fonts:** Fraunces (headings, optical size variable), Lora (essay body, serif), Outfit (UI elements, sans-serif) via Google Fonts.
- **Colors:** OKLCH warm palette — cream background `oklch(97% 0.015 75)`, editorial red accent `oklch(42% 0.16 28)`, full dark mode via `[data-theme="dark"]` CSS custom properties.
- **Layout:** single-column, max-width 780px, `.controls` has `border-top: 3px solid var(--accent)`.
- **Accessibility:** `:focus-visible` outlines on all interactive elements, `prefers-reduced-motion` support.
- **Responsive:** mobile breakpoint at 600px — stacked controls, tighter stats grid, hidden copy FAB (inline copy button remains).

## Dependencies

- `@anthropic-ai/sdk` — Claude API
- `zod` — response validation
- `dotenv` — env vars

## Env vars

- `ANTHROPIC_API_KEY` — required

## Deployment

- GitHub repo: `joe20201830/german-study` (branch: `main`)
- Deployed on Railway — auto-deploys on push to `main`
