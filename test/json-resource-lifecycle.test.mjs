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

test("stale, foreign, symlinked, malformed and over-budget snapshots return no partial graph", async t => {
  const { root, pins } = await fixture(t);
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], digest: "sha256:" + "0".repeat(64) }] }), /digest changed/);
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], path: "../outside.json" }] }));
  await symlink(join(root, pins[0].path), join(root, "alias.json"));
  await assert.rejects(() => observeJsonResourceLifecycle({ root, namespace, observedAt: at,
    sources: [{ ...pins[0], path: "alias.json" }] }), /changes its selected path/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [{ path: "broken.json", revision: pins[0].digest, text: "{" }] }), /does not parse/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [source("huge.json", Array(4097).fill(0))] }), /4096-node/);
  assert.throws(() => analyzeJsonResourceLifecycle({ namespace, files: [source("huge-object.json", { values: Array(4097).fill(0) })] }), /4096-node/);
});
