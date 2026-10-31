import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isGeneratedHostStatePath, exactSourceRevision, admitExactTextSourceRevisions }
  from '../src/provider/exact-source-revision.mjs';
import { gitTrackedLifecyclePins } from '../src/adapters/git-source-pins.mjs';
import { readGitRefSourceSnapshot } from '../src/adapters/git-ref-sources.mjs';

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {encoding:'utf8'}).trim();
function source(t) {
  const root = mkdtempSync(join(tmpdir(), 'fars-original-source-role-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'FARS native source-role assay');
  git(root, 'config', 'user.email', 'fars@example.invalid');
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'app'), { recursive:true });
  mkdirSync(join(root, 'app', '.wrangler'), { recursive:true });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'data', 'observation.json'), '{"id":"source","value":3}\n');
  writeFileSync(join(root, 'app', 'wrangler-config.json'), '{"kind":"authored"}\n');
  writeFileSync(join(root, 'src', 'reader.mjs'), 'const source = "data/observation.json";\n');
  writeFileSync(join(root, 'app', '.wrangler', 'state.json'), '{"cache":"host"}\n');
  writeFileSync(join(root, 'app', '.wrangler', 'state.sqlite-wal'), 'runtime effect');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'Original source and host state');
  return root;
}

test('generated host state is not an authored JSON source under exact relative path law', () => {
  assert.equal(isGeneratedHostStatePath('app/.wrangler/state.json'), true);
  assert.equal(isGeneratedHostStatePath('app/wrangler-config.json'), false);
  assert.equal(isGeneratedHostStatePath('src/.wrangler-not-cache.json'), false);
  assert.throws(() => isGeneratedHostStatePath('../secret/.wrangler/state.json'), /normalized/);
  const text = '{"cache": "generated"}';
  assert.throws(() => admitExactTextSourceRevisions([{
    path: 'app/.wrangler/cache.json', text, revision: exactSourceRevision(text)
  }]), /Effectful generated host state/);
});

test('both original Git selectors omit host caches and retain authored JSON and code', t => {
  const root = source(t);
  const expected = ['app/wrangler-config.json', 'data/observation.json', 'src/reader.mjs'];
  const pins = gitTrackedLifecyclePins({ root });
  assert.deepEqual(pins.map(x => x.path), expected);
  assert.ok(pins.every(x => /^sha256:[0-9a-f]{64}$/u.test(x.digest)));
  const archive = 'refs/archive/not-consumed';
  git(root, 'update-ref', archive, git(root, 'rev-parse', 'HEAD'));
  const received = readGitRefSourceSnapshot({ root, ref: archive });
  assert.deepEqual(received.files.map(x => x.path), expected);
  assert.equal(received.excludedGeneratedHostStateCount, 1);
  assert.equal(received.sourceRef, archive);
  assert.equal(received.sourceCommit, git(root, 'rev-parse', archive));
  assert.equal(git(root, 'ls-tree', '-r', '--name-only', archive).includes('app/.wrangler/state.json'), true,
    'archive content is preserved although the JSON source selector refuses it');
  assert.throws(() => readGitRefSourceSnapshot({root,ref:archive,prefixes:['app/.wrangler']}), /no JSON-valued/);
});
