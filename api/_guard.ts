import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Shared gate for the Gemini/Azure proxy endpoints.
 *
 * These endpoints spend money on every call (LLM tokens, TTS audio, Azure
 * quota). Without a gate they are an open, unmetered AI service billed to
 * this project's keys — a `for` loop of curl POSTs is all it takes.
 *
 * Three layers, cheapest first:
 *   1. same-origin check (exact host match, not substring)
 *   2. request size caps (cost is proportional to input size)
 *   3. per-IP rate limit (best effort — see the note on serverless below)
 */

/** Requests allowed per IP per window. Generous for a human, useless for a loop. */
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

/**
 * Per-instance counters. Serverless spreads traffic over instances that come
 * and go, so this is a speed bump, not a wall: it throttles a naive script
 * without a database. Sustained abuse needs Vercel WAF / Upstash.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/**
 * Same-origin check. `origin.includes(host)` was defeated by
 * `https://<host>.evil.com`; this compares the parsed hostname exactly.
 * A missing Origin/Referer is also rejected — browsers always send one on
 * cross-origin POSTs, so absence means "not our page".
 */
function sameOrigin(req: VercelRequest): boolean {
  const raw = (req.headers.origin || req.headers.referer || '') as string;
  const host = (req.headers.host || '') as string;
  if (!raw || !host) return false;
  try {
    return new URL(raw).host === host;
  } catch {
    return false;
  }
}

export interface GuardOptions {
  /** Max serialized body size in bytes. Cost scales with input. */
  maxBodyBytes: number;
}

/**
 * Returns true when the request was rejected (response already sent).
 * Call as: `if (guard(req, res, { maxBodyBytes: N })) return;`
 */
export function guard(req: VercelRequest, res: VercelResponse, opts: GuardOptions): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }

  const ip =
    ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
    (req.socket?.remoteAddress ?? 'unknown');
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return true;
  }

  const size = Buffer.byteLength(JSON.stringify(req.body ?? ''), 'utf8');
  if (size > opts.maxBodyBytes) {
    res.status(413).json({ error: 'Request too large' });
    return true;
  }

  return false;
}

/** Reject absurd text lengths before they reach a per-token-billed model. */
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > max;
}
