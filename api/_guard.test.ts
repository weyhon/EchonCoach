import { describe, it, expect, vi } from 'vitest';
import { guard, tooLong } from './_guard';

const HOST = 'echon-coach.vercel.app';

function mkRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

function mkReq(headers: Record<string, string>, body: any = {}, method = 'POST') {
  return { method, headers: { host: HOST, ...headers }, body, socket: {} } as any;
}

// Each case below is an abuse path verified against production before the fix.
describe('guard — origin gate', () => {
  it('accepts the app’s own origin', () => {
    const res = mkRes();
    expect(guard(mkReq({ origin: `https://${HOST}` }), res, { maxBodyBytes: 8000 })).toBe(false);
  });

  it('rejects a suffix-spoofed origin (defeated the old includes() check)', () => {
    const res = mkRes();
    expect(guard(mkReq({ origin: `https://${HOST}.evil.com` }), res, { maxBodyBytes: 8000 })).toBe(true);
    expect(res.statusCode).toBe(403);
  });

  it('rejects a missing origin (skipped the old check entirely)', () => {
    const res = mkRes();
    expect(guard(mkReq({}), res, { maxBodyBytes: 8000 })).toBe(true);
    expect(res.statusCode).toBe(403);
  });

  it('rejects an unrelated origin', () => {
    const res = mkRes();
    expect(guard(mkReq({ origin: 'https://evil.com' }), res, { maxBodyBytes: 8000 })).toBe(true);
    expect(res.statusCode).toBe(403);
  });

  it('rejects non-POST', () => {
    const res = mkRes();
    expect(guard(mkReq({ origin: `https://${HOST}` }, {}, 'GET'), res, { maxBodyBytes: 8000 })).toBe(true);
    expect(res.statusCode).toBe(405);
  });
});

describe('guard — size cap', () => {
  it('rejects a body over the cap', () => {
    const res = mkRes();
    const big = { text: 'x'.repeat(20_000) };
    expect(guard(mkReq({ origin: `https://${HOST}` }, big), res, { maxBodyBytes: 8_000 })).toBe(true);
    expect(res.statusCode).toBe(413);
  });
});

describe('guard — rate limit', () => {
  it('throttles a burst from one IP', () => {
    const ip = '203.0.113.99';
    const req = () => mkReq({ origin: `https://${HOST}`, 'x-forwarded-for': ip });
    let blocked = 0;
    for (let i = 0; i < 40; i++) {
      const res = mkRes();
      if (guard(req(), res, { maxBodyBytes: 8000 })) {
        blocked++;
        expect(res.statusCode).toBe(429);
      }
    }
    expect(blocked).toBeGreaterThan(0);
  });
});

describe('tooLong', () => {
  it('flags strings past the limit', () => {
    expect(tooLong('x'.repeat(101), 100)).toBe(true);
    expect(tooLong('x'.repeat(100), 100)).toBe(false);
    expect(tooLong(undefined, 100)).toBe(false);
  });
});
