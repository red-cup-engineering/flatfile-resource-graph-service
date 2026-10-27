import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGitRefSourceSnapshot } from '../src/adapters/git-ref-sources.mjs';
import { exactSourceRevision } from '../src/provider/exact-source-revision.mjs';

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'fars-git-ref-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'FARS source assay');
  git(root, 'config', 'user.email', 'source@example.invalid');
  mkdirSync(join(root, 'data')); mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'data/old.json'), '{"condition":"original"}\n');
  writeFileSync(join(root, 'src/reader.tsx'), 'const old = "data/old.json";\n');
  writeFileSync(join(root, 'data/events.jsonl'), '{"source":"data/old.json"}\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Original unfinished files');
  const old = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/archive/unfinished-agent', old);
  git(root, 'rm', '-q', 'data/old.json');
  writeFileSync(join(root, 'data/new.json'), '{"condition":"new"}\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'New main tree');
  return { root, old, current: git(root, 'rev-parse', 'HEAD') };
}

test('archive ref receives the original absent JSON, JSONL and TSX without looking at HEAD', t => {
  const { root, old, current } = fixture(t);
  const original = readGitRefSourceSnapshot({ root, ref: 'refs/archive/unfinished-agent' });
  assert.equal(original.kind, 'fars.git-ref-source-snapshot/v1');
  assert.equal(original.sourceCommit, old);
  assert.notEqual(original.sourceCommit, current);
  assert.deepEqual(original.files.map(f => f.path), ['data/events.jsonl','data/old.json','src/reader.tsx']);
  assert.equal(original.files.find(f => f.path === 'data/old.json').revision,
    exactSourceRevision(Buffer.from('{"condition":"original"}\n')));
  assert.equal(original.exhaustiveRepository, false);
  assert.equal(original.sourceObjectFormat, git(root, 'rev-parse', '--show-object-format'));
  assert.deepEqual(original.sourceFiles.map(file => file.sourcePath), original.files.map(file => file.path));
  assert.deepEqual(original.sourceFiles.find(file => file.sourcePath === 'data/old.json'), {
    sourcePath: 'data/old.json',
    sourceGitBlobSha: git(root, 'rev-parse', 'refs/archive/unfinished-agent:data/old.json'),
    sourceGitFileMode: '100644',
    contentDigest: exactSourceRevision(Buffer.from('{\"condition\":\"original\"}\n')),
  });
  // FARS's pure source coordinates remain exactly {path, revision, text};
  // Git's independent object identity is attached to the selected-source receipt.
  assert.deepEqual(Object.keys(original.files[0]).sort(), ['path', 'revision', 'text']);
  assert.deepEqual(readGitRefSourceSnapshot({ root, ref: 'refs/heads/main', prefixes: ['data'] })
    .files.map(f => f.path), ['data/events.jsonl','data/new.json']);
  assert.equal(git(root, 'rev-parse', 'refs/archive/unfinished-agent'), old);
});

test('native Git-ref FARS CLI carries every verified Git blob through to the original Cell lifecycle', t => {
  const { root, old } = fixture(t);
  const namespace = 'https://github.com/red-cup-engineering/flatfile-resource-graph-service';
  const command = join(import.meta.dirname, '../scripts/flatfile-resource-graph-cli.mjs');
  const run = spawnSync(process.execPath, [command, 'source-json-lifecycle-git-ref', root,
    namespace, '2026-10-27T15:00:00Z', 'refs/archive/unfinished-agent'],
    { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const body = JSON.parse(run.stdout);
  assert.equal(body.gitSource.sourceCommit, old);
  assert.equal(body.gitSource.sourceObjectFormat, git(root, 'rev-parse', '--show-object-format'));
  const retained = body.gitSource.sourceFiles.find(file => file.sourcePath === 'data/old.json');
  assert.equal(retained.sourceGitBlobSha, git(root, 'rev-parse', old + ':data/old.json'));
  assert.equal(retained.sourceGitFileMode, '100644');
  assert.equal(retained.contentDigest, body.scope.sources.find(row =>
    row.sourcePath === 'data/old.json').contentDigest);
  assert.equal(body.resources.some(resource => resource.sourcePath === 'data/old.json'), true);
  assert.equal(body.gitSource.exhaustiveRepository, false);
});

test('a forged refs/replace entry cannot substitute archived JSON under the same commit ID', t => {
  const { root, old, current } = fixture(t);
  git(root, 'replace', old, current);
  assert.match(git(root, 'show', old + ':data/new.json'), /new/);
  const snapshot = readGitRefSourceSnapshot({ root, ref: 'refs/archive/unfinished-agent' });
  assert.equal(snapshot.sourceCommit, old);
  assert.ok(snapshot.files.some(f => f.path === 'data/old.json'));
  assert.equal(snapshot.files.some(f => f.path === 'data/new.json'), false);
});

test('reject malformed ref, missing source revision, unsafe scope, absent JSON', t => {
  const { root } = fixture(t);
  for (const ref of ['-z', 'refs/archive/unfinished-agent\nstatus', 'refs/archive/not-created'])
    assert.throws(() => readGitRefSourceSnapshot({root,ref}));
  assert.throws(() => readGitRefSourceSnapshot({root,ref:'refs/archive/unfinished-agent',prefixes:['../secret']}), /normalized/);
  assert.throws(() => readGitRefSourceSnapshot({root,ref:'refs/archive/unfinished-agent',prefixes:['src']}), /no JSON/);
});

test('reject tracked symlink with a selected JSON name', t => {
  const { root } = fixture(t);
  symlinkSync('new.json', join(root, 'data/alias.json'));
  git(root, 'add', 'data/alias.json'); git(root, 'commit', '-qm', 'Symlinked JSON in current tree');
  assert.throws(() => readGitRefSourceSnapshot({root,ref:'refs/heads/main'}), /not a regular file/);
});

test('original byte budget refuses giant tracked JSON before returning any source', t => {
  const { root } = fixture(t);
  writeFileSync(join(root,'data/giant.json'), JSON.stringify({text:'x'.repeat(1_048_576)}));
  git(root,'add','data/giant.json'); git(root,'commit','-qm','Oversized original');
  assert.throws(() => readGitRefSourceSnapshot({root,ref:'refs/heads/main'}), /byte bounds/);
});
