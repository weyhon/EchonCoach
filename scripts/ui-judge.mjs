#!/usr/bin/env node

/**
 * ui-judge.mjs — LLM Design Scoring
 *
 * Usage: node scripts/ui-judge.mjs
 *
 * Reads the screenshot from screenshots/latest.png,
 * sends it to Gemini with the design rules,
 * and outputs a structured score.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SCREENSHOTS_DIR = join(PROJECT_ROOT, 'screenshots');
const SCREENSHOT_PATH = join(SCREENSHOTS_DIR, 'latest.png');
const DESIGN_RULES_PATH = join(PROJECT_ROOT, 'design-rules.md');
const JUDGE_RESULT_PATH = join(SCREENSHOTS_DIR, 'judge-result.json');
const RESULTS_TSV_PATH = join(PROJECT_ROOT, 'results.tsv');

// ── Config ──

// Load API key from .env or .env.local
function loadApiKey() {
  for (const envFile of ['.env', '.env.local']) {
    const path = join(PROJECT_ROOT, envFile);
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      // Match VITE_API_KEY or API_KEY
      const match = content.match(/(?:VITE_)?API_KEY=["']?([^"'\n]+)/);
      if (match) return match[1];
    }
  }
  return process.env.API_KEY || process.env.VITE_API_KEY;
}

const API_KEY = loadApiKey();
if (!API_KEY) {
  console.error('❌ No API key found. Set API_KEY in .env or .env.local');
  process.exit(1);
}

// ── Design Rules ──

function loadDesignRules() {
  if (!existsSync(DESIGN_RULES_PATH)) {
    console.error('❌ design-rules.md not found');
    process.exit(1);
  }
  return readFileSync(DESIGN_RULES_PATH, 'utf-8');
}

// ── Screenshot ──

function loadScreenshot() {
  if (!existsSync(SCREENSHOT_PATH)) {
    console.error('❌ Screenshot not found at screenshots/latest.png');
    console.error('   Run `node scripts/ui-verify.mjs` first');
    process.exit(1);
  }
  const buffer = readFileSync(SCREENSHOT_PATH);
  return buffer.toString('base64');
}

// ── Gemini API ──

async function judgeWithGemini(screenshotBase64, designRules) {
  const prompt = `You are a UI design judge. Score this app screenshot against the design rules below.

## Design Rules
${designRules}

## Instructions
1. Analyze the screenshot carefully
2. Score each of the 5 dimensions (0-20 each)
3. List specific issues for each dimension
4. Provide ONE top suggestion for the most impactful improvement

## Output Format (strict JSON only, no markdown)
{
  "color": { "score": <0-20>, "issues": ["..."] },
  "typography": { "score": <0-20>, "issues": ["..."] },
  "depth": { "score": <0-20>, "issues": ["..."] },
  "interaction": { "score": <0-20>, "issues": ["..."] },
  "restraint": { "score": <0-20>, "issues": ["..."] },
  "total": <0-100>,
  "grade": "<S/A/B/C/D>",
  "top_suggestion": "<most impactful single improvement>"
}

IMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation text.`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: 'image/png',
            data: screenshotBase64,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1, // Low temp for consistent scoring
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      // 2.5 系列是思考型模型，思考也占输出配额 — 打分不需要思考预算
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response text from Gemini');
  }

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('⚠️  Failed to parse Gemini response as JSON:');
    console.error(cleaned.slice(0, 500));
    throw new Error('Invalid JSON from Gemini');
  }
}

// ── Combine Scores ──

function combineScores(judgeResult, lighthouseResult) {
  const designScore = judgeResult.total || 0;

  // Load lighthouse results if available
  let lighthouseA11y = 0;
  const verifyResultPath = join(SCREENSHOTS_DIR, 'verify-result.json');
  if (existsSync(verifyResultPath)) {
    try {
      const verify = JSON.parse(readFileSync(verifyResultPath, 'utf-8'));
      lighthouseA11y = verify.lighthouse?.accessibility || 0;
    } catch (e) {
      // ignore
    }
  }

  // Combined: 70% design + 30% lighthouse accessibility
  const finalScore = Math.round(0.7 * designScore + 0.3 * lighthouseA11y);

  return {
    design_score: designScore,
    lighthouse_a11y: lighthouseA11y,
    final_score: finalScore,
    grade: judgeResult.grade,
    top_suggestion: judgeResult.top_suggestion,
  };
}

// ── Log to TSV ──

function logToTsv(description, buildPass, combined, duration) {
  const header = 'timestamp\texperiment_id\tdescription\tbuild\tdesign_score\tlighthouse_a11y\tfinal_score\tstatus\tduration_s\n';

  if (!existsSync(RESULTS_TSV_PATH)) {
    writeFileSync(RESULTS_TSV_PATH, header);
  }

  // Count existing lines to get experiment_id
  const lines = readFileSync(RESULTS_TSV_PATH, 'utf-8').split('\n').filter(l => l.trim());
  const expId = String(lines.length).padStart(3, '0');

  const row = [
    new Date().toISOString(),
    expId,
    description || 'manual judge',
    buildPass ? 'pass' : 'fail',
    combined.design_score,
    combined.lighthouse_a11y,
    combined.final_score,
    'judge', // status will be updated by the main loop
    Math.round(duration / 1000),
  ].join('\t');

  writeFileSync(RESULTS_TSV_PATH, readFileSync(RESULTS_TSV_PATH, 'utf-8') + row + '\n');
}

// ── Multi-run median (reduces LLM variance) ──

const JUDGE_RUNS = parseInt(process.env.JUDGE_RUNS || '3', 10);

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function medianJudge(results) {
  // Take median of each dimension and total
  const dims = ['color', 'typography', 'depth', 'interaction', 'restraint'];
  const merged = {};
  for (const d of dims) {
    const scores = results.map(r => r[d]?.score ?? 0);
    merged[d] = { score: median(scores), issues: results[Math.floor(results.length / 2)][d]?.issues || [] };
  }
  merged.total = dims.reduce((s, d) => s + merged[d].score, 0);
  merged.grade = merged.total >= 90 ? 'S' : merged.total >= 80 ? 'A' : merged.total >= 70 ? 'B' : merged.total >= 60 ? 'C' : 'D';
  merged.top_suggestion = results[Math.floor(results.length / 2)].top_suggestion;
  return merged;
}

// ── Main ──

async function main() {
  const startTime = Date.now();

  console.log('🎨 UI Design Judge');
  console.log(`──────────────────  (${JUDGE_RUNS} runs, median)`);

  // Load inputs
  console.log('📄 Loading design rules...');
  const designRules = loadDesignRules();

  console.log('📸 Loading screenshot...');
  const screenshotBase64 = loadScreenshot();

  // Judge — run multiple times in parallel
  console.log(`🤖 Sending ${JUDGE_RUNS} requests to Gemini...`);
  const allResults = await Promise.all(
    Array.from({ length: JUDGE_RUNS }, () => judgeWithGemini(screenshotBase64, designRules))
  );

  // Show individual run scores
  allResults.forEach((r, i) => {
    console.log(`  Run ${i + 1}: C=${r.color?.score} T=${r.typography?.score} D=${r.depth?.score} I=${r.interaction?.score} R=${r.restraint?.score} → ${r.total}`);
  });

  // Median
  const judgeResult = medianJudge(allResults);

  // Combine
  const combined = combineScores(judgeResult);
  const duration = Date.now() - startTime;

  // Save detailed result
  const fullResult = {
    timestamp: new Date().toISOString(),
    judge: judgeResult,
    runs: allResults,
    combined,
    duration_ms: duration,
  };
  writeFileSync(JUDGE_RESULT_PATH, JSON.stringify(fullResult, null, 2));

  // Log to TSV
  const description = process.argv[2] || 'manual judge';
  logToTsv(description, true, combined, duration);

  // Display results
  console.log('\n📊 Results (median):');
  console.log('──────────────────');
  console.log(`  Color:       ${judgeResult.color?.score}/20`);
  console.log(`  Typography:  ${judgeResult.typography?.score}/20`);
  console.log(`  Depth:       ${judgeResult.depth?.score}/20`);
  console.log(`  Interaction: ${judgeResult.interaction?.score}/20`);
  console.log(`  Restraint:   ${judgeResult.restraint?.score}/20`);
  console.log('──────────────────');
  console.log(`  Design:      ${combined.design_score}/100`);
  console.log(`  Lighthouse:  ${combined.lighthouse_a11y}/100`);
  console.log(`  Final:       ${combined.final_score}/100 (${combined.grade})`);
  console.log('──────────────────');
  console.log(`  💡 Top suggestion: ${combined.top_suggestion}`);
  console.log(`\n⏱️  Done in ${(duration / 1000).toFixed(1)}s`);

  // Output final score to stdout for script consumption
  console.log(`\nFINAL_SCORE=${combined.final_score}`);
}

main().catch((err) => {
  console.error('❌ Judge failed:', err.message);
  process.exit(1);
});
