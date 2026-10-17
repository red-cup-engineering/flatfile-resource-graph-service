import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { markdownDirectoryProvider } from "../src/adapters/markdown-directory.mjs";
import { composeProviders, queryRelations } from "../src/provider/compositor.mjs";
import { attributePredicate } from "../src/provider/attribute-projection.mjs";

const note = (name, relation = "") => `---
kind: office
name: ${name}
${relation}---
This office serves ${name}.
`;
async function fixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), "fars-colony-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), bytes);
  }
  return root;
}
const pin = (resource, predicate) => resource.cells.find(c => c.predicate === predicate)?.object;

test("independent colonies' identical office flatfiles do not alias graph identities", async t => {
  const relative = "governance/offices/lead.md";
  const text = note("Leader");
  const alpha = await fixture(t, { [relative]: text });
  const beta = await fixture(t, { [relative]: text });
  const providers = [
    markdownDirectoryProvider({ id: "alpha", root: alpha, namespace: "urn:561:colony:alpha" }),
    markdownDirectoryProvider({ id: "beta", root: beta, namespace: "urn:561:colony:beta" }),
  ];
  const observed = await Promise.all(providers.map(p => p.observe({ observedAt: "2026-10-16T22:00:00Z" })));
  const [a,b] = observed.map(x => x.resources[0]);
  assert.notEqual(a.resource, b.resource);
  assert.notEqual(a.focus, b.focus);
  assert.equal(pin(a, "urn:fars:source-revision"), pin(b, "urn:fars:source-revision"));
  assert.equal(pin(a, "urn:fars:source-revision"),
    "sha256:" + createHash("sha256").update(text).digest("hex"));
  assert.equal(a.cells.some(c => c.subject === "lead" && c.predicate === attributePredicate("name")), false);
  const composed = await composeProviders(providers);
  assert.deepEqual(composed.providers.map(p => p.status), ["observed", "observed"]);
  assert.equal(queryRelations(composed, { predicate: attributePredicate("name") }).length, 2);
});

test("a documentary link belongs only to the exact revision that asserted it", async t => {
  const path = "offices/lead.md";
  const before = note("Lead", "depends-on: [assessment]\n");
  const root = await fixture(t, {
    [path]: before,
    "offices/assessment.md": note("Assessment"),
  });
  const provider = markdownDirectoryProvider({ id: "alpha", root, namespace: "urn:561:colony:alpha" });
  const initial = (await provider.observe()).resources;
  const lead = initial.find(r => pin(r, "urn:fars:path") === path);
  const target = initial.find(r => pin(r, "urn:fars:path") === "offices/assessment.md");
  const link = lead.cells.find(c => c.predicate === "depends-on");
  assert.equal(link.subject, lead.resource);
  assert.equal(link.object, target.focus);
  assert.deepEqual(lead.diagnostics, []);
  await writeFile(join(root, path), note("Lead"));
  const later = (await provider.observe()).resources.find(r => r.focus === lead.focus);
  assert.notEqual(later.resource, lead.resource);
  assert.equal(later.cells.some(c => c.predicate === "depends-on"), false);
  assert.equal(lead.cells.some(c => c.predicate === "depends-on" && c.subject === later.resource), false);
});
