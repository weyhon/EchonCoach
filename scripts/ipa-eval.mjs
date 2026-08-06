#!/usr/bin/env node
/**
 * IPA Auto-Eval — autoresearch-style verification loop for the linking IPA.
 * Formula: Scope(prod /api/linking) + Metric(error-free rate) + Verify(rule
 * checker on the SAME post-processing users get) + Budget(runs × corpus).
 *
 * Success standard: error-free rate ≥ 98% (errors = displayed IPA violating
 * a deterministic correctness rule; app-fallback cases counted separately —
 * users then see rule-generated IPA, not the bad AI output).
 *
 * Usage: node scripts/ipa-eval.mjs [--runs 2] [--api https://echon-coach.vercel.app]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ARGS = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = ARGS.indexOf(name);
  return i >= 0 ? ARGS[i + 1] : dflt;
};
const RUNS = parseInt(arg('--runs', '2'), 10);
const API = arg('--api', 'https://echon-coach.vercel.app');

// ── Bundle the REAL post-processing (same code the app ships) ──────────
const bundlePath = join(ROOT, 'node_modules/.cache/ipa-eval-phonetic.mjs');
mkdirSync(dirname(bundlePath), { recursive: true });
execSync(
  `"${join(ROOT, 'node_modules/.bin/esbuild')}" "${join(ROOT, 'services/phoneticUtils.ts')}" --bundle --format=esm --platform=node --outfile="${bundlePath}"`,
  { stdio: 'pipe' }
);
const noisy = console.log;
console.log = () => {}; // fixCommonPhoneticErrors is chatty
const { fixCommonPhoneticErrors } = await import(bundlePath);
console.log = noisy;

const VOWELS = 'aeiouɑæɛɪʊʌɔəɜɝɚ';

// ── Correctness rules (deterministic, conservative) ────────────────────
const RULES = [
  {
    id: 'no-comma-or-secondary-stress',
    check: (p) => !/[,，、ˌ]/.test(p),
  },
  {
    id: 'single-primary-stress-per-word',
    // two ˈ with no syllable dot / space between = same word marked twice
    check: (p) => !/ˈ[^.\sˈ]*ˈ/.test(p),
  },
  {
    id: 'the-is-di-before-vowels',
    check: (p) => !new RegExp(`(^|[\\s.])ðə[\\s.]ˈ?[${VOWELS}]`).test(p),
  },
  {
    id: 'no-flap-after-obstruent',
    check: (p) => !/[fkpsʃθbgvzʒ]\.?ɾ/.test(p),
  },
  {
    id: 'all-keeps-its-l',
    check: (p, text) =>
      !/\ball\b/i.test(text) ||
      !new RegExp(`([\\s.ˈ])[ɔɑ](\\.ˈ?[${VOWELS}]|\\s|$)`).test(p),
  },
  {
    id: 'phonetic-present',
    check: (p) => p.length > 0 && !/analysis failed/i.test(p),
  },
];

// App-level validation (mismatch here → app uses its deterministic fallback,
// the AI output never reaches the user)
function appWouldFallback(text, parsed) {
  const wordCount = text.trim().split(/\s+/).length;
  const tokenCount = (parsed.intonationMap || '').trim().split(/\s+/).filter(Boolean).length;
  if (!parsed.fullLinkedSentence || !parsed.intonationMap || tokenCount !== wordCount) return true;
  const sentBlocks = parsed.fullLinkedSentence.trim().split(/\s+/).length;
  const phonBlocks = (parsed.fullLinkedPhonetic || '').trim().split(/\s+/).filter(Boolean).length;
  return phonBlocks > 0 && sentBlocks !== phonBlocks;
}

async function callLinking(text) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API}/api/linking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

// ── Run ────────────────────────────────────────────────────────────────
const corpus = JSON.parse(readFileSync(join(__dirname, 'ipa-corpus.json'), 'utf8'));
const sentences = Object.entries(corpus.groups).flatMap(([group, list]) =>
  list.map((text) => ({ group, text }))
);

const results = [];
let done = 0;
const total = sentences.length * RUNS;

for (let run = 1; run <= RUNS; run++) {
  // limit concurrency to 3 to stay friendly to serverless + Gemini quotas
  const queue = [...sentences];
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      let record = { run, ...item };
      try {
        const parsed = await callLinking(item.text);
        const raw = parsed.fullLinkedPhonetic || '';
        if (appWouldFallback(item.text, parsed)) {
          record.status = 'fallback';
          record.raw = raw;
        } else {
          console.log = () => {};
          const displayed = fixCommonPhoneticErrors(item.text, raw);
          console.log = noisy;
          const failed = RULES.filter((r) => !r.check(displayed, item.text)).map((r) => r.id);
          record.status = failed.length ? 'error' : 'pass';
          record.failedRules = failed;
          record.raw = raw;
          record.displayed = displayed;
        }
      } catch (e) {
        record.status = 'network';
        record.error = String(e.message || e);
      }
      results.push(record);
      done++;
      if (done % 10 === 0) noisy(`  progress: ${done}/${total}`);
    }
  });
  await Promise.all(workers);
}

// ── Report ─────────────────────────────────────────────────────────────
const evaluated = results.filter((r) => r.status !== 'network');
const passes = evaluated.filter((r) => r.status === 'pass').length;
const fallbacks = evaluated.filter((r) => r.status === 'fallback').length;
const errors = evaluated.filter((r) => r.status === 'error');
const rate = ((evaluated.length - errors.length) / evaluated.length) * 100;

const report = {
  timestamp: new Date().toISOString(),
  api: API,
  runs: RUNS,
  corpus: sentences.length,
  evaluated: evaluated.length,
  network_failures: results.length - evaluated.length,
  pass: passes,
  fallback: fallbacks,
  errors: errors.length,
  error_free_rate: `${rate.toFixed(1)}%`,
  target: '98%',
  verdict: rate >= 98 ? 'PASS' : 'FAIL',
  error_details: errors.map((e) => ({
    run: e.run,
    group: e.group,
    text: e.text,
    failedRules: e.failedRules,
    raw: e.raw,
    displayed: e.displayed,
  })),
};

writeFileSync(join(__dirname, 'ipa-eval-result.json'), JSON.stringify(report, null, 2));
noisy(`\n══ IPA Auto-Eval ══`);
noisy(`evaluated: ${evaluated.length}  pass: ${passes}  fallback: ${fallbacks}  errors: ${errors.length}`);
noisy(`error-free rate: ${report.error_free_rate}  (target ${report.target}) → ${report.verdict}`);
noisy(`details: scripts/ipa-eval-result.json`);
