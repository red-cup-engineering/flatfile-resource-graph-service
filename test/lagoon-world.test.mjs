// Ported from @red-cup-engineering/lagoon 0.2.2's test/world-look, world-go and world-say tests onto
// this package's lagoon-world (the owner of look, go and say), against synthetic traces in a tmp dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { constitute } from "@red-cup-engineering/eavt-services-section/constitute-entity";
import { appendEavtRow } from "@red-cup-engineering/eavt-services-section/append-eavt-row";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";
import { foldEavtEvidence } from "@red-cup-engineering/eavt-services-section/fold-eavt-evidence";
import { relateEavtRows } from "@red-cup-engineering/eavt-services-section/relate-eavt-rows";
import { lookWorld, moveInWorld, speakInWorld } from "../src/lagoon-world.mjs";

function withTrace(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "lagoon-world-test-"));
  try { return fn(path.join(dir, "world.eavt")); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const put = (trace, kind, attributes, t) => {
  const made = constitute({ kind, attributes, t });
  appendEavtRow({ path: trace, row: made.genesis });
  return made;
};
const row = (trace, e, a, v, t) => appendEavtRow({ path: trace, row: { e, a, v, t } });

// One machine, two systemd-service things located in it, a (running has-converse stopped)
// declaration; service-one told only "running", service-two told both (the genuine told-both).
function buildTrace(trace) {
  const machine = put(trace, "machine", { name: "test-machine" }, 1000);
  const one = put(trace, "systemd-service", { name: "test-service-one" }, 1001);
  const two = put(trace, "systemd-service", { name: "test-service-two" }, 1002);
  row(trace, "running", "has-converse", "stopped", 1000);
  row(trace, one.address, "located-in", machine.address, 1001);
  row(trace, two.address, "located-in", machine.address, 1002);
  row(trace, one.address, "running", "yes", 1001);
  row(trace, two.address, "running", "yes", 1002);
  row(trace, two.address, "stopped", "yes", 1003);
  return { machine, one, two };
}
const cellOf = (trace, address) => lookWorld(trace, "test-machine").things.find((t) => t.address === address).fiber.find((c) => c.predicate === "running" && c.object === "yes");

test("look finds the place and its located-in things", () => withTrace((trace) => {
  const { machine, one, two } = buildTrace(trace);
  const result = lookWorld(trace, "test-machine");
  assert.equal(result.address, machine.address);
  assert.deepEqual(result.placeAttributes, { name: "test-machine" });
  assert.deepEqual(result.things.map((t) => t.address).sort(), [one.address, two.address].sort());
}));

test("a service told only 'running' reads affirmed; one told both reads a held told-both", () => withTrace((trace) => {
  const { one, two } = buildTrace(trace);
  assert.deepEqual([cellOf(trace, one.address).value.pos, cellOf(trace, one.address).value.neg], [1, 0]);
  assert.deepEqual([cellOf(trace, two.address).value.pos, cellOf(trace, two.address).value.neg], [1, 1]);
}));

test("look of a place that was never constituted answers nulls and no things", () => withTrace((trace) => {
  buildTrace(trace);
  const result = lookWorld(trace, "no-such-place");
  assert.equal(result.address, null);
  assert.equal(result.placeAttributes, null);
  assert.deepEqual([...result.things], []);
}));

test("recentDuties lists reported-at entities newest-first, capped, apart from things", () => withTrace((trace) => {
  const { machine } = buildTrace(trace);
  const early = put(trace, "duty", { activity: "skill-selected", name: "early" }, 5000);
  const late = put(trace, "duty", { activity: "skill-selected", name: "late" }, 6000);
  row(trace, early.address, "reported-at", machine.address, 5000);
  row(trace, late.address, "reported-at", machine.address, 6000);
  const result = lookWorld(trace, "test-machine");
  assert.equal(result.things.length, 2);
  assert.deepEqual(result.recentDuties.map((d) => d.address), [late.address, early.address]);
  assert.deepEqual(lookWorld(trace, "test-machine", { recentDutyLimit: 1 }).recentDuties.map((d) => d.address), [late.address]);
}));

test("a retraction tombstone resolves a held told-both, and a fresh assertion re-raises it", () => withTrace((trace) => {
  const { two } = buildTrace(trace);
  assert.equal(cellOf(trace, two.address).value.neg, 1);
  row(trace, two.address, "stopped", null, 2000);
  assert.equal(cellOf(trace, two.address).value.neg, 0);
  row(trace, two.address, "stopped", "yes", 3000);
  assert.equal(cellOf(trace, two.address).value.neg, 1);
}));

function seedPlaces(trace) {
  return { riverbed: put(trace, "place", { name: "riverbed" }, 1), meadow: put(trace, "place", { name: "meadow" }, 2), pebble: put(trace, "thing", { name: "pebble" }, 3) };
}

test("go appends a located-in row naming the destination's resolved address, and never edits a prior one", () => withTrace((trace) => {
  const { riverbed, meadow, pebble } = seedPlaces(trace);
  const first = moveInWorld(trace, pebble.address, "riverbed", 10);
  assert.deepEqual(first.row, { e: pebble.address, a: "located-in", v: riverbed.address, t: 10 });
  moveInWorld(trace, pebble.address, "meadow", 11);
  const witnessed = readEavtEntries({ path: trace }).filter((r) => r.e === pebble.address && r.a === "located-in");
  assert.deepEqual(witnessed.map((r) => r.v), [riverbed.address, meadow.address], "both witnesses remain, append-only");
  assert.deepEqual(relateEavtRows({ rows: readEavtEntries({ path: trace }), predicate: "located-in", object: meadow.address }).subjects, [pebble.address]);
}));

test("go to a place never constituted throws", () => withTrace((trace) => {
  const { pebble } = seedPlaces(trace);
  assert.throws(() => moveInWorld(trace, pebble.address, "no-such-place", 10), TypeError);
}));

test("say constitutes an utterance attributed to its speaker and place, three rows in one call", () => withTrace((trace) => {
  const { riverbed } = seedPlaces(trace);
  const speaker = put(trace, "session", { name: "test-session" }, 4);
  const before = readEavtEntries({ path: trace }).length;
  const said = speakInWorld(trace, speaker.address, "riverbed", "hello", 10);
  assert.ok(said.address.startsWith("utterance:"));
  assert.deepEqual(said.genesisRow.v, { text: "hello" });
  assert.deepEqual(said.spokenByRow, { e: said.address, a: "spoken-by", v: speaker.address, t: 10 });
  assert.deepEqual(said.spokenAtRow, { e: said.address, a: "spoken-at", v: riverbed.address, t: 10 });
  assert.equal(readEavtEntries({ path: trace }).length - before, 3);
  const folded = foldEavtEvidence({ subject: said.address, rows: readEavtEntries({ path: trace }) });
  assert.equal(folded.fiber.find((c) => c.predicate === "spoken-by").object, speaker.address);
  assert.throws(() => speakInWorld(trace, speaker.address, "no-such-place", "hello", 11), TypeError);
}));

test("a world file in the legacy row encoding is refused, not read as an empty world", () => withTrace((trace) => {
  writeFileSync(trace, "pGFhaWNvbnN0aXR1dGVkYWVpbWFjaGluZTp4YXQBYXalZG5hbWVhbQ==\n");
  assert.throws(() => lookWorld(trace, "anything"), /unreadable line.*legacy base64/u);
  assert.throws(() => moveInWorld(trace, "thing:x", "anything", 1), /unreadable line/u);
}));
