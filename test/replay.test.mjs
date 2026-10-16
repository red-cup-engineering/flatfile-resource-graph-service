import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { appendEavtEntries } from "@red-cup-engineering/eavt-services-section/append-eavt-entries";
import { normalizeSeavtRow } from "@red-cup-engineering/semiotic-eavt-services-section/normalize-seavt-row";
import { seavtOfJson } from "@red-cup-engineering/semiotic-eavt-services-section/admit-seavt-row";
import { identity } from "../src/kernel/identity.mjs";
import { putRecord } from "../src/kernel/record-store.mjs";
import { replayEventLog } from "../src/kernel/replay.mjs";
import { makeWitness } from "../src/kernel/witness.mjs";

const witnessOf = (target, timestamp) => makeWitness({
  operator: "fm_add", target, before_digest: null, after_digest: identity({ target, timestamp }), details: {},
  agent: "replay-test", timestamp, kind: "mutation", four_before: [false, false], four_after: [true, false], channel: "substrate",
});

test("replay reads witnesses journaled as semiotic-eavt rows, and plain rows written before", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "fars-replay-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const encoded = witnessOf("concepts/alpha.md", "2026-08-19T00:00:00Z");
  appendEavtEntries({ root, feed: "substrate", entries: [normalizeSeavtRow(seavtOfJson(encoded.target, encoded.operator, encoded.id, encoded.timestamp))], at: encoded.timestamp });
  putRecord(root, encoded);
  const plain = witnessOf("concepts/beta.md", "2026-08-19T00:00:01Z");
  appendEavtEntries({ root, feed: "substrate", entries: [{ e: plain.target, a: plain.operator, v: plain.id, t: plain.timestamp }], at: plain.timestamp });
  putRecord(root, plain);
  const state = replayEventLog(root);
  assert.deepEqual(Object.keys(state.witnesses).sort(), [encoded.id, plain.id].sort());
  assert.deepEqual(Object.keys(state.belief).sort(), ["concepts/alpha.md", "concepts/beta.md"]);
});
