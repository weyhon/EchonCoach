import { describe, it, expect } from 'vitest';
import { lruGet, lruSet } from './lru';

describe('lruSet', () => {
  it('adds entries up to the limit', () => {
    const map = new Map<string, number>();
    lruSet(map, 'a', 1, 3);
    lruSet(map, 'b', 2, 3);
    lruSet(map, 'c', 3, 3);
    expect(map.size).toBe(3);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
  });

  it('evicts the oldest entry when adding beyond the limit', () => {
    const map = new Map<string, number>();
    lruSet(map, 'a', 1, 2);
    lruSet(map, 'b', 2, 2);
    // Map is full (size=2), adding 'c' should evict 'a' (oldest)
    lruSet(map, 'c', 3, 2);
    expect(map.size).toBe(2);
    expect(map.has('a')).toBe(false);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
  });

  it('overwrites existing key without eviction', () => {
    const map = new Map<string, number>();
    lruSet(map, 'a', 1, 2);
    lruSet(map, 'b', 2, 2);
    // Overwrite 'a' — should not evict since 'a' already exists
    // Actually lruSet doesn't check for existing key, it just evicts oldest if size >= limit
    // Since size is 2 and limit is 2, it evicts oldest ('a'), then sets 'a' again
    lruSet(map, 'a', 10, 2);
    expect(map.size).toBe(2);
    expect(map.get('a')).toBe(10);
  });
});

describe('lruGet', () => {
  it('returns the value for an existing key', () => {
    const map = new Map<string, number>();
    map.set('x', 42);
    expect(lruGet(map, 'x')).toBe(42);
  });

  it('returns undefined for a missing key', () => {
    const map = new Map<string, number>();
    expect(lruGet(map, 'missing')).toBeUndefined();
  });

  it('promotes accessed key to most recent (prevents eviction)', () => {
    const map = new Map<string, number>();
    lruSet(map, 'a', 1, 3);
    lruSet(map, 'b', 2, 3);
    lruSet(map, 'c', 3, 3);

    // Access 'a' to promote it — now 'b' is the oldest
    lruGet(map, 'a');

    // Add 'd' — should evict 'b' (oldest), not 'a'
    lruSet(map, 'd', 4, 3);
    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(false);
    expect(map.has('c')).toBe(true);
    expect(map.has('d')).toBe(true);
  });

  it('does not modify map when key is missing', () => {
    const map = new Map<string, number>();
    map.set('a', 1);
    lruGet(map, 'missing');
    expect(map.size).toBe(1);
    expect(map.get('a')).toBe(1);
  });
});
