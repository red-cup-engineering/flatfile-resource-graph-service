import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { cell, isCell, told } from "@red-cup-engineering/signcell/cell";
import { analyzeJsonResourceLifecycle, jsonSourceFocus } from "../src/provider/json-resource-lifecycle.mjs";
import { observeJsonResourceLifecycle } from "../src/adapters/json-resource-lifecycle.mjs";
import { composeProviders } from "../src/provider/compositor.mjs";
import { defineProvider } from "../src/provider/provider.mjs";
import { decodeJsonGraphValue } from "../src/provider/attribute-projection.mjs";

const namespace = "https://github.com/red-cup-engineering/example";
const at = "2026-10-27T03:00:00.000Z";
const digest = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const source = (path, value) => {
  const text = typeof value === "string" && !path.endsWith(".json") ? value : JSON.stringify(value);
  return { path, revision: digest(text), text };
};
const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://example.test/observation.schema.json",
  title: "Source observation", description: "An original source measurement.", type: "object",
  required: ["id", "val"], properties: { $schema: { type: "string" },
    id: { type: "string", title: "Observation identifier" },
    val: { type: "number", description: "Measured amount in the source's declared unit." } }, additionalProperties: false };
const document = { $schema: schema.$id, id: "sample", val: 2.75 };
const PROV = "http://www.w3.org/ns/prov#";

test("pure lifecycle refuses a falsely asserted source revision before minting any witnessed cells", () => {
  const original = source("data/observation.json", { value: 1 });
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace,
    files: [{ ...original, text: JSON.stringify({ value: 2 }) }] }), /digest differs/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace,
    files: [{ ...original, revision: "sha256:" + "0".repeat(64) }] }), /digest differs/);
});


test("exact schema receiving names short properties without rewriting standard keys or decimal JSON", () => {
  const report = analyzeJsonResourceLifecycle({ namespace, files: [source("schemas/observation.json", schema), source("data/sample.json", document)] });
  const observed = report.resources.find(row => row.sourcePath === "data/sample.json");
  assert.equal(observed.schema.status, "admitted");
  assert.equal(observed.classification, "unclaimed-in-snapshot");
  assert.ok(observed.properties.filter(row => ["id", "val"].includes(row.key)).every(row => row.documented && !row.opaqueWithoutDefinition));
  assert.ok(report.cells.every(isCell));
  assert.ok(report.cells.some(row => row.predicate === "http://purl.org/dc/terms/conformsTo"));
  const label = report.cells.find(row => row.predicate === "http://www.w3.org/2000/01/rdf-schema#label");
  assert.equal(label.for[0].schemaDeclarations[0].sourcePath, "schemas/observation.json");
  const value = report.cells.find(row => row.subject === observed.resource && row.predicate.endsWith("#value"));
  assert.equal(decodeJsonGraphValue(value.object).val, 2.75);
});

test("references and expanded PROV declarations have different, witnessed meanings", () => {
  const file = source("data/sample.json", document);
  const focus = jsonSourceFocus(namespace, file.path);
  const reference = source("src/reader.mjs", 'const future = "data/sample.json";');
  const mentioned = analyzeJsonResourceLifecycle({ namespace, files: [file, reference] });
  assert.equal(mentioned.resources[0].classification, "referenced");
  assert.equal(mentioned.resources[0].declaredConnections.length, 0);
  const declaration = source("data/lifecycle.json", { "@graph": [
    { "@id": "urn:561:processor:sample-reader", [PROV + "used"]: [{ "@id": focus }] },
    { "@id": focus, [PROV + "wasGeneratedBy"]: { "@id": "urn:561:processor:sample-writer" } },
  ] });
  const connected = analyzeJsonResourceLifecycle({ namespace, files: [file, reference, declaration] });
  const row = connected.resources.find(row => row.sourcePath === file.path);
  assert.equal(row.classification, "declared-connected");
  assert.deepEqual(row.declaredConnections.map(x => x.role).sort(), ["reader", "writer"]);
  assert.ok(row.actions.some(action => action.action === "qualify-runtime-connection"));
  const use = connected.cells.find(row => row.predicate === PROV + "used");
  assert.equal(use.for[0].interpretation, "declared-intent");
  assert.equal(use.for[0].contentDigest, declaration.revision);
  assert.equal(connected.scope.exhaustiveRepository, false);
});

test("tuple and remaining-item schema meanings retain their exact property pointers", () => {
  const declaration = { ...schema, required: ["data"], properties: { $schema: { type: "string" },
    data: { type: "array", prefixItems: [{ type: "object", properties: { id: { title: "First observation" } } }],
      items: { type: "object", properties: { id: { title: "Subsequent observation" } } } } } };
  const report = analyzeJsonResourceLifecycle({ namespace, files: [source("schema.json", declaration),
    source("sample.json", { $schema: schema.$id, data: [{ id: "a" }, { id: "b" }] })] });
  const data = report.resources.find(row => row.sourcePath === "sample.json");
  assert.equal(data.schema.status, "admitted");
  for (const [pointer, declarationPointer] of [["/data/0/id", "/properties/data/prefixItems/0/properties/id"],
    ["/data/1/id", "/properties/data/items/properties/id"]]) {
    const property = data.properties.find(row => row.pointer === pointer);
    assert.equal(property.documented, true);
    assert.equal(property.definedBy, schema.$id + "#" + encodeURIComponent(declarationPointer));
  }
});

