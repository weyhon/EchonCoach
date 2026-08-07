# Adversarial Review — 2026-08-07

Three adversarial reviewers (services / React UI / API+config) plus 10 live browser
attacks. Every finding below was independently verified by reading the code or by
reproducing it against the running app before any fix was written.

## Verified and fixed

| # | Severity | Area | Finding | Evidence | Commit |
|---|----------|------|---------|----------|--------|
| 1 | Critical | App.tsx | Double-click Record starts a 2nd MediaRecorder before `getUserMedia` resolves. Both share `mediaRecorderRef`/`audioChunksRef`; recorder #1's `onstop` clears recorder #2's silence timer and hides the Stop button. Mic stays live with no UI control until reload. | Code read: `startRecording` had no re-entry guard | b8bb665 |
| 2 | Critical | App.tsx | History entries stayed clickable during RECORDING. Selecting one hijacks `appState` while the recorder runs on; its `onstop` later overwrites whatever the user moved on to. | Code read: `onQuickAnalyze`/`onQuickRecord`/`onSelect` had no recording guard | b8bb665 |
| 3 | Critical | azureSpeechService | The Azure REST call had no `AbortController` — alone among the codebase's network calls. A stalled regional endpoint means `fetch` never settles, the Gemini fallback never sees an error, and the user sits on "Analyzing…" forever. | Code read: bare `await fetch(apiUrl, ...)` | b8bb665 |
| 4 | Critical | api/*.ts | All five paid endpoints accepted anonymous requests from any origin: an open, unmetered AI service billed to this project's keys. | `curl` with no Origin returned 200 + real Gemini output from production | 1c862a1 → 7ccdfdc |
| 5 | Major | api/speech-token | Origin gate had two holes: a missing Origin skipped the check (`origin && ...`), and `origin.includes(host)` accepted `https://echon-coach.vercel.app.evil.com`. Inert only because `AZURE_SPEECH_KEY` is unset in prod. | Both bypasses confirmed by curl against production | 7ccdfdc |
| 6 | Major | App.tsx | Play Reference re-enabled before its own fetches settled — every extra click fired another TTS + linking pair. | Measured in browser: 3 clicks → 6 requests; reproduced Gemini 429 (10/min TTS quota) | b8bb665 |
| 7 | Major | geminiService | `analyzePronunciation` direct mode did a bare `JSON.parse`; a truncated model response surfaced a raw parser error to the user. | Code read: no try/catch, unlike its two siblings | b8bb665 |

Verification after fixes (production): same-origin 200 / anonymous 403 / spoofed-origin
403 on linking, define, tts; oversized input 400; 3 rapid clicks now issue 2 requests.

## Self-inflicted regression (found, reverted, fixed)

The guard commit took production down: `package.json` has `"type": "module"`, so Node
requires a file extension on relative imports at runtime. `import { guard } from
'./_guard'` satisfied `tsc` (moduleResolution "Node") and `vite build`, then threw
`ERR_MODULE_NOT_FOUND` on every invocation.

Handled as: revert to restore service → reproduce locally → fix → verify locally → ship.
`scripts/check-api-esm.mjs` now transpiles each endpoint the way Vercel does and imports
it; wired into `npm run check`, and verified to fail when the extension is removed.

## Held up under attack (no action)

- Empty input: play button correctly disabled
- 2000-character input: no overflow, degrades to local fallback
- Corrupted and malformed `localStorage`: app renders, warning logged, no crash
- Space / R keypresses while typing in the textarea: no false triggers
- Rapid clicks across 4 different words: exactly one popover, race guard holds
- Unmount during a pending word lookup: no crash, no orphaned popover

## Also fixed (2026-08-07, same session)

| Severity | Finding | Fix |
|----------|---------|-----|
| Minor | Non-English input rendered the source characters where the IPA belongs (`/'今天天气真好…/`), reading as a transcription rather than a failure | `services/scriptUtils.ts` detects non-Latin scripts; a quiet ENGLISH ONLY note replaces the idle hint. Verified live on production. |

## Open, not fixed

| Severity | Finding | Why deferred |
|----------|---------|--------------|
| Minor | `proxyPost` decides "don't retry 4xx" by regex-matching digits in the error message instead of the status code it already has; a 400 whose body has no digits gets retried twice (~3s dead time) | Real but low impact |
| Minor | Two "play my recording" controls can both create blob URLs on near-simultaneous clicks, leaking the first | Requires clicking two controls within one render |
| Minor | Per-IP rate limit is per serverless instance, so it throttles a naive script rather than a determined one | Documented in `api/_guard.ts`; a real limit needs Vercel WAF or Upstash |
