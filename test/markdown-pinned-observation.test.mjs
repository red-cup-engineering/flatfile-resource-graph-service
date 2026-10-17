import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { markdownDirectoryProvider } from "../src/adapters/markdown-directory.mjs";

const revisionOf = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
async function fixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), "fars-pinned-md-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), bytes);
  }
  return root;
}
const office = Buffer.from("---\nkind: office\nname: Leader\n---\nAct within this office.\n");
const unrelated = Buffer.from("---\nkind: office\nname: Unrelated\n---\nNot your office.\n");

test("a source-pinned Markdown provider only admits its selected file and exact bytes", async t => {
  const path = "governance/offices/lead.md";
  const root = await fixture(t, { [path]: office, "unrelated/lead.md": unrelated });
  const p = markdownDirectoryProvider({
    id: "colony:alpha", root, namespace: "urn:561:colony:alpha",
    pins: [{ path, digest: revisionOf(office) }],
  });
  const observed = await p.observe();
  assert.equal(observed.resources.length, 1);
  assert.equal(observed.resources[0].focus.includes(encodeURIComponent(path)), true);
  assert.equal(observed.resources[0].cells.find(c => c.predicate === "urn:fars:source-revision").object,
    revisionOf(office));
  assert.equal(observed.resources[0].cells.some(c => c.predicate === "urn:fars:authorized-incumbent"), false);
  await assert.rejects(markdownDirectoryProvider({
    id: "stale", root, namespace: "urn:561:colony:alpha",
    pins: [{ path, digest: revisionOf(unrelated) }],
  }).observe(), /source missing or changed/);
  assert.throws(() => markdownDirectoryProvider({
    id: "invalid", root, namespace: "urn:561:colony:alpha",
    pins: [{ path: "../secrets.md", digest: revisionOf(office) }],
  }), TypeError);
  assert.throws(() => markdownDirectoryProvider({
    id: "unqualified", root, pins: [{ path, digest: revisionOf(office) }],
  }), /qualified source-owner namespace/);
});

test("a pinned plain Markdown method retains its body without invented governing frontmatter", async t => {
  const body = "No frontmatter here.\n";
  const root = await fixture(t, { "office.md": office, "prose.md": body });
  await assert.rejects(markdownDirectoryProvider({
    id: "missing", root, namespace: "urn:561:colony:alpha",
    pins: [{ path: "absent.md", digest: revisionOf(office) }],
  }).observe(), /source missing or changed/);
  const plain = (await markdownDirectoryProvider({
    id: "plain", root, namespace: "urn:561:colony:alpha",
    pins: [{ path: "prose.md", digest: revisionOf(body) }],
  }).observe()).resources[0];
  assert.equal(plain.cells.find(c => c.predicate === "urn:fars:source-revision").object, revisionOf(body));
  assert.ok(plain.cells.some(c => c.predicate === "urn:fars:body-content-id"));
  assert.equal(plain.cells.some(c => c.predicate.startsWith("urn:fars:attribute:")), false,
    "plain prose must not acquire office, skill or authority fields by inference");
  const unpinned = (await markdownDirectoryProvider({ id: "legacy", root }).observe()).resources;
  assert.equal(unpinned.some(record => record.focus === "prose"), false,
    "legacy unpinned parsing still skips no-frontmatter files");
});

test("exact Markdown observation refuses oversized or non-UTF8 carriers", async t => {
  const big = Buffer.concat([office, Buffer.alloc(1_048_576, 65)]);
  const invalid = Buffer.concat([office, Buffer.from([0xc3, 0x28])]);
  const root = await fixture(t, { "big.md": big, "invalid.md": invalid });
  await assert.rejects(markdownDirectoryProvider({
    id: "oversize", root, namespace: "urn:561:colony:alpha",
    pins: [{ path: "big.md", digest: revisionOf(big) }],
  }).observe(), /file bound/);
  await assert.rejects(markdownDirectoryProvider({
    id: "malformed-utf8", root, namespace: "urn:561:colony:alpha",
    pins: [{ path: "invalid.md", digest: revisionOf(invalid) }],
  }).observe(), TypeError);
});
