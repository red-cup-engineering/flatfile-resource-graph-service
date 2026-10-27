/**
 * Exact-byte SHA-256 for admitted flatfile sources. File and pure source
 * readers must agree on the same digest of UTF-8 bytes, not JSON semantics,
 * locale-dependent text, or a caller's unverified digest label.
 */
import { createHash } from 'node:crypto';

export const MAX_SOURCE_BYTES = 1_048_576;
export const MAX_BATCH_BYTES = 16 * MAX_SOURCE_BYTES;

export function exactSourceRevision(source) {
  if (typeof source !== 'string' && !(source instanceof Uint8Array))
    throw new TypeError('exact source revision requires text or bytes');
  const bytes = typeof source === 'string' ? Buffer.from(source, 'utf8') : source;
  if (bytes.byteLength > MAX_SOURCE_BYTES)
    throw new RangeError('JSON source exceeds its 1 MiB byte budget');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

/** Refuse oversized pure source selections before any Cell or graph projection. */
export function admitExactTextSourceRevisions(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 4096)
    throw new TypeError('JSON lifecycle requires a bounded exact source snapshot');
  let total = 0;
  const seen = new Set();
  for (const source of sources) {
    if (source === null || typeof source !== 'object' || Array.isArray(source) ||
        Object.keys(source).sort().join() !== 'path,revision,text' ||
        typeof source.path !== 'string' || !source.path.trim() ||
        typeof source.text !== 'string' ||
        typeof source.revision !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(source.revision) ||
        seen.has(source.path))
      throw new TypeError('JSON lifecycle source coordinates must be exact and distinct');
    seen.add(source.path);
    const length = Buffer.byteLength(source.text, 'utf8');
    if (length > MAX_SOURCE_BYTES)
      throw new RangeError(`JSON lifecycle source exceeds its 1 MiB byte budget: ${source.path}`);
    total += length;
    if (total > MAX_BATCH_BYTES)
      throw new RangeError('JSON lifecycle source selection exceeds its 16 MiB byte budget');
    if (exactSourceRevision(source.text) !== source.revision)
      throw new TypeError(`JSON lifecycle source digest differs from its exact UTF-8 text: ${source.path}`);
  }
  return sources;
}