test("invalid, ambiguous and absent schema claims never become conformance", () => {
  for (const [files, expected] of [
    [[source("bad.json", { ...document, val: "wrong" }), source("schema.json", schema)], "rejected"],
    [[source("bad.json", document)], "unresolved"],
    [[source("bad.json", document), source("schema.json", schema), source("other.json", { ...schema, required: [] })], "ambiguous"],
  ]) {
    const report = analyzeJsonResourceLifecycle({ namespace, files });
    const row = report.resources.find(row => row.sourcePath === "bad.json");
    assert.equal(row.schema.status, expected);
    assert.equal(report.cells.some(at => at.subject === row.resource && at.predicate.endsWith("/conformsTo")), false);
  }
});

test("source versions, owners, array/scalar data and property pointers remain distinct", () => {
  const files = [source("raw.json", { data: [2.75, 2.75], "a/b~c": { val: false }, "": 1, " ": 2 }), source("array.json", [1, null]), source("scalar.json", false)];
  const first = analyzeJsonResourceLifecycle({ namespace, files });
  assert.equal(first.resources.length, 3);
  const raw = first.resources.find(row => row.sourcePath === "raw.json");
  assert.ok(raw.properties.some(row => row.pointer === "/a~1b~0c/val"));
  assert.ok(raw.properties.some(row => row.pointer === "/" && row.key === ""));
  assert.ok(raw.properties.some(row => row.pointer === "/ " && row.key === " "));
  assert.ok(first.cells.some(row => row.subject === raw.resource && row.predicate === "urn:fars:attribute:"));
  assert.ok(first.cells.some(row => row.subject === raw.resource && row.predicate === "urn:fars:attribute:%20"));
  assert.ok(raw.actions.some(row => row.action === "define-property-meaning" && row.key === "data"));
  const next = analyzeJsonResourceLifecycle({ namespace, files: [source("raw.json", { data: [2.75, 3.5] })] });
  assert.equal(next.resources[0].focus, raw.focus);
  assert.notEqual(next.resources[0].resource, raw.resource);
  const foreign = analyzeJsonResourceLifecycle({ namespace: "https://github.com/561-group/example", files });
  assert.notEqual(foreign.resources[0].resource, first.resources[0].resource);
});

test("native source opposition survives and an authored unknown never gains evidence", async () => {
  const unknown = cell("unknown", "has", "value");
  const contested = cell("subject", "reports", "result", { for: [{ source: "a" }], against: [{ source: "b" }] });
  const provider = defineProvider({ id: "native", async observe() { return { resources: [
    { resource: "urn:test:source", observedAt: at, cells: [unknown, contested] },
  ] }; } });
  const result = await composeProviders([provider]);
  assert.ok(result.cells.every(isCell));
  assert.deepEqual(told(result.cells.find(row => row.subject === "unknown")), [false, false]);
  const actual = result.cells.find(row => row.subject === "subject");
  assert.deepEqual(told(actual), [true, true]);
  assert.equal(actual.for.length, 1);
  assert.equal(actual.against.length, 1);
  assert.deepEqual(actual.for[0].evidence, { source: "a" });
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "fars-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [source("data/sample.json", document), source("schemas/observation.json", schema),
    source("src/reader.mjs", '// planned input: data/sample.json')];
  for (const file of files) { const path = join(root, file.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, file.text); }
  return { root, files, pins: files.map(file => ({ path: file.path, digest: file.revision })) };
}

test("original provider and physical CLI consume the same pinned JSON/code snapshot", async t => {
  const { root, pins } = await fixture(t);
  const report = await observeJsonResourceLifecycle({ root, namespace, sources: pins, observedAt: at });
  assert.equal(report.resources.length, 2);
  assert.ok(report.cells.every(isCell));
  assert.equal(report.providers[0].status, "observed");
  const run = spawnSync(process.execPath, ["scripts/flatfile-resource-graph-cli.mjs", "source-json-lifecycle", root, namespace, at],
    { encoding: "utf8", input: JSON.stringify(pins), timeout: 30_000, maxBuffer: 4_194_304 });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.kind, "fars.json-resource-lifecycle/v1");
  assert.equal(output.resources.find(row => row.sourcePath === "data/sample.json").schema.status, "admitted");
  assert.ok(output.cells.every(isCell));
});

