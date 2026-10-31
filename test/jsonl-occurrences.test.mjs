import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { jsonLinesOccurrences } from '../src/provider/jsonl-occurrences.mjs';
const digest = text => 'sha256:' + createHash('sha256').update(text).digest('hex');
const source = (path, text) => ({ path, text, revision: digest(text) });

test('exact UTF-8 source spans, line identities and digests survive LF and CRLF', () => {
  const value = '{"id":"α"}\r\n{"data":{"id":"β"}}\n';
  const rows = jsonLinesOccurrences(source('data/records.jsonl', value));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.lineNumber,row.byteOffset,row.byteLength]),
    [[1,0,Buffer.byteLength('{"id":"α"}')],
     [2,Buffer.byteLength('{"id":"α"}\r\n'),Buffer.byteLength('{"data":{"id":"β"}}')]]);
  assert.equal(rows[0].rowContentDigest, digest('{"id":"α"}'));
  assert.equal(rows[1].rowContentDigest, digest('{"data":{"id":"β"}}'));
  assert.equal(Object.isFrozen(rows), true);
  assert.equal(Object.isFrozen(rows[0]), true);
});

test('identical source values have equal digests but distinct occurrences', () => {
  const rows = jsonLinesOccurrences(source('content/records.jsonl', '{}\n{}\n'));
  assert.equal(rows[0].rowContentDigest, rows[1].rowContentDigest);
  assert.notEqual(rows[0].byteOffset, rows[1].byteOffset);
  assert.notEqual(rows[0].lineNumber, rows[1].lineNumber);
});

test('source paths are not inferred from arbitrary id and data keys', () => {
  const a = jsonLinesOccurrences(source('a/source.jsonl', '{"id":"same"}'));
  const b = jsonLinesOccurrences(source('b/source.jsonl', '{"id":"same"}'));
  assert.notEqual(a[0].sourceFilePath, b[0].sourceFilePath);
  assert.equal(a[0].rowContentDigest, b[0].rowContentDigest);
});

test('empty files and blank interior lines refuse phantom records', () => {
  assert.throws(() => jsonLinesOccurrences(source('a.jsonl', '')), /no records/);
  assert.throws(() => jsonLinesOccurrences(source('a.jsonl', '{}\n\n{}')), /empty row/);
  assert.throws(() => jsonLinesOccurrences(source('a.jsonl', '  \n{}')), /empty row/);
});

test('wrong source shape and unbounded line count refuse', () => {
  assert.throws(() => jsonLinesOccurrences(source('a.json', '{}')), /pinned JSONL/);
  assert.throws(() => jsonLinesOccurrences({ path: 'a.jsonl', text: '{}', revision: 'foo' }), /pinned JSONL/);
  assert.throws(() => jsonLinesOccurrences(source('a.jsonl', '{}\n'.repeat(4097))), /4096/);
});
