#!/usr/bin/env node

/**
 * ui-verify.mjs — Build + Screenshot + Lighthouse
 *
 * Usage: node scripts/ui-verify.mjs
 *
 * Steps:
 * 1. Run `npm run build` to verify the code compiles
 * 2. Start a preview server
 * 3. Take a screenshot with Puppeteer
 * 4. Run Lighthouse for accessibility score
 * 5. Output results as JSON
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SCREENSHOTS_DIR = join(PROJECT_ROOT, 'screenshots');
const RESULTS_FILE = join(SCREENSHOTS_DIR, 'verify-result.json');

// Ensure screenshots dir exists
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runBuild() {
  console.log('📦 Step 1: Building...');
  try {
    execSync('npm run build', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    });
    console.log('  ✅ Build passed');
    return true;
  } catch (err) {
    console.log('  ❌ Build failed');
    console.log(err.stderr?.toString().slice(-500));
    return false;
  }
}

async function startPreviewServer() {
  console.log('🖥️  Step 2: Starting preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15_000);
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (data) => {
      const str = data.toString();
      if (str.includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  console.log('  ✅ Server running on http://localhost:4174');
  return server;
}

async function takeScreenshot() {
  console.log('📸 Step 3: Taking screenshot...');
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Desktop viewport
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:4174', { waitUntil: 'networkidle0', timeout: 30_000 });

    // Wait a moment for fonts and animations
    await new Promise(r => setTimeout(r, 2000));

    const screenshotPath = join(SCREENSHOTS_DIR, 'latest.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Also take a mobile screenshot
    await page.setViewport({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    const mobileScreenshotPath = join(SCREENSHOTS_DIR, 'latest-mobile.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: false });

    await browser.close();
    console.log('  ✅ Screenshots saved');
    return { desktop: screenshotPath, mobile: mobileScreenshotPath };
  } catch (err) {
    console.log(`  ❌ Screenshot failed: ${err.message}`);
    return null;
  }
}

async function runLighthouse() {
  console.log('🔍 Step 4: Running Lighthouse...');
  try {
    const result = execSync(
      'npx lighthouse http://localhost:4174 --output=json --quiet --chrome-flags="--headless --no-sandbox" --only-categories=accessibility,performance,best-practices',
      {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: 90_000,
      }
    );

    const report = JSON.parse(result.toString());
    const scores = {
      performance: Math.round((report.categories.performance?.score || 0) * 100),
      accessibility: Math.round((report.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((report.categories['best-practices']?.score || 0) * 100),
    };

    console.log(`  ✅ Lighthouse: perf=${scores.performance} a11y=${scores.accessibility} bp=${scores.bestPractices}`);
    return scores;
  } catch (err) {
    console.log(`  ⚠️  Lighthouse failed, using defaults: ${err.message?.slice(0, 100)}`);
    return { performance: 0, accessibility: 0, bestPractices: 0 };
  }
}

// ── Main ──

async function main() {
  const startTime = Date.now();
  const result = {
    timestamp: new Date().toISOString(),
    build: false,
    screenshots: null,
    lighthouse: null,
    duration_ms: 0,
  };

  // Step 1: Build
  result.build = await runBuild();
  if (!result.build) {
    result.duration_ms = Date.now() - startTime;
    writeFileSync(RESULTS_FILE, JSON.stringify(result, null, 2));
    console.log(`\n⏱️  Done in ${(result.duration_ms / 1000).toFixed(1)}s — BUILD FAILED`);
    process.exit(1);
  }

  // Step 2-4: Server + Screenshot + Lighthouse
  let server;
  try {
    server = await startPreviewServer();
    result.screenshots = await takeScreenshot();
    result.lighthouse = await runLighthouse();
  } finally {
    if (server) {
      server.kill('SIGTERM');
      console.log('  🛑 Server stopped');
    }
  }

  result.duration_ms = Date.now() - startTime;
  writeFileSync(RESULTS_FILE, JSON.stringify(result, null, 2));

  console.log(`\n⏱️  Done in ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`📄 Results saved to screenshots/verify-result.json`);

  // Exit with appropriate code
  process.exit(result.build ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(2);
});
