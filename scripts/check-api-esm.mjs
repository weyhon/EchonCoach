#!/usr/bin/env node
/**
 * Verify every api/*.ts endpoint can actually be imported as an ES module.
 *
 * package.json sets "type": "module", so Node requires a file extension on
 * relative imports at runtime. tsconfig's moduleResolution "Node" does NOT,
 * so `tsc --noEmit` and `vite build` both pass while every serverless
 * function dies at invocation with ERR_MODULE_NOT_FOUND — which is exactly
 * what shipped on 2026-08-07 and took production down until it was reverted.
 *
 * This transpiles each endpoint the way Vercel does (esbuild, ESM, node)
 * and imports it, so the failure surfaces here instead of in production.
 *
 * Usage: node scripts/check-api-esm.mjs
 */
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(ROOT, 'api');
const OUT = join(ROOT, '.api-esm-check');

const endpoints = readdirSync(API_DIR).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const esbuild = join(ROOT, 'node_modules/.bin/esbuild');
for (const file of endpoints) {
  execFileSync(esbuild, [
    join(API_DIR, file),
    '--format=esm',
    '--platform=node',
    `--outfile=${join(OUT, file.replace(/\.ts$/, '.js'))}`,
    '--log-level=error',
  ]);
}

let failed = 0;
for (const file of endpoints) {
  const js = join(OUT, file.replace(/\.ts$/, '.js'));
  try {
    await import(js);
    console.log(`  ✅ ${file}`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${file} — ${e.code || e.message}`);
  }
}

rmSync(OUT, { recursive: true, force: true });

if (failed) {
  console.error(`\n${failed}/${endpoints.length} endpoint(s) would crash on Vercel.`);
  console.error('Relative imports in api/ need a .js extension under "type": "module".');
  process.exit(1);
}
console.log(`\n${endpoints.length}/${endpoints.length} endpoints import cleanly as ESM.`);
