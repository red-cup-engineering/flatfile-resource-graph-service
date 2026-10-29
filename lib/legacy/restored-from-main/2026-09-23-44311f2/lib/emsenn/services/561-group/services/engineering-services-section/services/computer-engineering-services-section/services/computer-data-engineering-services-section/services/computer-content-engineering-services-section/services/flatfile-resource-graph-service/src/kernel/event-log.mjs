import { appendEavtEntries } from "@red-cup-engineering/eavt/append-eavt-entries";
import { readEavtJournal } from "@red-cup-engineering/eavt/read-eavt-journal";
import { journalPath } from "@red-cup-engineering/eavt/journal-path";

// appendSeavt stays a direct, unchanged composition: every row it is
// handed already carries SRN-encoded e/a/v, because kernel/seavt.mjs's
// seavt() is the only place FARS builds one. readSeavt/streamSeavt read
// the physical file back — including a directory PyFARS wrote, per
// kernel/seavt.mjs's shared, total codec (S2.2) — so they decode e/a/v
// back to the real coordinates a caller actually witnessed.
export function readSeavt(root, feed, at) {
  return readEavtJournal({ root, feed, at });
}

export function* streamSeavt(root, feed, at) {
  yield* readEavtJournal({ root, feed, at });
}

export function appendSeavt(root, feed, entries, at) {
  return appendEavtEntries({ root, feed, entries, at });
}

export { journalPath };
