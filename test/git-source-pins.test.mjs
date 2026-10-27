import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitTrackedLifecyclePins } from "../src/adapters/git-source-pins.mjs";
import { exactSourceRevision } from "../src/provider/exact-source-revision.mjs";

function git(root, ...args) { return execFileSync("git", ["-C", root, ...args], {encoding:"utf8"}).trim(); }
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "fars-git-sources-"));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  git(root, "init", "-q");
  git(root, "config", "user.email", "source-test@example.invalid");
  git(root, "config", "user.name", "source-test");
  mkdirSync(join(root, "data")); mkdirSync(join(root, "src"));
  writeFileSync(join(root, "data", "record.json"), '{"reading":2.75}\n');
  writeFileSync(join(root, "src", "reader.mjs"), 'const source = "data/record.json";\n');
  git(root, "add", "."); git(root, "commit", "-qm", "Pinned source lot");
  return root;
}

test("source-owned Git HEAD pins JSON and reference code without a model", t => {
  const root = fixture(t);
  const pins = gitTrackedLifecyclePins({root});
  assert.deepEqual(pins.map(row => row.path), ["data/record.json", "src/reader.mjs"]);
  assert.equal(pins[0].digest, exactSourceRevision('{"reading":2.75}\n'));
  assert.deepEqual(gitTrackedLifecyclePins({root,prefixes:["data"]}).map(row => row.path), ["data/record.json"]);
});

test("edited JSON refuses immutable Git source identity", t => {
  const root = fixture(t);
  writeFileSync(join(root, "data", "record.json"), '{"reading":7.75}\n');
  assert.throws(() => gitTrackedLifecyclePins({root}), /differs from immutable HEAD/);
});

test("symlinked repository JSON is never followed", t => {
  const root = fixture(t);
  symlinkSync("record.json", join(root, "data", "alias.json"));
  git(root, "add", "data/alias.json"); git(root, "commit", "-qm", "Symlink");
  assert.throws(() => gitTrackedLifecyclePins({root}), /symlink or non-file/);
});

test("absent JSON and traversal selection do not become successful empty source observations", t => {
  const root = fixture(t);
  assert.throws(() => gitTrackedLifecyclePins({root,prefixes:["src"]}), /no tracked JSON/);
  assert.throws(() => gitTrackedLifecyclePins({root,prefixes:["../outside"]}), /normalized relative/);
});

test("a local Git replace ref cannot impersonate the immutable JSON source tree", t => {
  const root = fixture(t);
  const original = git(root, "rev-parse", "HEAD");
  const first = gitTrackedLifecyclePins({root});
  writeFileSync(join(root, "data", "record.json"), JSON.stringify({reading:9.5}) + String.fromCharCode(10));
  git(root, "add", "data/record.json");
  git(root, "commit", "-qm", "Unrelated replacement source");
  const replacement = git(root, "rev-parse", "HEAD");
  git(root, "reset", "--hard", "-q", original);
  git(root, "replace", original, replacement);
  assert.equal(git(root, "show", original + ":data/record.json"), '{"reading":9.5}');
  const received = gitTrackedLifecyclePins({root});
  assert.deepEqual(received, first,
    "Git source admission must read the actual immutable commit, never refs/replace");
  assert.equal(received.find(row => row.path === "data/record.json").digest,
    exactSourceRevision(JSON.stringify({reading:2.75}) + String.fromCharCode(10)));
});


test("committed JSON-LD is a source resource even when no .json file exists", t => {
  const root = fixture(t);
  git(root, "rm", "-q", "data/record.json");
  const text = JSON.stringify({
    "@context": { "prov": "http://www.w3.org/ns/prov#" },
    "@graph": [{ "@id": "urn:561:reader", "http://www.w3.org/ns/prov#used": { "@id": "urn:561:source" } }]
  }) + String.fromCharCode(10);
  writeFileSync(join(root, "data", "resource.jsonld"), text);
  git(root, "add", ".");
  git(root, "commit", "-qm", "Original JSON-LD source carrier");
  const pinned = gitTrackedLifecyclePins({ root, prefixes: ["data"] });
  assert.deepEqual(pinned, [{ path: "data/resource.jsonld", digest: exactSourceRevision(text) }]);
});

test("committed JSONL, TSX, and Python remain selectable source evidence in the original Git lot", t => {
  const root = fixture(t);
  writeFileSync(join(root, "data", "observations.jsonl"), '{"path":"data/record.json"}' + String.fromCharCode(10));
  writeFileSync(join(root, "src", "consumer.tsx"), 'export const path = "data/record.json";' + String.fromCharCode(10));
  writeFileSync(join(root, "src", "consumer.py"), 'path = "data/record.json"' + String.fromCharCode(10));
  git(root, "add", ".");
  git(root, "commit", "-qm", "Original cross-language source references");
  const paths = gitTrackedLifecyclePins({ root }).map(item => item.path);
  assert.deepEqual(paths, [
    "data/observations.jsonl", "data/record.json", "src/consumer.py", "src/consumer.tsx", "src/reader.mjs",
  ]);
  assert.equal(gitTrackedLifecyclePins({ root, prefixes: ["data"] }).length, 2);
  assert.throws(() => gitTrackedLifecyclePins({ root, prefixes: ["src"] }), /no tracked JSON/);
});
