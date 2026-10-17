// legacy-world — carries a world trace written in the old row encoding into the current one.
//
// Worlds seeded before eavt-services-section moved to canonical JSON rows were written one row per
// line as base64 of canonical CBOR ({a, e, t, v}). The current reader recovers only JSON rows and
// silently skips the rest, so such a file reads as an empty world and a fresh seed beside it makes
// a second, disconnected one. This reads the old lines and appends each as a current row, keeping
// e, a, v and t exactly: every entity address (including the old `<kind>:<digest>` ones) stays the
// same opaque string, so every reference between rows still resolves. The source file is read,
// never modified. Idempotent: a row already present (same e, a, v, t) in the target is not
// appended again.

import { readFileSync, existsSync } from "node:fs";
import { decodeCanonical } from "@red-cup-engineering/cbor-services-section";
import { appendEavtRow } from "@red-cup-engineering/eavt-services-section/append-eavt-row";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";

const key = (row) => JSON.stringify([row.e, row.a, row.v, row.t]);

/**
 * @param {{from: string, path: string}} input from: the legacy file; path: the current-encoding trace to append to
 * @returns {{read: number, appended: number, skipped: number, refused: Array<{line: number, because: string}>}}
 */
export function migrateLegacyWorld({ from, path }) {
  if (typeof from !== "string" || typeof path !== "string" || from === "" || path === "") throw new TypeError("migrate-legacy-world: from and path must be non-empty strings");
  if (from === path) throw new TypeError("migrate-legacy-world: from and path must differ; the legacy file is never rewritten");
  const present = new Set(existsSync(path) ? readEavtEntries({ path }, { strict: true }).map(key) : []);
  const lines = readFileSync(from, "utf8").split("\n").filter((line) => line !== "");
  const result = { read: lines.length, appended: 0, skipped: 0, refused: [] };
  lines.forEach((line, index) => {
    try {
      const { e, a, v, t } = decodeCanonical(Buffer.from(line, "base64"));
      const row = { e, a, v, t };
      if (present.has(key(row))) { result.skipped += 1; return; }
      appendEavtRow({ path, row });
      present.add(key(row));
      result.appended += 1;
    } catch (error) {
      result.refused.push({ line: index + 1, because: String(error?.message ?? error) });
    }
  });
  return result;
}
