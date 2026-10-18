import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { decodeJsonGraphValue, attributePredicate } from "../src/provider/attribute-projection.mjs";

const executable = fileURLToPath(new URL("../scripts/flatfile-resource-graph-cli.mjs", import.meta.url));
const at = "2026-10-17T22:45:00.000Z";
const sourceOf = (path, bytes) => ({
  path, digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
});
function fixture(t, path, record) {
  const root = mkdtempSync(join(tmpdir(), "fars-native-source-json-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n");
  writeFileSync(file, bytes);
  return { root, path, file, bytes, selection: sourceOf(path, bytes) };
}
function invoke(root, namespace, selections, extra = {}) {
  return spawnSync(process.execPath, [executable, "source-json", root, namespace, at],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024,
      input: JSON.stringify(selections), ...extra });
}
const owner = "https://github.com/causeway-services/koios-news-data";
const koios = {
  subject: "a-commercial-space-race-prompts-a-thorny-question-who-owns-the-sky",
  claims: [
    { id: "title", proposition: { predicate: "title",
        object: "A Commercial Space Race Prompts a Thorny Question: Who Owns the Sky?" },
      time: { asserted: "2026-06-16T03:57:41.229Z" }, force: "alleges",
      provenance: { witness: "collapse-climate",
        citation: "https://insideclimatenews.org/news/13062026/commercial-satellite-space-race-pollution/" },
      status: "supported" },
  ],
};
const pressure = {
  schema: "capability-pressure/v1", intendedReceiver: "Semioverse",
  demandingActor: "urn:561:office:public-publishing-services:chatgpt-web",
  evidenceAt: "2026-10-06T04:10:54Z",
  surfaces: [{surfaceId:"surface:docs",capabilityId:"document.delete_range",
    provider:"Google Docs",providerSupport:"UNKNOWN",connectorExposure:"HELD"}],
  demands: [{demandId:"cap-demand:docs",workRef:"work:publishing:sfds:citation-cleanup",
    capabilityId:"document.delete_range",state:"OPEN"}],
  syncBack: {state:"PENDING",receiver:"Semioverse"},
};

test("installed FARS CLI reads actual-shaped Koios historical claim JSON through its original typed source provider", t => {
  const x = fixture(t, "claims/collapse-climate/a-commercial-space-race-prompts-a-thorny-question-who-owns-the-sky.json", koios);
  const observed = invoke(x.root, owner, [x.selection]);
  assert.equal(observed.error, undefined);
  assert.equal(observed.status, 0, observed.stderr);
  const out = JSON.parse(observed.stdout);
  assert.deepEqual(out.providers.map(p => p.status), ["observed"]);
  assert.equal(out.resources.length, 1);
  assert.ok(out.resources[0].focus.includes(encodeURIComponent(owner)));
  assert.equal(out.cells.find(c => c.predicate === "urn:fars:source-path").object, x.path);
  const archive = out.cells.filter(c => c.predicate === attributePredicate("claims"))
    .map(c => decodeJsonGraphValue(c.object));
  assert.equal(archive.length, 1);
  assert.equal(archive[0].provenance.witness, "collapse-climate");
  assert.equal(archive[0].status, "supported");
  // An owner's historical editorial status is *data about the file*.
  assert.equal(out.cells.some(c => c.predicate === "urn:fars:claim-truth"), false);
  assert.equal(out.cells.some(c => c.predicate === "urn:fars:authorized-incumbent"), false);
  assert.equal(readFileSync(x.file).equals(x.bytes), true);
});

test("a second actual-shaped Coesite capability-demand JSON enters the same CLI without creating Work", t => {
  const x = fixture(t, "state/capability-demands/public-publishing-provider-write-surfaces-20261006.json", pressure);
  const observed = invoke(x.root,
    "https://github.com/coesite-operations/operations-services-section", [x.selection]);
  assert.equal(observed.status, 0, observed.stderr);
  const out = JSON.parse(observed.stdout);
  assert.equal(out.resources.length, 1);
  const demand = out.cells.find(c => c.predicate === attributePredicate("demands"));
  const row = decodeJsonGraphValue(demand.object);
  assert.equal(row.workRef, "work:publishing:sfds:citation-cleanup");
  assert.equal(row.state, "OPEN");
  assert.equal(out.cells.some(c => c.predicate === "urn:fars:work-opened"), false);
  assert.equal(readFileSync(x.file).equals(x.bytes), true);
});

test("wrong digest, traversal and forged owner selection refuse before emitting graph observations", t => {
  const x = fixture(t, "claims/collapse-climate/sample.json", koios);
  const inputs = [
    [ { ...x.selection, digest: "sha256:" + "0".repeat(64) } ],
    [ { path: "../outside.json", digest: x.selection.digest } ],
    [ x.selection, x.selection ],
    [ { path: "/etc/private.json", digest: x.selection.digest } ],
  ];
  for (const selections of inputs) {
    const read = invoke(x.root, owner, selections);
    assert.equal(read.status, 2, JSON.stringify(selections));
    assert.equal(read.stdout, "");
    assert.ok(read.stderr.length > 0);
  }
  const wrongNamespace = invoke(x.root, "https://untrusted.invalid/#injected", [x.selection]);
  assert.equal(wrongNamespace.status, 2);
  assert.equal(wrongNamespace.stdout, "");
  assert.equal(readFileSync(x.file).equals(x.bytes), true);
});

test("malformed, oversized or absent stdin does not become an empty successful source reading", t => {
  const x = fixture(t, "claims/collapse-climate/sample.json", koios);
  for (const input of ["", "{not json", "x".repeat(1_048_577), "[]"]) {
    const read = invoke(x.root, owner, [x.selection], { input });
    assert.equal(read.status, 2);
    assert.equal(read.stdout, "");
  }
  const malformed = invoke(x.root, owner, [x.selection], {input:"\"not-an-array\""});
  assert.equal(malformed.status, 2);
  assert.equal(malformed.stdout, "");
});

test("physical FARS CLI publishes original verbs and refuses missing source selection arguments", () => {
  const help = spawnSync(process.execPath, [executable, "--help"], {encoding:"utf8"});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /source-json <root> <owner-namespace-URI>/);
  assert.match(help.stdout, /validate <root>/);
  const noRoot = spawnSync(process.execPath, [executable, "source-json"], {
    encoding:"utf8",input:"[]",
  });
  assert.equal(noRoot.status, 2);
  assert.match(noRoot.stderr, /expected <root>/);
});
