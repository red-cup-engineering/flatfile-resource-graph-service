/** Read original committed Git objects from unfinished branch/archive refs.
 * Acquisition only: the existing FARS JSON lifecycle and SignCell own projection.
 * A ref's name is not evidence of archival standing or executed consumers.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { extname } from 'node:path';
import {
  exactSourceRevision, MAX_SOURCE_BYTES, MAX_BATCH_BYTES, REPOSITORY_TEXT_EXTENSIONS, isGeneratedHostStatePath, isJsonResourceSourcePath,
} from '../provider/exact-source-revision.mjs';

const MAX_TREE_BYTES = 64 * MAX_SOURCE_BYTES;
const sourcePath = path => typeof path === 'string' && path.length > 0 &&
  !path.startsWith('/') && !path.startsWith('./') && !path.endsWith('/') &&
  !path.split('/').some(part => part === '' || part === '.' || part === '..' ||
    ['.git', 'node_modules', '.env'].includes(part));

function readGit(root, args, input) {
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !name.startsWith('GIT_')));
  return execFileSync('git', ['--no-replace-objects', '-C', root, ...args], {
    encoding: 'buffer', maxBuffer: MAX_TREE_BYTES, timeout: 30_000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { input }),
    env: { ...environment, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1',
      GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
}
const ascii = bytes => bytes.toString('ascii').trim();
const DIGEST = /^([0-9a-f]{40}|[0-9a-f]{64})$/u;
const ENTRY = /^(100644|100755|120000|160000) (blob|commit) ([0-9a-f]{40}|[0-9a-f]{64})$/u;
const HEADER = /^([0-9a-f]{40}|[0-9a-f]{64}) blob ([0-9]+)$/u;

/** Bounded exact historical source, ready for FARS analyzeJsonResourceLifecycle. */
export function readGitRefSourceSnapshot({ root, ref, prefixes = [] }) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('Git repository root required');
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 512 ||
      ref.startsWith('-') || /[\u0000-\u001f\u007f]/u.test(ref))
    throw new TypeError('Explicit bounded Git source ref required');
  if (!Array.isArray(prefixes) || prefixes.some(prefix => !sourcePath(prefix)))
    throw new TypeError('Git source prefixes must be relative normalized paths');
  const directory = realpathSync(root);
  const top = ascii(readGit(directory, ['rev-parse', '--show-toplevel']));
  if (top !== directory) throw new TypeError('Git source root must be the repository root');
  const format = ascii(readGit(directory, ['rev-parse', '--show-object-format']));
  if (format !== 'sha1' && format !== 'sha256') throw new TypeError('Unknown Git object format');
  const oidLength = format === 'sha1' ? 40 : 64;
  const commitOfRef = () => ascii(readGit(directory,
    ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']));
  const commit = commitOfRef();
  if (!DIGEST.test(commit) || commit.length !== oidLength) throw new TypeError('Unresolved original Git commit');
  const tree = ascii(readGit(directory,
    ['rev-parse', '--verify', '--end-of-options', commit + '^{tree}']));
  if (!DIGEST.test(tree) || tree.length !== oidLength) throw new TypeError('Unresolved original Git tree');
  const listed = readGit(directory, ['ls-tree', '-r', '-z', '--full-tree', commit]);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const selected = [];
  let excludedGeneratedHostStateCount = 0;
  for (let offset = 0; offset < listed.length;) {
    const end = listed.indexOf(0, offset);
    if (end < 0) throw new TypeError('Unterminated native Git tree entry');
    const entry = listed.subarray(offset, end); offset = end + 1;
    const tab = entry.indexOf(9);
    if (tab < 0) throw new TypeError('Missing native Git tree path');
    const identity = ENTRY.exec(entry.subarray(0, tab).toString('ascii'));
    const path = decoder.decode(entry.subarray(tab + 1));
    if (!identity || identity[3].length !== oidLength) throw new TypeError('Invalid Git source object identity');
    if (!REPOSITORY_TEXT_EXTENSIONS.includes(extname(path)) ||
        (prefixes.length && !prefixes.some(prefix => path === prefix || path.startsWith(prefix + '/')))) continue;
    if (!sourcePath(path)) throw new TypeError('Unsafe Git source path');
    if (isGeneratedHostStatePath(path)) {
      excludedGeneratedHostStateCount++;
      continue;
    }
    if (!['100644', '100755'].includes(identity[1]) || identity[2] !== 'blob')
      throw new TypeError('Selected Git source is not a regular file: ' + path);
    if (selected.length >= 4096) throw new RangeError('Git lifecycle source-count bound exceeded');
    selected.push({ path, object: identity[3], mode: identity[1] });
  }
  if (!selected.some(item => isJsonResourceSourcePath(item.path)))
    throw new TypeError('Git source scope contains no JSON-valued resources');
  selected.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const input = Buffer.from(selected.map(item => item.object).join('\n') + '\n', 'ascii');
  const sizeResponse = readGit(directory,
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], input);
  const sizeLines = sizeResponse.toString('ascii').trimEnd().split('\n');
  if (sizeLines.length !== selected.length) throw new TypeError('Incomplete native Git source inventory');
  let total = 0;
  const sizes = sizeLines.map((row, index) => {
    const match = HEADER.exec(row);
    if (!match || match[1] !== selected[index].object || !Number.isSafeInteger(Number(match[2])))
      throw new TypeError('Git source identity or size differs from its selected tree');
    const bytes = Number(match[2]); total += bytes;
    if (bytes > MAX_SOURCE_BYTES || total > MAX_BATCH_BYTES)
      throw new RangeError('Git source exceeds original FARS source-byte bounds');
    return bytes;
  });
  const raw = readGit(directory, ['cat-file', '--batch'], input);
  const files = [];
  let offset = 0;
  for (let index = 0; index < selected.length; index++) {
    const newline = raw.indexOf(10, offset);
    if (newline < 0) throw new TypeError('Incomplete Git blob header');
    const header = HEADER.exec(raw.subarray(offset, newline).toString('ascii'));
    const size = sizes[index], start = newline + 1, end = start + size;
    if (!header || header[1] !== selected[index].object || Number(header[2]) !== size ||
        end >= raw.length || raw[end] !== 10)
      throw new TypeError('Git source blob differs from native batch identity');
    const bytes = raw.subarray(start, end);
    const objectHeader = Buffer.from('blob ' + size + String.fromCharCode(0), 'ascii');
    if (createHash(format).update(objectHeader).update(bytes).digest('hex') !== header[1])
      throw new TypeError('Git source has incorrect native object hash');
    files.push(Object.freeze({ path: selected[index].path,
      revision: exactSourceRevision(bytes), text: decoder.decode(bytes) }));
    offset = end + 1;
  }
  if (offset !== raw.length || commitOfRef() !== commit)
    throw new TypeError('Historical Git source batch incomplete or ref moved');
  return Object.freeze({ kind: 'fars.git-ref-source-snapshot/v1',
    sourceRef: ref, sourceCommit: commit, sourceTree: tree,
    // Keep Git OIDs separate from the exact-byte SHA-256 revisions consumed by SignCell.
    // Each OID was checked against the native blob header and bytes above; the
    // Git ref and commit are still source observations, not consumer receipts.
    sourceObjectFormat: format,
    excludedGeneratedHostStateCount,
    sourceFiles: Object.freeze(selected.map((source, index) => Object.freeze({
      sourcePath: source.path, sourceGitBlobSha: source.object,
      sourceGitFileMode: source.mode, contentDigest: files[index].revision,
    }))),
    exhaustiveRepository: false, prefixes: Object.freeze([...prefixes]),
    files: Object.freeze(files) });
}
