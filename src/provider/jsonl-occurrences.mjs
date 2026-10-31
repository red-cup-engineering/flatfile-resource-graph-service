import { createHash } from 'node:crypto';

const MAX_OCCURRENCES = 4096;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

/**
 * Slice one already-admitted, exact-byte JSONL carrier into source occurrences.
 * This does not parse JSON, assume a reader executed, or confer provenance on
 * other source files. Its caller is FARS's existing exact-source admission and
 * SignCell lifecycle analyzer, not an independent ingestion engine.
 */
export function jsonLinesOccurrences(source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source) ||
      typeof source.path !== 'string' || !source.path.endsWith('.jsonl') ||
      typeof source.text !== 'string' || !SHA256.test(source.revision ?? ''))
    throw new TypeError('A pinned JSONL source occurrence carrier is required');
  const occurrences = [];
  let cursor = 0, byteOffset = 0;
  while (cursor < source.text.length) {
    if (occurrences.length >= MAX_OCCURRENCES)
      throw new RangeError('JSONL source exceeds its 4096-row occurrence budget');
    const newline = source.text.indexOf('\n', cursor);
    const end = newline === -1 ? source.text.length : newline;
    const segment = source.text.slice(cursor, end);
    const row = segment.endsWith('\r') ? segment.slice(0, -1) : segment;
    if (!row.trim()) throw new TypeError(`JSONL source has an empty row at ${source.path}:${occurrences.length + 1}`);
    const rowBytes = Buffer.from(row, 'utf8');
    const occurrence = Object.freeze({
      sourceFilePath: source.path,
      lineNumber: occurrences.length + 1,
      byteOffset,
      byteLength: rowBytes.byteLength,
      rowContentDigest: 'sha256:' + createHash('sha256').update(rowBytes).digest('hex'),
      text: row,
    });
    occurrences.push(occurrence);
    byteOffset += Buffer.byteLength(segment, 'utf8') + (newline === -1 ? 0 : 1);
    cursor = end + (newline === -1 ? 0 : 1);
  }
  if (occurrences.length === 0)
    throw new TypeError('JSONL source contains no records');
  if (byteOffset !== Buffer.byteLength(source.text, 'utf8'))
    throw new TypeError('JSONL source occurrence span is incomplete');
  return Object.freeze(occurrences);
}
