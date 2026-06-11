/**
 * LRU-style cache helpers for Map-based caches.
 * Evicts oldest entries when over limit to prevent unbounded memory growth.
 */

export function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  const value = map.get(key);
  if (value !== undefined) {
    map.delete(key);
    map.set(key, value);
  }
  return value;
}

export function lruSet<K, V>(map: Map<K, V>, key: K, value: V, limit: number) {
  if (map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}