test("native FARS Git-tree lifecycle automatically pins and receives one committed repository lot", async t => {
  const { root } = await fixture(t);
  for (const args of [
    ["init", "-q"], ["config", "user.email", "source-test@example.invalid"],
    ["config", "user.name", "source-test"], ["add", "."], ["commit", "-qm", "Pinned source cut"],
  ]) {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const argv = ["scripts/flatfile-resource-graph-cli.mjs", "source-json-lifecycle-git", root, namespace, at];
  const received = spawnSync(process.execPath, argv, { encoding: "utf8", timeout: 30_000, maxBuffer: 4_194_304 });
  assert.equal(received.status, 0, received.stderr);
  const report = JSON.parse(received.stdout);
  assert.equal(report.kind, "fars.json-resource-lifecycle/v1");
  assert.equal(report.resources.length, 2);
  assert.ok(report.cells.every(isCell));
  await writeFile(join(root, "src/reader.mjs"), "// edited after the source commit\n");
  const refused = spawnSync(process.execPath, argv, { encoding: "utf8", timeout: 30_000 });
  assert.equal(refused.status, 2);
  assert.equal(refused.stdout, "");
  assert.match(refused.stderr, /differs from immutable HEAD/);
});

test("stale, foreign, symlinked, malformed and over-budget snapshots return no partial graph", async t => {
  const { root, pins } = await fixture(t);
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], digest: "sha256:" + "0".repeat(64) }] }), /digest changed/);
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], path: "../outside.json" }] }));
  await symlink(join(root, pins[0].path), join(root, "alias.json"));
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], path: "alias.json" }] }), /changes its selected path/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [{ path: "broken.json", revision: digest("{"), text: "{" }] }), /does not parse/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [source("huge.json", Array(4097).fill(0))] }), /4096-node/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [source("huge-object.json", { values: Array(4097).fill(0) })] }), /4096-node/);
});

test("exact JSON-LD source and expanded PROV use flow through the native lifecycle and provider", async t => {
  const root = await mkdtemp(join(tmpdir(), "fars-jsonld-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = source("data/resource.jsonld", { id: "source-observation" });
  const focus = jsonSourceFocus(namespace, data.path);
  const expanded = source("data/relations.jsonld", {
    "@context": { "prov": PROV },
    "@graph": [{
      "@id": "urn:561:reader:observed",
      [PROV + "used"]: { "@id": focus }
    }]
  });
  const lot = [data, expanded];
  for (const item of lot) {
    const path = join(root, item.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, item.text);
  }
  const report = await observeJsonResourceLifecycle({
    root, namespace, sources: lot.map(row => ({ path: row.path, digest: row.revision })),
    observedAt: at,
  });
  assert.equal(report.resources.length, 2);
  const target = report.resources.find(row => row.sourcePath === data.path);
  assert.equal(target.classification, "declared-connected");
  assert.deepEqual(target.declaredConnections.map(row => row.role), ["reader"]);
  const relation = report.cells.find(row => row.predicate === PROV + "used");
  assert.ok(relation);
  assert.equal(relation.for[0].interpretation, "declared-intent");
  assert.equal(relation.for[0].sourcePath, expanded.path);
  assert.equal(relation.for[0].contentDigest, expanded.revision);

  const compact = source("data/compact.jsonld", {
    "@context": { "prov": PROV },
    "@graph": [{
      "@id": "urn:561:reader:unqualified",
      "prov:used": { "@id": focus }
    }]
  });
  const notExpanded = analyzeJsonResourceLifecycle({ namespace, files: [data, compact] });
  const original = notExpanded.resources.find(row => row.sourcePath === data.path);
  assert.equal(original.classification, "unclaimed-in-snapshot");
  assert.equal(original.declaredConnections.length, 0,
    "a compact IRI cannot be inferred from an unprocessed JSON-LD context");
  assert.ok(notExpanded.resources.some(row => row.sourcePath === compact.path));
});

test("Git and physical FARS snapshots include JSONL, TSX and Python source references without claiming execution", async t => {
  const { root, pins } = await fixture(t);
  const additional = [
    source("state/observations.jsonl", '{"source":"data/sample.json","kind":"event"}' + String.fromCharCode(10)),
    source("src/consumer.tsx", 'export const path = "data/sample.json";'),
    source("scripts/consumer.py", 'record_path = "data/sample.json"'),
  ];
  for (const item of additional) {
    const location = join(root, item.path);
    await mkdir(dirname(location), { recursive: true });
    await writeFile(location, item.text);
  }
  const report = await observeJsonResourceLifecycle({
    root, namespace, observedAt: at,
    sources: [...pins, ...additional.map(item => ({ path: item.path, digest: item.revision }))],
  });
  const resource = report.resources.find(item => item.sourcePath === "data/sample.json");
  for (const item of additional) {
    const mention = resource.references.find(reference => reference.sourcePath === item.path);
    assert.ok(mention, "each source language must be retained as a candidate reader or writer");
    assert.equal(mention.kind, "text-reference");
    assert.equal(mention.contentDigest, item.revision);
  }
  assert.equal(resource.classification, "referenced");
  assert.ok(resource.actions.some(action => action.action === "qualify-runtime-connection"));
  assert.equal(report.resources.some(item => item.sourcePath.endsWith(".jsonl")), false,
    "JSONL is source evidence, not an invented single JSON value");
  assert.ok(report.cells.every(isCell));
});
