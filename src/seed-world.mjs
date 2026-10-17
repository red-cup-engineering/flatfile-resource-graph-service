// seed-world — constitutes the world's first born entities (machines, platforms, places) from a
// dated record. Revived from @red-cup-engineering/lagoon 0.2.2's scripts/seed-world.mjs into the
// package that owns the Flatfile EAVT world (./lagoon-world), so seeding, look, go and say live
// beside one another and any caller reaches it as a verb (./flatfile-world-verbs `seed-world`).
//
// The record is `{ measuredAt, entities: [{ kind, attributes }, ...] }`, owned by whichever section
// measured the facts; this module invents no fact, it only constitutes them. t is deterministic:
// the record's own measuredAt (UTC) plus the entry's index, so the same record always derives the
// same addresses (t feeds the genesis row's content address). Idempotent: an entry whose derived
// address already carries a `constituted` row is skipped, so re-seeding never duplicates rows.

import { readFileSync } from "node:fs";
import { constitute } from "@red-cup-engineering/eavt-services-section/constitute-entity";
import { appendEavtRow } from "@red-cup-engineering/eavt-services-section/append-eavt-row";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";

/** Read and shape-check a world record from disk. */
export function readWorldRecord(recordPath) {
  return assertWorldRecord(JSON.parse(readFileSync(recordPath, "utf8")), recordPath);
}

export function assertWorldRecord(record, source = "record") {
  if (record === null || typeof record !== "object" || !Array.isArray(record.entities)) {
    throw new TypeError(`seed-world: ${source} has no "entities" array`);
  }
  if (Number.isNaN(Date.parse(record.measuredAt))) {
    throw new TypeError(`seed-world: ${source}.measuredAt is not a parseable date: ${JSON.stringify(record.measuredAt)}`);
  }
  record.entities.forEach((entry, index) => {
    if (entry === null || typeof entry !== "object" || typeof entry.kind !== "string" || entry.attributes === null || typeof entry.attributes !== "object" || Array.isArray(entry.attributes)) {
      throw new TypeError(`seed-world: ${source}.entities[${index}] needs a string kind and an attributes object`);
    }
  });
  return record;
}

/**
 * Constitute every entity of `record` into the trace at `path` (created if missing).
 * @returns {Array<{address: string, skipped: boolean}>} one entry per record entity, in order.
 */
export function seedWorld({ path, record }) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("seed-world: path must be a non-empty string");
  assertWorldRecord(record);
  let already;
  try {
    already = new Set(readEavtEntries({ path }, { strict: true }).filter((row) => row.a === "constituted").map((row) => row.e));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    already = new Set();
  }
  const baseT = Date.parse(record.measuredAt);
  return record.entities.map((entry, index) => {
    const { address, genesis } = constitute({ kind: entry.kind, attributes: entry.attributes, t: baseT + index });
    if (already.has(address)) return { address, skipped: true };
    appendEavtRow({ path, row: genesis });
    already.add(address);
    return { address, skipped: false };
  });
}
