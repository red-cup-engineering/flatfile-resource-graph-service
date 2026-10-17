import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";
import { lookWorld } from "../src/lagoon-world.mjs";
import { seedWorld } from "../src/seed-world.mjs";
import { observedStateOf, recordHostObservation } from "../src/world-observation.mjs";
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
