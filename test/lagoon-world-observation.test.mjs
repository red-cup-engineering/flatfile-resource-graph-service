import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";
import { lookWorld } from "../src/lagoon-world.mjs";
import { seedWorld } from "../src/seed-world.mjs";
import { observedStateOf, observedStatesIndex, recordHostObservation } from "../src/world-observation.mjs";
import * as verbs from "../scripts/flatfile-world-verbs.mjs";

const GEN_A = "/gnu/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-cold-red-gate-release";
const GEN_B = "/gnu/store/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-cold-red-gate-release";
const status = (generation, state, history = []) => ({
  host: "cold-red-gate", profile: "/var/guix/profiles/per-user/emsenn/cold-red-gate-release", link: "cold-red-gate-release-3-link",
  live: { generation, compositionCommit: "c".repeat(40), hostCommit: "d".repeat(40), actor: "emsenn", builder: "bare-cedar-fog", at: "2026-10-17T01:00:00.000Z" },
  units: [{ unit: "relay.service", state }],
  history,
  disk: { size: 1000, avail: 250, freePercent: 25 },
});
const withTrace = (body) => {
  const dir = mkdtempSync(path.join(tmpdir(), "world-observation-"));
  try { return body(path.join(dir, "world.eavt"), dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test("seed-world constitutes a record's entities once and is idempotent", () => withTrace((trace, dir) => {
  const record = { measuredAt: "2026-08-30", entities: [{ kind: "machine", attributes: { name: "cold-red-gate" } }, { kind: "machine", attributes: { name: "bare-cedar-fog" } }] };
  assert.deepEqual(seedWorld({ path: trace, record }).map((r) => r.skipped), [false, false]);
  assert.deepEqual(seedWorld({ path: trace, record }).map((r) => r.skipped), [true, true]);
  assert.equal(readEavtEntries({ path: trace }).length, 2);
  assert.throws(() => seedWorld({ path: trace, record: { measuredAt: "nope", entities: [] } }), /measuredAt/);
  const file = path.join(dir, "record.json");
  writeFileSync(file, JSON.stringify(record));
  assert.deepEqual(verbs["seed-world"]({ path: trace, recordPath: file }).results.map((r) => r.skipped), [true, true]);
  assert.throws(() => verbs["seed-world"]({ path: trace }), /exactly one/);
}));

test("a recorded observation is what look answers from, with history kept and nothing overwritten", () => withTrace((trace) => {
  const [{ address: seeded }] = seedWorld({ path: trace, record: { measuredAt: "2026-08-30", entities: [{ kind: "machine", attributes: { name: "cold-red-gate", kind: "vps" } }] } });
  const attempt = { at: "2026-10-17T00:59:00.000Z", actor: "emsenn", outcome: "received", generation: GEN_A, compositionCommit: "c".repeat(40) };
  const first = recordHostObservation({ path: trace, status: status(GEN_A, "active", [attempt]), t: 1000, observer: "test" });
  assert.equal(first.units, 1);
  assert.equal(first.attempts, 1);
  recordHostObservation({ path: trace, status: status(GEN_A, "active", [attempt]), t: 2000, observer: "test" });
  const third = recordHostObservation({ path: trace, status: status(GEN_B, "failed", [attempt]), t: 3000, observer: "test" });
  assert.equal(third.attempts, 0, "a release attempt already recorded is not recorded twice");

  const looked = lookWorld(trace, "cold-red-gate");
  assert.equal(first.host, seeded, "the observation attaches to the seeded machine, not a second entity");
  assert.equal(looked.address, seeded);
  assert.equal(looked.placeObserved["live-generation"].value, third.generation);
  assert.equal(looked.placeObserved["store-free-percent"].value, 25);
  const unit = looked.things.find((thing) => thing.attributes.name === "relay.service");
  assert.deepEqual(unit.observed.state, { value: "failed", t: 3000, since: 3000 });
  const generations = looked.things.filter((thing) => thing.address.startsWith("generation:"));
  assert.equal(generations.length, 2);
  assert.ok(generations.some((g) => g.fiber.some((cell) => cell.predicate === "promoted-by" && cell.object === "emsenn")));
  const release = looked.things.find((thing) => thing.address.startsWith("release-attempt:"));
  assert.equal(release.attributes.outcome, "received");
  assert.equal(release.attributes.actor, "emsenn");

  // history is still in the trace: both states, each with its own t.
  const rows = readEavtEntries({ path: trace });
  assert.deepEqual(rows.filter((r) => r.e === unit.address && r.a === "state").map((r) => [r.v, r.t]), [["active", 1000], ["active", 2000], ["failed", 3000]]);
  assert.equal(observedStateOf(rows, unit.address).state.since, 3000);
}));

test("a unit that disappears from the observation is recorded as not-observed, not forgotten", () => withTrace((trace) => {
  recordHostObservation({ path: trace, status: status(GEN_A, "active"), t: 1000 });
  recordHostObservation({ path: trace, status: { ...status(GEN_A, "active"), units: [] }, t: 2000 });
  const unit = lookWorld(trace, "cold-red-gate").things.find((thing) => thing.attributes.name === "relay.service");
  assert.equal(unit.observed.state.value, "not-observed");
}));

test("the record-host-observation verb carries the schema name and refuses a status without a host", () => withTrace((trace) => {
  const answered = verbs["record-host-observation"]({ path: trace, status: status(GEN_A, "active"), t: 5 });
  assert.equal(answered.schema, "lagoon-observation/1");
  assert.throws(() => verbs["record-host-observation"]({ path: trace, status: {}, t: 5 }), /host/);
  assert.equal(JSON.stringify(verbs["record-host-observation"].spec.args.required), '["path","status","t"]');
  assert.ok(readFileSync(trace, "utf8").length > 0);
}));

test("migrate-legacy-world carries base64-CBOR rows into the current encoding unchanged, once", async () => {
  const { encodeCanonical } = await import("@red-cup-engineering/cbor-services-section");
  return withTrace((trace, dir) => {
    const legacy = path.join(dir, "legacy.eavt");
    const rows = [
      { a: "constituted", e: "machine:legacy-address", t: 1788048000000, v: { kind: "vps", name: "cold-red-gate" } },
      { a: "located-in", e: "workbench:legacy-bench", t: 1788048000005, v: "machine:legacy-address" },
    ];
    writeFileSync(legacy, `${rows.map((row) => Buffer.from(encodeCanonical(row)).toString("base64")).join("\n")}\n`);
    assert.equal(readEavtEntries({ path: legacy }).length, 0, "the current reader cannot see the legacy encoding");
    const first = verbs["migrate-legacy-world"]({ from: legacy, path: trace });
    assert.deepEqual([first.read, first.appended, first.skipped, first.refused.length], [2, 2, 0, 0]);
    assert.deepEqual(readEavtEntries({ path: trace }).map(({ e, a, v, t }) => ({ a, e, t, v })), rows);
    assert.deepEqual(verbs["migrate-legacy-world"]({ from: legacy, path: trace }), { read: 2, appended: 0, skipped: 2, refused: [] });
    // the migrated machine is the one an observation attaches to and look finds by name
    const observed = recordHostObservation({ path: trace, status: status(GEN_A, "active"), t: 9 });
    assert.equal(observed.host, "machine:legacy-address");
    assert.equal(lookWorld(trace, "cold-red-gate").address, "machine:legacy-address");
    assert.throws(() => verbs["migrate-legacy-world"]({ from: legacy, path: legacy }), /must differ/);
  });
});

test("native held-unit markers become their original World Things without asserting service or Work state", () => withTrace(trace => {
  const observed = { ...status(GEN_A, "inactive"),
    holds: [{ unit: "relay.service", markerPresent: true },
      { unit: "held-only.service", markerPresent: true }],
    holdInventoryComplete: true };
  const result = recordHostObservation({ path: trace, status: observed, t: 1000 });
  assert.equal(result.units, 1, "a marker is not an observed systemd unit");
  const world = lookWorld(trace, "cold-red-gate");
  assert.equal(world.placeObserved["hold-inventory-complete"].value, true);
  const relay = world.things.find(item => item.attributes.name === "relay.service");
  assert.equal(relay.observed.state.value, "inactive");
  assert.equal(relay.observed["admission-hold-marker"].value, "present");
  const hidden = world.things.find(item => item.attributes.name === "held-only.service");
  assert.equal(hidden.observed.state.value, "not-observed");
  assert.equal(hidden.observed["admission-hold-marker"].value, "present");
  assert.equal(hidden.observed["runs-generation"], undefined,
    "a held-only service has no observed running generation");
}));

test("incomplete and legacy inventory never silently clear or preserve a stale held observation", () => withTrace(trace => {
  const base = status(GEN_A, "active");
  const withHolds = (time, holds, complete) => recordHostObservation({
    path: trace, t: time,
    status: { ...base, units: [], holds: holds.map(unit => ({ unit, markerPresent: true })),
      holdInventoryComplete: complete },
  });
  withHolds(1000, ["alpha.service", "beta.service"], true);
  withHolds(2000, ["alpha.service"], false);
  let observed = lookWorld(trace, "cold-red-gate");
  assert.equal(observed.placeObserved["hold-inventory-complete"].value, false);
  assert.equal(observed.things.find(x => x.attributes.name === "alpha.service")
    .observed["admission-hold-marker"].value, "present");
  assert.equal(observed.things.find(x => x.attributes.name === "beta.service")
    .observed["admission-hold-marker"].value, "unknown");
  withHolds(3000, [], true);
  observed = lookWorld(trace, "cold-red-gate");
  for (const name of ["alpha.service", "beta.service"])
    assert.equal(observed.things.find(x => x.attributes.name === name)
      .observed["admission-hold-marker"].value, "absent");
  assert.equal(observed.placeObserved["hold-inventory-complete"].value, true);
  recordHostObservation({ path: trace, status: { ...base, units: [] }, t: 4000 });
  observed = lookWorld(trace, "cold-red-gate");
  assert.equal(observed.placeObserved["hold-inventory-complete"].value, "unknown");
  for (const name of ["alpha.service", "beta.service"])
    assert.equal(observed.things.find(x => x.attributes.name === name)
      .observed["admission-hold-marker"].value, "unknown");
  const rows = readEavtEntries({ path: trace });
  const alpha = observed.things.find(x => x.attributes.name === "alpha.service").address;
  assert.deepEqual(rows.filter(row => row.e === alpha && row.a === "admission-hold-marker")
    .map(row => [row.v, row.t]), [
      ["present", 1000], ["present", 2000], ["absent", 3000], ["unknown", 4000],
    ]);
}));

test("invalid or unqualified hold observations refuse before appending world facts", () => withTrace(trace => {
  const base = status(GEN_A, "active");
  const invalid = [
    { holds: [{ unit: "alpha.service", markerPresent: true }] },
    { holdInventoryComplete: true },
    { holdInventoryComplete: true, holds: null },
    { holdInventoryComplete: true, holds: [{ unit: ["alpha.service"], markerPresent: true }] },
    { holdInventoryComplete: "true", holds: [] },
    { holdInventoryComplete: false, holds: "alpha.service" },
    { holdInventoryComplete: true, holds: [{ unit: "../wrong.service", markerPresent: true }] },
    { holdInventoryComplete: true, holds: [{ unit: "alpha.service", markerPresent: false }] },
    { holdInventoryComplete: true, holds: [
      { unit: "alpha.service", markerPresent: true }, { unit: "alpha.service", markerPresent: true },
    ] },
    { holdInventoryComplete: false, holds: Array.from({ length: 257 }, (_, i) => ({
      unit: "unit" + i + ".service", markerPresent: true,
    })) },
  ];
  for (const [i, extra] of invalid.entries()) {
    assert.throws(() => recordHostObservation({
      path: trace, status: { ...base, ...extra }, t: i + 1,
    }), /hold inventory/);
    assert.equal(readEavtEntries({ path: trace }).length, 0,
      "malformed hold observations cannot create partial World records");
  }
}));

test("one-pass observation index exactly matches individual EAVT observation folds", () => {
  const rows = [];
  for (let i = 0; i < 160; i++) {
    const e = `unit:unit-${i}`;
    // Intentionally write one old observation after a new one: the current
    // value must be time-ordered, not last-written or guessed from a marker.
    rows.push(
      { e, a: "state", v: "active", t: 100 },
      { e, a: "state", v: "failed", t: 300 },
      { e, a: "state", v: "inactive", t: 200 },
      { e, a: "admission-hold-marker", v: "present", t: 100 },
      { e, a: "admission-hold-marker", v: "unknown", t: 300 },
      { e, a: "admission-hold-marker", v: "present", t: 200 },
      { e, a: "not-an-observed-attribute", v: 5, t: 301 },
    );
  }
  const host = "machine:host";
  rows.push(
    { e: host, a: "hold-inventory-complete", v: false, t: 100 },
    { e: host, a: "hold-inventory-complete", v: true, t: 200 },
    { e: host, a: "hold-inventory-complete", v: "unknown", t: 300 },
    { e: host, a: "hold-inventory-complete", v: false, t: 300 },
  );
  const indexed = observedStatesIndex(rows);
  assert.equal(indexed.size, 161, "only observed Things receive projected state");
  for (let i = 0; i < 160; i++) {
    const e = `unit:unit-${i}`;
    assert.deepEqual(indexed.get(e), observedStateOf(rows, e));
    assert.equal(indexed.get(e).state.value, "failed");
    assert.equal(indexed.get(e)["admission-hold-marker"].value, "unknown");
    assert.equal(indexed.get(e)["not-an-observed-attribute"], undefined);
  }
  assert.deepEqual(indexed.get(host), observedStateOf(rows, host));
  assert.equal(indexed.get(host)["hold-inventory-complete"].value, false,
    "a later row at identical time must prevail");
  assert.equal(indexed.has("unit:unseen"), false);
});

test("whole-world readout preserves exact independent observation states after held-unit changes", () => withTrace(trace => {
  const base = status(GEN_A, "inactive");
  recordHostObservation({ path: trace, status: {
    ...base, holdInventoryComplete: false,
    holds: [{ unit: "held-only.service", markerPresent: true }],
  }, t: 1000, observer: "reader" });
  recordHostObservation({ path: trace, status: {
    ...base, units: [], holdInventoryComplete: true, holds: [],
  }, t: 2000, observer: "reader" });
  const world = lookWorld(trace, "cold-red-gate");
  const rows = readEavtEntries({ path: trace }, { strict: true });
  assert.deepEqual(world.placeObserved, observedStateOf(rows, world.address));
  for (const thing of world.things)
    assert.deepEqual(thing.observed, observedStateOf(rows, thing.address));
  const held = world.things.find(thing => thing.attributes.name === "held-only.service");
  assert.equal(held.observed["admission-hold-marker"].value, "absent");
  assert.equal(held.observed.state.value, "not-observed");
}));
